import { Router } from "express";
import { collections, nowIso, uid } from "../db.js";
import { asyncHandler, HttpError, ok, parse } from "../lib/http.js";
import { teamCreateSchema, teamUpdateSchema } from "../lib/schemas.js";
import { hashPassword, requireRole, revokeAllSessions } from "../lib/auth.js";
import { userRow } from "../lib/serializers.js";
import { actorName, logActivity } from "../lib/activity.js";

export const teamRouter = Router();

async function adminCount() {
  return collections.users.countDocuments({ role: "admin", status: "active" });
}

teamRouter.get(
  "/",
  requireRole("admin", "editor", "viewer"),
  asyncHandler(async (_req, res) => {
    const rows = await collections.users.find({}).sort({ created_at: 1 }).toArray();
    const enriched = await Promise.all(
      rows.map(async (row) => ({
        ...userRow(row),
        assignedCount: await collections.enquiries.countDocuments({ assignee: row.name }),
        activeSessions: await collections.sessions.countDocuments({
          user_id: row.id,
          expires_at: { $gt: nowIso() },
        }),
      }))
    );
    ok(res, enriched);
  })
);

teamRouter.get(
  "/assignees",
  requireRole("admin", "editor", "viewer"),
  asyncHandler(async (_req, res) => {
    const rows = await collections.users
      .find({ status: "active" }, { projection: { _id: 0, id: 1, name: 1, email: 1, role: 1 } })
      .sort({ name: 1 })
      .toArray();
    ok(res, rows);
  })
);

teamRouter.post(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const input = parse(teamCreateSchema)(req.body);
    if (await collections.users.findOne({ email: input.email }, { projection: { id: 1 } })) {
      throw new HttpError(409, "EMAIL_IN_USE", "A teammate with this email already exists.");
    }
    if ((await collections.users.countDocuments({})) >= 50) {
      throw new HttpError(422, "TEAM_LIMIT", "This workspace has reached its team limit.");
    }
    const id = uid("usr_");
    const now = nowIso();
    await collections.users.insertOne({
      id,
      email: input.email,
      name: input.name,
      role: input.role,
      password_hash: hashPassword(input.password),
      status: "active",
      created_at: now,
      last_login_at: null,
    });
    const user = userRow(await collections.users.findOne({ id }));
    await logActivity({
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
  asyncHandler(async (req, res) => {
    const row = await collections.users.findOne({ id: req.params.id });
    if (!row) throw new HttpError(404, "NOT_FOUND", "Teammate not found.");
    const input = parse(teamUpdateSchema)(req.body);

    if (row.id === req.user.id && input.status === "suspended") {
      throw new HttpError(422, "SELF_SUSPEND", "You cannot suspend your own account.");
    }
    if (row.id === req.user.id && input.role && input.role !== "admin") {
      throw new HttpError(422, "SELF_DEMOTE", "You cannot remove your own admin access.");
    }
    if (row.role === "admin" && input.role && input.role !== "admin" && (await adminCount()) <= 1) {
      throw new HttpError(422, "LAST_ADMIN", "Keep at least one active admin in the workspace.");
    }
    if (row.role === "admin" && input.status === "suspended" && (await adminCount()) <= 1) {
      throw new HttpError(422, "LAST_ADMIN", "Keep at least one active admin in the workspace.");
    }

    const updates = {};
    if (input.name) updates.name = input.name;
    if (input.role) updates.role = input.role;
    if (input.status) updates.status = input.status;
    if (input.password) updates.password_hash = hashPassword(input.password);
    if (!Object.keys(updates).length) {
      throw new HttpError(422, "NO_CHANGES", "Nothing to update.");
    }
    await collections.users.updateOne({ id: row.id }, { $set: updates });

    if (input.password || input.status === "suspended") {
      await revokeAllSessions(row.id);
    }
    const user = userRow(await collections.users.findOne({ id: row.id }));
    await logActivity({
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
  asyncHandler(async (req, res) => {
    const row = await collections.users.findOne({ id: req.params.id });
    if (!row) throw new HttpError(404, "NOT_FOUND", "Teammate not found.");
    if (row.id === req.user.id) {
      throw new HttpError(422, "SELF_DELETE", "You cannot remove your own account.");
    }
    if (row.role === "admin" && (await adminCount()) <= 1) {
      throw new HttpError(422, "LAST_ADMIN", "Keep at least one active admin in the workspace.");
    }
    await collections.users.deleteOne({ id: row.id });
    await collections.sessions.deleteMany({ user_id: row.id });
    await logActivity({
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
  asyncHandler(async (_req, res) => {
    const owner = await collections.users.findOne({}, { sort: { created_at: 1 } });
    ok(res, {
      owner: owner ? userRow(owner) : null,
      seatLimit: 50,
    });
  })
);
