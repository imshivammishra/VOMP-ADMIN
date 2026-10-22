import { collections, nowIso, uid } from "../db.js";

export async function logActivity({
  actor = "System",
  action,
  entity,
  entityId = null,
  detail = "",
}) {
  try {
    await collections.activity.insertOne({
      id: uid("act_"),
      actor,
      action,
      entity,
      entity_id: entityId,
      detail,
      created_at: nowIso(),
    });
  } catch (error) {
    console.error("[api] failed to write activity log", error);
  }
}

export function actorName(req) {
  return req.user?.name || req.user?.email || "System";
}
