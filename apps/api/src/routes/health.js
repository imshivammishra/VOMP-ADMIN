import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { sql } from "../db.js";
import { asyncHandler, ok } from "../lib/http.js";
import { config } from "../config.js";
import { realtimeStats } from "../lib/realtime.js";
import { requireRole } from "../lib/auth.js";

export const healthRouter = Router();

function dirStats(dir) {
  let files = 0;
  let bytes = 0;
  function walk(current) {
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        try {
          const stat = fs.statSync(full);
          files += 1;
          bytes += stat.size;
        } catch {
          /* file disappeared */
        }
      }
    }
  }
  walk(dir);
  return { files, bytes };
}

async function probe(url, timeoutMs = 3500) {
  if (!url) return { url, status: "unknown", message: "No URL configured." };
  const started = performance.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "VOMP-Admin-Health/1.0" },
    });
    return {
      url,
      status: response.status < 500 ? "online" : "degraded",
      httpStatus: response.status,
      latencyMs: Math.round(performance.now() - started),
      message: response.status < 500 ? "Reachable" : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      url,
      status: "offline",
      latencyMs: Math.round(performance.now() - started),
      message: error?.name === "TimeoutError" ? "Timed out after 3.5s" : "Could not reach host",
    };
  }
}

healthRouter.get(
  "/connections",
  requireRole("admin", "editor", "viewer"),
  asyncHandler(async (_req, res) => {
    const dbStarted = performance.now();
    let dbStatus = "healthy";
    let quickCheck = "ok";
    try {
      const result = sql.get("PRAGMA quick_check");
      quickCheck = Object.values(result || {})[0] || "ok";
    } catch {
      dbStatus = "degraded";
      quickCheck = "failed";
    }
    const dbLatency = Math.max(1, Math.round(performance.now() - dbStarted));

    const dbFiles = [config.dbPath, `${config.dbPath}-wal`, `${config.dbPath}-shm`].filter((file) =>
      fs.existsSync(file)
    );
    const dbBytes = dbFiles.reduce((sum, file) => {
      try {
        return sum + fs.statSync(file).size;
      } catch {
        return sum;
      }
    }, 0);

    const storage = dirStats(config.uploadsDir);
    const [frontend, admin] = await Promise.all([probe(config.frontendUrl), probe(config.adminUrl)]);

    const counts = {
      enquiries: sql.get("SELECT COUNT(*) AS count FROM enquiries").count,
      threads: sql.get("SELECT COUNT(*) AS count FROM threads").count,
      messages: sql.get("SELECT COUNT(*) AS count FROM messages").count,
      venues: sql.get("SELECT COUNT(*) AS count FROM venues").count,
      posts: sql.get("SELECT COUNT(*) AS count FROM posts").count,
      partners: sql.get("SELECT COUNT(*) AS count FROM partners").count,
      users: sql.get("SELECT COUNT(*) AS count FROM users").count,
      media: sql.get("SELECT COUNT(*) AS count FROM media").count,
    };

    const services = [
      {
        key: "api",
        label: "API application",
        host: config.apiPublicUrl.replace(/^https?:\/\//, ""),
        url: `${config.apiPublicUrl}/api/health`,
        status: "online",
        latencyMs: dbLatency,
        message: `Express ${config.env} · up ${Math.round(process.uptime())}s`,
        meta: `v${config.version}`,
      },
      {
        key: "database",
        label: "SQLite database",
        host: path.basename(config.dbPath),
        url: "",
        status: dbStatus,
        latencyMs: dbLatency,
        message: `quick_check: ${quickCheck} · WAL`,
        meta: `${(dbBytes / 1024 / 1024).toFixed(2)} MB`,
      },
      {
        key: "storage",
        label: "Media storage",
        host: "api/uploads",
        url: "",
        status: fs.existsSync(config.uploadsDir) ? "online" : "degraded",
        latencyMs: 1,
        message: `${storage.files} files`,
        meta: `${(storage.bytes / 1024 / 1024).toFixed(2)} MB`,
      },
      {
        key: "frontend",
        label: "Public website",
        host: config.frontendUrl.replace(/^https?:\/\//, ""),
        url: config.frontendUrl,
        ...frontend,
      },
      {
        key: "admin",
        label: "Admin console",
        host: config.adminUrl.replace(/^https?:\/\//, ""),
        url: config.adminUrl,
        ...admin,
      },
      {
        key: "realtime",
        label: "Realtime stream",
        host: "server-sent events",
        url: "",
        status: "online",
        latencyMs: 0,
        message: `${realtimeStats().clients} connected console${realtimeStats().clients === 1 ? "" : "s"}`,
        meta: "auto-reconnect",
      },
    ];

    ok(res, {
      checkedAt: new Date().toISOString(),
      services,
      counts,
      database: {
        path: config.dbPath,
        bytes: dbBytes,
        quickCheck,
        latencyMs: dbLatency,
        journalMode: sql.get("PRAGMA journal_mode")?.journal_mode || "wal",
      },
      storage: {
        path: config.uploadsDir,
        files: storage.files,
        bytes: storage.bytes,
      },
      runtime: {
        node: process.version,
        platform: `${process.platform} ${process.arch}`,
        uptimeSeconds: Math.round(process.uptime()),
        rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        environment: config.env,
      },
      domains: {
        frontend: config.frontendUrl,
        api: config.apiPublicUrl,
        admin: config.adminUrl,
        cookieDomain: config.cookie.domain || "host-only",
        origins: config.allowedOrigins,
      },
    });
  })
);
