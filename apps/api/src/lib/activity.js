import { nowIso, sql, uid } from "../db.js";

export function logActivity({ actor = "System", action, entity, entityId = null, detail = "" }) {
  try {
    sql.run(
      `INSERT INTO activity (id, actor, action, entity, entity_id, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      uid("act_"),
      actor,
      action,
      entity,
      entityId,
      detail,
      nowIso()
    );
  } catch (error) {
    console.error("[api] failed to write activity log", error);
  }
}

export function actorName(req) {
  return req.user?.name || req.user?.email || "System";
}
