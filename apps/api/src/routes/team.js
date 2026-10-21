import { Router } from "express";
import { nowIso, sql, uid } from "../db.js";
import { asyncHandler, HttpError, ok, parse } from "../lib/http.js";
import { teamCreateSchema, teamUpdateSchema } from "../lib/schemas.js";
import { hashPassword, requireRole, revokeAllSessions } from "../lib/auth.js";
import { userRow } from "../lib/serializers.js";
import { actorName, logActivity } from "../lib/activity.js";

export const teamRouter = Router();

function adminCount() {
  return sql.get("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'active'").count;
}

teamRouter.get(
  "/",
  requireRole("admin", "editor", "viewer"),
  asyncHandler((_req, res) => {
    const rows = sql.all(
      `SELECT u.*, (SELECT COUNT(*) FROM enquiries e WHERE e.assignee = u.name) AS assigned_count,
              (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > ?) AS active_sessions
         FROM users u ORDER BY u.created_at ASC`,
      nowIso()
    );
    ok(
      res,
      rows.map((row) => ({ ...userRow(row), assignedCount: row.assigned_count, activeSessions: row.active_sessions }))
    );
  })
);

teamRouter.get(
  "/assignees",
  requireRole("admin", "editor", "viewer"),
  asyncHandler((_req, res) => {
    const rows = sql.all("SELECT id, name, email, role FROM users WHERE status = 'active' ORDER BY name");
    ok(res, rows);
  })
);

teamRouter.post(
  "/",
  requireRole("admin"),
  asyncHandler((req, res) => {
    const input = parse(teamCreateSchema)(req.body);
    if (sql.get("SELECT id FROM users WHERE email = ?", input.email)) {
      throw new HttpError(409, "EMAIL_IN_USE", "A teammate with this email already exists.");
    }
    if (sql.get("SELECT COUNT(*) AS count FROM users").count >= 50) {
      throw new HttpError(422, "TEAM_LIMIT", "This workspace has reached its team limit.");
    }
    const id = uid("usr_");
    const now = nowIso();
    sql.run(
      `INSERT INTO users (id, email, name, role, password_hash, status, created_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, NULL)`,
      id,
      input.email,
      input.name,
      input.role,
      hashPassword(input.password),
      now
    );
    const user = userRow(sql.get("SELECT * FROM users WHERE id = ?", id));
    logActivity({
      actor: actorName(req),
      action: "team.member_added",
      entity: "user",
      entityId: id,
      detail: `${user.name} · ${user.role}`,
    });
    ok(res, user, undefined, 201);
  })
);

teamRouter.patch(
  "/:id",
  requireRole("admin"),
  asyncHandler((req, res) => {
    const row = sql.get("SELECT * FROM users WHERE id = ?", req.params.id);
    if (!row) throw new HttpError(404, "NOT_FOUND", "Teammate not found.");
    const input = parse(teamUpdateSchema)(req.body);

    if (row.id === req.user.id && input.status === "suspended") {
      throw new HttpError(422, "SELF_SUSPEND", "You cannot suspend your own account.");
    }
    if (row.id === req.user.id && input.role && input.role !== "admin") {
      throw new HttpError(422, "SELF_DEMOTE", "You cannot remove your own admin access.");
    }
    if (row.role === "admin" && input.role && input.role !== "admin" && adminCount() <= 1) {
      throw new HttpError(422, "LAST_ADMIN", "Keep at least one active admin in the workspace.");
    }
    if (row.role === "admin" && input.status === "suspended" && adminCount() <= 1) {
      throw new HttpError(422, "LAST_ADMIN", "Keep at least one active admin in the workspace.");
    }

    const updates = [];
    const params = [];
    if (input.name) {
      updates.push("name = ?");
      params.push(input.name);
    }
    if (input.role) {
      updates.push("role = ?");
      params.push(input.role);
    }
    if (input.status) {
      updates.push("status = ?");
      params.push(input.status);
    }
    if (input.password) {
      updates.push("password_hash = ?");
      params.push(hashPassword(input.password));
    }
    if (!updates.length) throw new HttpError(422, "NO_CHANGES", "Nothing to update.");
    params.push(row.id);
    sql.run(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, ...params);

    if (input.password || input.status === "suspended") {
      revokeAllSessions(row.id);
    }
    const user = userRow(sql.get("SELECT * FROM users WHERE id = ?", row.id));
    logActivity({
      actor: actorName(req),
      action: "team.member_updated",
      entity: "user",
      entityId: row.id,
      detail: `${user.name} · ${Object.keys(input).join(", ")} updated`,
    });
    ok(res, user);
  })
);

teamRouter.delete(
  "/:id",
  requireRole("admin"),
  asyncHandler((req, res) => {
    const row = sql.get("SELECT * FROM users WHERE id = ?", req.params.id);
    if (!row) throw new HttpError(404, "NOT_FOUND", "Teammate not found.");
    if (row.id === req.user.id) {
      throw new HttpError(422, "SELF_DELETE", "You cannot remove your own account.");
    }
    if (row.role === "admin" && adminCount() <= 1) {
      throw new HttpError(422, "LAST_ADMIN", "Keep at least one active admin in the workspace.");
    }
    sql.run("DELETE FROM users WHERE id = ?", row.id);
    logActivity({
      actor: actorName(req),
      action: "team.member_removed",
      entity: "user",
      entityId: row.id,
      detail: `${row.name} · ${row.email}`,
    });
    ok(res, { ok: true });
  })
);

// Expose the first workspace account so the UI can show "owner" context.
teamRouter.get(
  "/meta",
  requireRole("admin"),
  asyncHandler((_req, res) => {
    const owner = sql.get("SELECT * FROM users ORDER BY created_at ASC LIMIT 1");
    ok(res, {
      owner: owner ? userRow(owner) : null,
      seatLimit: 50,
    });
  })
);
