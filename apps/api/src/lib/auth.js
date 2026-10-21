import crypto from "node:crypto";
import { config } from "../config.js";
import { nowIso, sql, uid } from "../db.js";

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

export function createSession(userId, req) {
  const token = crypto.randomBytes(32).toString("base64url");
  const created = new Date();
  const expires = new Date(created.getTime() + config.sessionHours * 60 * 60 * 1000);
  sql.run(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    uid("ses_"),
    userId,
    hashToken(token),
    created.toISOString(),
    expires.toISOString(),
    created.toISOString(),
    req.ip || "",
    String(req.get("user-agent") || "").slice(0, 300)
  );
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

export function loadSession(req) {
  const token = readCookie(req, config.cookie.name);
  if (!token) return null;
  const row = sql.get(
    `SELECT s.id AS session_id, s.expires_at, s.last_seen_at,
            u.id, u.email, u.name, u.role, u.status
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`,
    hashToken(token)
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    sql.run("DELETE FROM sessions WHERE id = ?", row.session_id);
    return null;
  }
  if (row.status !== "active") return null;

  if (Date.now() - new Date(row.last_seen_at).getTime() > 60_000) {
    sql.run("UPDATE sessions SET last_seen_at = ? WHERE id = ?", nowIso(), row.session_id);
  }

  return {
    sessionId: row.session_id,
    expiresAt: row.expires_at,
    user: { id: row.id, email: row.email, name: row.name, role: row.role },
  };
}

export function revokeSession(sessionId) {
  sql.run("DELETE FROM sessions WHERE id = ?", sessionId);
}

export function revokeAllSessions(userId, exceptSessionId = null) {
  if (exceptSessionId) {
    sql.run("DELETE FROM sessions WHERE user_id = ? AND id <> ?", userId, exceptSessionId);
  } else {
    sql.run("DELETE FROM sessions WHERE user_id = ?", userId);
  }
}

export function requireAuth(req, res, next) {
  const session = loadSession(req);
  if (!session) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Please sign in to continue." } });
  }
  req.session = session;
  req.user = session.user;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Please sign in to continue." } });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "Your role does not allow this action." },
      });
    }
    next();
  };
}

export function pruneSessions() {
  sql.run("DELETE FROM sessions WHERE expires_at <= ?", nowIso());
}
