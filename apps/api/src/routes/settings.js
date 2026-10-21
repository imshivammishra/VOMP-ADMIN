import { Router } from "express";
import { nowIso } from "../db.js";
import { asyncHandler, ok, parse } from "../lib/http.js";
import { settingsSchema } from "../lib/schemas.js";
import { requireRole } from "../lib/auth.js";
import { getSettings, saveSettings, SETTINGS_DEFAULTS } from "../lib/settings.js";
import { actorName, logActivity } from "../lib/activity.js";
import { broadcast } from "../lib/realtime.js";
import { config } from "../config.js";

export const settingsRouter = Router();

settingsRouter.get(
  "/",
  asyncHandler((_req, res) => {
    ok(res, getSettings());
  })
);

settingsRouter.get(
  "/schema",
  asyncHandler((_req, res) => {
    ok(res, {
      defaults: SETTINGS_DEFAULTS,
      timezone: "Asia/Kolkata",
      version: config.version,
    });
  })
);

settingsRouter.put(
  "/",
  requireRole("admin"),
  asyncHandler((req, res) => {
    const input = parse(settingsSchema)(req.body);
    const settings = saveSettings(input);
    logActivity({
      actor: actorName(req),
      action: "settings.updated",
      entity: "settings",
      entityId: null,
      detail: `${Object.keys(input).join(", ")} updated`,
    });
    broadcast("settings:changed", { keys: Object.keys(input) });
    ok(res, settings);
  })
);

settingsRouter.get(
  "/environment",
  requireRole("admin"),
  asyncHandler((_req, res) => {
    const mask = (value) => {
      if (!value) return "not set";
      if (value.length <= 4) return "••••";
      return `${value.slice(0, 2)}••••${value.slice(-2)}`;
    };
    ok(res, {
      node: process.version,
      platform: process.platform,
      environment: config.env,
      version: config.version,
      uptimeSeconds: Math.round(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      domains: {
        frontend: config.frontendUrl,
        api: config.apiPublicUrl,
        admin: config.adminUrl,
        cookieDomain: config.cookie.domain || "host-only (localhost)",
      },
      flags: {
        secureCookies: config.cookie.secure,
        trustProxy: config.trustProxy,
        sessionHours: config.sessionHours,
        maxUploadMb: Math.round(config.maxUploadBytes / 1024 / 1024),
        maxVideoMb: Math.round(config.maxVideoBytes / 1024 / 1024),
        allowedOrigins: config.allowedOrigins,
      },
      secrets: {
        seedAdminPassword: mask(config.seedAdmin.password),
        databasePath: config.dbPath,
        uploadsPath: config.uploadsDir,
      },
      checkedAt: nowIso(),
    });
  })
);
