import { Router } from "express";
import { collections, nowIso } from "../db.js";
import { asyncHandler, ok, parse } from "../lib/http.js";
import { changePasswordSchema, loginSchema } from "../lib/schemas.js";
import {
  clearSessionCookie,
  createSession,
  hashPassword,
  requireAuth,
  revokeAllSessions,
  revokeSession,
  sessionCookie,
  verifyPassword,
} from "../lib/auth.js";
import { logActivity } from "../lib/activity.js";
import { config } from "../config.js";
import { userRow } from "../lib/serializers.js";

export const authRouter = Router();

const attempts = new Map();
const WINDOW = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
// Dummy hash keeps failed logins constant-time even when the email is unknown.
const DUMMY_HASH = hashPassword("not-a-real-password");

function attemptKey(req, email) {
  return `${req.ip || "local"}:${email}`;
}

function tooMany(key) {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (entry.resetAt <= Date.now()) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key) {
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= Date.now()) {
    attempts.set(key, { count: 1, resetAt: Date.now() + WINDOW });
    return;
  }
  entry.count += 1;
}

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = parse(loginSchema)(req.body);
    const key = attemptKey(req, input.email);
    if (tooMany(key)) {
      return res.status(429).json({
        error: {
          code: "LOGIN_LOCKED",
          message: "Too many sign-in attempts. Please wait 15 minutes and try again.",
        },
      });
    }

    const row = await collections.users.findOne({ email: input.email });
    const valid = verifyPassword(input.password, row?.password_hash || DUMMY_HASH);
    if (!row || !valid) {
      recordFailure(key);
      return res.status(401).json({
        error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." },
      });
    }
    if (row.status !== "active") {
      return res.status(403).json({
        error: { code: "ACCOUNT_SUSPENDED", message: "This account has been suspended." },
      });
    }

    attempts.delete(key);
    const session = await createSession(row.id, req);
    await collections.users.updateOne({ id: row.id }, { $set: { last_login_at: nowIso() } });
    res.setHeader("Set-Cookie", sessionCookie(session.token, session.expiresAt));
    await logActivity({
      actor: row.name,
      action: "auth.login",
      entity: "user",
      entityId: row.id,
      detail: `Signed in from ${req.ip || "unknown IP"}`,
    });
    return ok(res, {
      user: userRow(row),
      expiresAt: session.expiresAt,
      sessionHours: config.sessionHours,
    });
  })
);

authRouter.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    await revokeSession(req.session.sessionId);
    res.setHeader("Set-Cookie", clearSessionCookie());
    await logActivity({
      actor: req.user.name,
      action: "auth.logout",
      entity: "user",
      entityId: req.user.id,
      detail: "Signed out",
    });
    return ok(res, { ok: true });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler((req, res) => {
    return ok(res, {
      user: req.user,
      session: { expiresAt: req.session.expiresAt, hours: config.sessionHours },
    });
  })
);

authRouter.post(
  "/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = parse(changePasswordSchema)(req.body);
    const row = await collections.users.findOne({ id: req.user.id });
    if (!row || !verifyPassword(input.currentPassword, row.password_hash)) {
      return res.status(400).json({
        error: { code: "INVALID_PASSWORD", message: "Current password is incorrect." },
      });
    }
    if (input.currentPassword === input.newPassword) {
      return res.status(400).json({
        error: { code: "WEAK_PASSWORD", message: "Choose a password you have not used here before." },
      });
    }
    await collections.users.updateOne(
      { id: req.user.id },
      { $set: { password_hash: hashPassword(input.newPassword) } }
    );
    await revokeAllSessions(req.user.id, req.session.sessionId);
    await logActivity({
      actor: req.user.name,
      action: "auth.password_changed",
      entity: "user",
      entityId: req.user.id,
      detail: "Password updated; other sessions revoked",
    });
    return ok(res, { ok: true });
  })
);

authRouter.post(
  "/logout-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    await revokeAllSessions(req.user.id);
    res.setHeader("Set-Cookie", clearSessionCookie());
    await logActivity({
      actor: req.user.name,
      action: "auth.sessions_revoked",
      entity: "user",
      entityId: req.user.id,
      detail: "All sessions signed out",
    });
    return ok(res, { ok: true });
  })
);

authRouter.get(
  "/sessions",
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await collections.sessions
      .find({ user_id: req.user.id })
      .sort({ last_seen_at: -1 })
      .toArray();
    ok(
      res,
      rows.map((row) => ({
        id: row.id,
        current: row.id === req.session.sessionId,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        lastSeenAt: row.last_seen_at,
        ip: row.ip,
        userAgent: row.user_agent,
      }))
    );
  })
);

authRouter.delete(
  "/sessions/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.params.id === req.session.sessionId) {
      return res.status(400).json({
        error: { code: "CURRENT_SESSION", message: "Use sign out to end your current session." },
      });
    }
    await revokeSession(req.params.id);
    await logActivity({
      actor: req.user.name,
      action: "auth.session_revoked",
      entity: "session",
      entityId: req.params.id,
      detail: "Session revoked",
    });
    return ok(res, { ok: true });
  })
);

// Housekeeping: drop expired sessions whenever auth routes are exercised.
async function prune() {
  await collections.sessions.deleteMany({ expires_at: { $lte: nowIso() } });
}
setInterval(() => prune().catch((error) => console.error("[api] session prune failed", error)), 30 * 60 * 1000).unref();
