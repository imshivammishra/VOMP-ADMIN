import { Router } from "express";
import { nowIso, sql, uid } from "../db.js";
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
  asyncHandler((req, res) => {
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

    const row = sql.get("SELECT * FROM users WHERE email = ?", input.email);
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
    const session = createSession(row.id, req);
    sql.run("UPDATE users SET last_login_at = ? WHERE id = ?", nowIso(), row.id);
    res.setHeader("Set-Cookie", sessionCookie(session.token, session.expiresAt));
    logActivity({
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
  asyncHandler((req, res) => {
    revokeSession(req.session.sessionId);
    res.setHeader("Set-Cookie", clearSessionCookie());
    logActivity({
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
  asyncHandler((req, res) => {
    const input = parse(changePasswordSchema)(req.body);
    const row = sql.get("SELECT * FROM users WHERE id = ?", req.user.id);
    if (!verifyPassword(input.currentPassword, row.password_hash)) {
      return res.status(400).json({
        error: { code: "INVALID_PASSWORD", message: "Current password is incorrect." },
      });
    }
    if (input.currentPassword === input.newPassword) {
      return res.status(400).json({
        error: { code: "WEAK_PASSWORD", message: "Choose a password you have not used here before." },
      });
    }
    sql.run("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(input.newPassword), req.user.id);
    revokeAllSessions(req.user.id, req.session.sessionId);
    logActivity({
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
  asyncHandler((req, res) => {
    revokeAllSessions(req.user.id);
    res.setHeader("Set-Cookie", clearSessionCookie());
    logActivity({
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
  asyncHandler((req, res) => {
    const rows = sql.all(
      `SELECT id, created_at, expires_at, last_seen_at, ip, user_agent
         FROM sessions WHERE user_id = ? ORDER BY last_seen_at DESC`,
      req.user.id
    );
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
  asyncHandler((req, res) => {
    if (req.params.id === req.session.sessionId) {
      return res.status(400).json({
        error: { code: "CURRENT_SESSION", message: "Use sign out to end your current session." },
      });
    }
    revokeSession(req.params.id);
    logActivity({
      actor: req.user.name,
      action: "auth.session_revoked",
      entity: "session",
      entityId: req.params.id,
      detail: "Session revoked",
    });
    ok(res, { ok: true });
  })
);

// Housekeeping: drop expired sessions whenever auth routes are exercised.
function prune() {
  const now = nowIso();
  sql.run("DELETE FROM sessions WHERE expires_at <= ?", now);
}
setInterval(prune, 30 * 60 * 1000).unref();
