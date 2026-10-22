import { Router } from "express";
import { collections } from "../db.js";
import { asyncHandler, ok } from "../lib/http.js";
import { like, groupedCounts, attachLastMessages } from "../lib/query.js";
import { enquiryRow, threadRow } from "../lib/serializers.js";
import { realtimeStats } from "../lib/realtime.js";

export const overviewRouter = Router();

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

async function sourceCounts() {
  return collections.enquiries
    .aggregate([
      { $group: { _id: "$source", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, source: "$_id", count: 1 } },
    ])
    .toArray();
}

overviewRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const startToday = new Date(now);
    startToday.setUTCHours(0, 0, 0, 0);
    const start7 = new Date(startToday.getTime() - 6 * 86400000);
    const startPrev7 = new Date(startToday.getTime() - 13 * 86400000);
    const start14 = new Date(startToday.getTime() - 13 * 86400000);

    const [
      total,
      newCount,
      today,
      yesterday,
      thisWeek,
      prevWeek,
      won,
      unreadAgg,
      openThreads,
      liveVenues,
      draftVenues,
      publishedPosts,
      newPartners,
      totalPartners,
      responseRows,
      trendRows,
      sources,
      statusCounts,
      cities,
      assignees,
      partnerStatusCounts,
      recentEnquiriesRaw,
      recentThreadsRaw,
      recentActivity,
    ] = await Promise.all([
      collections.enquiries.countDocuments({}),
      collections.enquiries.countDocuments({ status: "new" }),
      collections.enquiries.countDocuments({ created_at: { $gte: startToday.toISOString() } }),
      collections.enquiries.countDocuments({
        created_at: {
          $gte: new Date(startToday.getTime() - 86400000).toISOString(),
          $lt: startToday.toISOString(),
        },
      }),
      collections.enquiries.countDocuments({ created_at: { $gte: start7.toISOString() } }),
      collections.enquiries.countDocuments({
        created_at: { $gte: startPrev7.toISOString(), $lt: start7.toISOString() },
      }),
      collections.enquiries.countDocuments({ status: "won" }),
      collections.threads
        .aggregate([{ $group: { _id: null, count: { $sum: "$unread_admin" } } }])
        .toArray(),
      collections.threads.countDocuments({ status: { $ne: "resolved" } }),
      collections.venues.countDocuments({ status: "published" }),
      collections.venues.countDocuments({ status: "draft" }),
      collections.posts.countDocuments({ status: "published" }),
      collections.partners.countDocuments({ status: "new" }),
      collections.partners.countDocuments({}),
      collections.enquiries
        .find(
          { first_response_at: { $ne: null } },
          { projection: { _id: 0, created_at: 1, first_response_at: 1 } }
        )
        .toArray(),
      collections.enquiries
        .find(
          { created_at: { $gte: start14.toISOString() } },
          { projection: { _id: 0, created_at: 1 } }
        )
        .toArray(),
      sourceCounts(),
      groupedCounts("enquiries", "status"),
      collections.enquiries
        .aggregate([
          { $match: { city: { $ne: "" } } },
          { $group: { _id: "$city", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 6 },
          { $project: { _id: 0, city: "$_id", count: 1 } },
        ])
        .toArray(),
      collections.enquiries
        .aggregate([
          { $match: { assignee: { $ne: "" } } },
          {
            $group: {
              _id: "$assignee",
              count: { $sum: 1 },
              won: { $sum: { $cond: [{ $eq: ["$status", "won"] }, 1, 0] } },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 5 },
          { $project: { _id: 0, assignee: "$_id", count: 1, won: 1 } },
        ])
        .toArray(),
      groupedCounts("partners", "status"),
      collections.enquiries.find({}).sort({ created_at: -1 }).limit(6).toArray(),
      collections.threads.find({}).sort({ last_message_at: -1 }).limit(5).toArray(),
      collections.activity.find({}).sort({ created_at: -1 }).limit(8).toArray(),
    ]);

    const avgResponseHours = responseRows.length
      ? Number(
          (
            responseRows.reduce(
              (sum, row) =>
                sum + (new Date(row.first_response_at).getTime() - new Date(row.created_at).getTime()) / 3600000,
              0
            ) / responseRows.length
          ).toFixed(1)
        )
      : null;

    const trendMap = new Map();
    for (const row of trendRows) {
      const key = String(row.created_at).slice(0, 10);
      trendMap.set(key, (trendMap.get(key) || 0) + 1);
    }
    const trend = [];
    for (let index = 0; index < 14; index += 1) {
      const date = new Date(start14.getTime() + index * 86400000);
      const key = dayKey(date);
      trend.push({ date: key, enquiries: trendMap.get(key) || 0 });
    }

    const statuses = ["new", "contacted", "qualified", "won", "lost", "closed"].map((status) => ({
      status,
      count: statusCounts[status] || 0,
    }));
    const partnerStatuses = ["new", "reviewing", "verified", "active", "declined"].map((status) => ({
      status,
      count: partnerStatusCounts[status] || 0,
    }));
    const recentThreads = (await attachLastMessages(recentThreadsRaw)).map(threadRow);

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
        unreadMessages: unreadAgg[0]?.count || 0,
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
      recentEnquiries: recentEnquiriesRaw.map(enquiryRow),
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
  asyncHandler(async (req, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
    const filter = {};
    if (req.query.entity && req.query.entity !== "all") filter.entity = String(req.query.entity);
    if (req.query.q) {
      filter.$or = ["actor", "action", "detail"].map((field) => ({ [field]: like(req.query.q) }));
    }
    const rows = await collections.activity.find(filter).sort({ created_at: -1 }).limit(limit).toArray();
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
