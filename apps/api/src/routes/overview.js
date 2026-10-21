import { Router } from "express";
import { sql } from "../db.js";
import { asyncHandler, ok } from "../lib/http.js";
import { enquiryRow, threadRow } from "../lib/serializers.js";
import { realtimeStats } from "../lib/realtime.js";

export const overviewRouter = Router();

function scalar(query, ...params) {
  return sql.get(query, ...params)?.count ?? 0;
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

overviewRouter.get(
  "/",
  asyncHandler((_req, res) => {
    const now = new Date();
    const startToday = new Date(now);
    startToday.setUTCHours(0, 0, 0, 0);
    const start7 = new Date(startToday.getTime() - 6 * 86400000);
    const startPrev7 = new Date(startToday.getTime() - 13 * 86400000);
    const start14 = new Date(startToday.getTime() - 13 * 86400000);

    const total = scalar("SELECT COUNT(*) AS count FROM enquiries");
    const newCount = scalar("SELECT COUNT(*) AS count FROM enquiries WHERE status = 'new'");
    const today = scalar(
      "SELECT COUNT(*) AS count FROM enquiries WHERE created_at >= ?",
      startToday.toISOString()
    );
    const yesterday = scalar(
      "SELECT COUNT(*) AS count FROM enquiries WHERE created_at >= ? AND created_at < ?",
      new Date(startToday.getTime() - 86400000).toISOString(),
      startToday.toISOString()
    );
    const thisWeek = scalar(
      "SELECT COUNT(*) AS count FROM enquiries WHERE created_at >= ?",
      start7.toISOString()
    );
    const prevWeek = scalar(
      "SELECT COUNT(*) AS count FROM enquiries WHERE created_at >= ? AND created_at < ?",
      startPrev7.toISOString(),
      start7.toISOString()
    );
    const won = scalar("SELECT COUNT(*) AS count FROM enquiries WHERE status = 'won'");
    const unreadMessages = scalar("SELECT COALESCE(SUM(unread_admin), 0) AS count FROM threads");
    const openThreads = scalar("SELECT COUNT(*) AS count FROM threads WHERE status <> 'resolved'");
    const liveVenues = scalar("SELECT COUNT(*) AS count FROM venues WHERE status = 'published'");
    const draftVenues = scalar("SELECT COUNT(*) AS count FROM venues WHERE status = 'draft'");
    const publishedPosts = scalar("SELECT COUNT(*) AS count FROM posts WHERE status = 'published'");
    const newPartners = scalar("SELECT COUNT(*) AS count FROM partners WHERE status = 'new'");
    const totalPartners = scalar("SELECT COUNT(*) AS count FROM partners");
    const responseRow = sql.get(
      `SELECT AVG((julianday(first_response_at) - julianday(created_at)) * 24) AS hours
         FROM enquiries WHERE first_response_at IS NOT NULL`
    );
    const avgResponseHours = responseRow?.hours ? Number(responseRow.hours.toFixed(1)) : null;

    const trendRows = sql.all(
      `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS count
         FROM enquiries WHERE created_at >= ? GROUP BY day ORDER BY day`,
      start14.toISOString()
    );
    const trendMap = new Map(trendRows.map((row) => [row.day, row.count]));
    const trend = [];
    for (let index = 0; index < 14; index += 1) {
      const date = new Date(start14.getTime() + index * 86400000);
      const key = dayKey(date);
      trend.push({ date: key, enquiries: trendMap.get(key) || 0 });
    }

    const sources = sql.all(
      `SELECT source, COUNT(*) AS count FROM enquiries GROUP BY source ORDER BY count DESC`
    );
    const statuses = ["new", "contacted", "qualified", "won", "lost", "closed"].map((status) => ({
      status,
      count: scalar("SELECT COUNT(*) AS count FROM enquiries WHERE status = ?", status),
    }));
    const cities = sql.all(
      `SELECT city, COUNT(*) AS count FROM enquiries WHERE city <> '' GROUP BY city ORDER BY count DESC LIMIT 6`
    );
    const assignees = sql.all(
      `SELECT assignee, COUNT(*) AS count,
              SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS won
         FROM enquiries WHERE assignee <> '' GROUP BY assignee ORDER BY count DESC LIMIT 5`
    );
    const partnerStatuses = ["new", "reviewing", "verified", "active", "declined"].map((status) => ({
      status,
      count: scalar("SELECT COUNT(*) AS count FROM partners WHERE status = ?", status),
    }));

    const recentEnquiries = sql
      .all("SELECT * FROM enquiries ORDER BY created_at DESC LIMIT 6")
      .map(enquiryRow);
    const recentThreads = sql
      .all(
        `SELECT t.*, (SELECT body FROM messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
           FROM threads t ORDER BY t.last_message_at DESC LIMIT 5`
      )
      .map(threadRow);
    const recentActivity = sql.all("SELECT * FROM activity ORDER BY created_at DESC LIMIT 8");

    ok(res, {
      generatedAt: now.toISOString(),
      stats: {
        totalEnquiries: total,
        newEnquiries: newCount,
        todayEnquiries: today,
        yesterdayEnquiries: yesterday,
        weekEnquiries: thisWeek,
        prevWeekEnquiries: prevWeek,
        wonEnquiries: won,
        conversionRate: total ? Number(((won / total) * 100).toFixed(1)) : 0,
        unreadMessages,
        openThreads,
        liveVenues,
        draftVenues,
        publishedPosts,
        newPartners,
        totalPartners,
        avgResponseHours,
        realtimeClients: realtimeStats().clients,
      },
      trend,
      sources,
      statuses,
      cities,
      assignees,
      partnerStatuses,
      recentEnquiries,
      recentThreads,
      recentActivity: recentActivity.map((row) => ({
        id: row.id,
        actor: row.actor,
        action: row.action,
        entity: row.entity,
        entityId: row.entity_id,
        detail: row.detail,
        createdAt: row.created_at,
      })),
    });
  })
);

overviewRouter.get(
  "/activity",
  asyncHandler((req, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
    const where = [];
    const params = [];
    if (req.query.entity && req.query.entity !== "all") {
      where.push("entity = ?");
      params.push(String(req.query.entity));
    }
    if (req.query.q) {
      where.push("(actor LIKE ? OR action LIKE ? OR detail LIKE ?)");
      params.push(`%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const rows = sql.all(
      `SELECT * FROM activity ${clause} ORDER BY created_at DESC LIMIT ?`,
      ...params,
      limit
    );
    ok(
      res,
      rows.map((row) => ({
        id: row.id,
        actor: row.actor,
        action: row.action,
        entity: row.entity,
        entityId: row.entity_id,
        detail: row.detail,
        createdAt: row.created_at,
      }))
    );
  })
);
