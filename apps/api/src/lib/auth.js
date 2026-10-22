import crypto from "node:crypto";
import { config } from "../config.js";
import { collections, nowIso, uid } from "../db.js";

const SCRYPT_KEYLEN = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, salt, expected] = String(stored).split(":");
    if (scheme !== "scrypt" || !salt || !expected) return false;
    const actual = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
    const expectedBuffer = Buffer.from(expected, "hex");
    return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
  } catch {
    return false;
  }
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId, req) {
  const token = crypto.randomBytes(32).toString("base64url");
  const created = new Date();
  const expires = new Date(created.getTime() + config.sessionHours * 60 * 60 * 1000);
  await collections.sessions.insertOne({
    id: uid("ses_"),
    user_id: userId,
    token_hash: hashToken(token),
    created_at: created.toISOString(),
    expires_at: expires.toISOString(),
    last_seen_at: created.toISOString(),
    ip: req.ip || "",
    user_agent: String(req.get("user-agent") || "").slice(0, 300),
  });
  return { token, expiresAt: expires.toISOString() };
}

export function sessionCookie(token, expiresAt) {
  const parts = [
    `${config.cookie.name}=${token}`,
    "Path=/",
    "HttpOnly",
    `SameSite=Lax`,
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ];
  if (config.cookie.domain) parts.push(`Domain=${config.cookie.domain}`);
  if (config.cookie.secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie() {
  const parts = [`${config.cookie.name}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (config.cookie.domain) parts.push(`Domain=${config.cookie.domain}`);
  if (config.cookie.secure) parts.push("Secure");
  return parts.join("; ");
}

export function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return null;
}

export async function loadSession(req) {
  const token = readCookie(req, config.cookie.name);
  if (!token) return null;
  const session = await collections.sessions.findOne({ token_hash: hashToken(token) });
  if (!session) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await collections.sessions.deleteOne({ id: session.id });
    return null;
  }
  const user = await collections.users.findOne({ id: session.user_id });
  if (!user || user.status !== "active") return null;

  if (Date.now() - new Date(session.last_seen_at).getTime() > 60_000) {
    await collections.sessions.updateOne(
      { id: session.id },
      { $set: { last_seen_at: nowIso() } }
    );
  }

  return {
    sessionId: session.id,
    expiresAt: session.expires_at,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}

export async function revokeSession(sessionId) {
  await collections.sessions.deleteOne({ id: sessionId });
}

export async function revokeAllSessions(userId, exceptSessionId = null) {
  const filter = { user_id: userId };
  if (exceptSessionId) filter.id = { $ne: exceptSessionId };
  await collections.sessions.deleteMany(filter);
}

export function requireAuth(req, res, next) {
  loadSession(req)
    .then((session) => {
      if (!session) {
        return res
          .status(401)
          .json({ error: { code: "UNAUTHORIZED", message: "Please sign in to continue." } });
      }
      req.session = session;
      req.user = session.user;
      return next();
    })
    .catch(next);
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ error: { code: "UNAUTHORIZED", message: "Please sign in to continue." } });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "Your role does not allow this action." },
      });
    }
    return next();
  };
}

export async function pruneSessions() {
  await collections.sessions.deleteMany({ expires_at: { $lte: nowIso() } });
}
