import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { config } from "./config.js";
import { closeDb, ensureIndexes, nowIso, pingDatabase } from "./db.js";
import { requireAuth } from "./lib/auth.js";
import {
  corsOptions,
  csrfGuard,
  errorHandler,
  helmetOptions,
  notFound,
  rateLimit,
  requestId,
  requestLogger,
} from "./lib/security.js";
import { streamHandler } from "./lib/realtime.js";
import { authRouter } from "./routes/auth.js";
import { publicRouter, legacyRouter } from "./routes/public.js";
import { enquiriesRouter } from "./routes/enquiries.js";
import { threadsRouter } from "./routes/threads.js";
import { venuesRouter, destinationsRouter, postsRouter } from "./routes/content.js";
import { partnersRouter } from "./routes/partners.js";
import { mediaRouter } from "./routes/media.js";
import { teamRouter } from "./routes/team.js";
import { settingsRouter } from "./routes/settings.js";
import { contentBlocksRouter, reviewsRouter } from "./routes/site.js";
import { overviewRouter } from "./routes/overview.js";
import { searchRouter } from "./routes/search.js";
import { healthRouter } from "./routes/health.js";
import { ensureSeed } from "../seed/seed.js";

await ensureIndexes();
const seedResult = await ensureSeed();

const app = express();
app.disable("x-powered-by");
if (config.trustProxy) app.set("trust proxy", config.trustProxy);

app.use(helmet(helmetOptions()));
app.use(cors(corsOptions()));
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(requestId);
app.use(requestLogger);

app.use(
  "/uploads",
  express.static(config.uploadsDir, {
    maxAge: "30d",
    immutable: true,
    fallthrough: false,
    index: false,
  })
);

app.get("/", (_req, res) => {
  res.json({
    name: "Venue On My Plate API",
    version: config.version,
    environment: config.env,
    docs: {
      health: "/api/health",
      public: "/api/v1/public",
      admin: "/api/admin",
    },
  });
});

app.get("/api/health", async (_req, res) => {
  let database = "ok";
  let latencyMs = null;
  try {
    latencyMs = await pingDatabase();
  } catch {
    database = "error";
  }
  res.status(database === "ok" ? 200 : 503).json({
    ok: database === "ok",
    service: "vomp-api",
    version: config.version,
    environment: config.env,
    database,
    databaseName: config.mongoDb,
    latencyMs,
    uptimeSeconds: Math.round(process.uptime()),
    time: nowIso(),
  });
});

// Public traffic: forgiving but bounded. The API only listens on loopback and
// the website/admin proxies share that address, so the read ceiling must cover
// server-side rendering builds and normal proxied traffic alike.
app.use("/api", rateLimit({ windowMs: 60_000, max: 6000, keyPrefix: "global" }));
const writeLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  keyPrefix: "write",
});
app.use("/api", (req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }
  return writeLimiter(req, res, next);
});

app.use("/api/v1/public", publicRouter);
app.use("/api", legacyRouter);

// Admin auth (login/logout/me) — CSRF origin check on writes.
app.use("/api/admin/auth", csrfGuard, authRouter);

// Everything else under /api/admin requires a live session.
app.use("/api/admin", csrfGuard, requireAuth);

const adminRouter = express.Router();
adminRouter.get("/stream", streamHandler);
adminRouter.use("/overview", overviewRouter);
adminRouter.use("/enquiries", enquiriesRouter);
adminRouter.use("/threads", threadsRouter);
adminRouter.use("/venues", venuesRouter);
adminRouter.use("/destinations", destinationsRouter);
adminRouter.use("/posts", postsRouter);
adminRouter.use("/partners", partnersRouter);
adminRouter.use("/media", mediaRouter);
adminRouter.use("/team", teamRouter);
adminRouter.use("/settings", settingsRouter);
adminRouter.use("/content", contentBlocksRouter);
adminRouter.use("/reviews", reviewsRouter);
adminRouter.use("/search", searchRouter);
adminRouter.use("/health", healthRouter);
adminRouter.get("/", (req, res) => {
  res.json({
    data: {
      user: req.user,
      version: config.version,
      endpoints: [
        "overview",
        "enquiries",
        "threads",
        "venues",
        "destinations",
        "posts",
        "partners",
        "media",
        "team",
        "settings",
        "content",
        "reviews",
        "search",
        "health",
        "stream",
      ],
    },
  });
});
app.use("/api/admin", adminRouter);

app.use(notFound);
app.use(errorHandler);

const server = app.listen(config.port, config.host, () => {
  console.log("");
  console.log("  ◆ Venue On My Plate API");
  console.log(`  ◆ ${config.env} · v${config.version} · node ${process.version}`);
  console.log(`  ◆ Listening   http://${config.host}:${config.port}`);
  console.log(`  ◆ Public API  ${config.apiPublicUrl}/api/v1/public`);
  console.log(`  ◆ Admin API   ${config.apiPublicUrl}/api/admin`);
  console.log(`  ◆ Frontend    ${config.frontendUrl}`);
  console.log(`  ◆ Admin       ${config.adminUrl}`);
  if (seedResult.created) {
    console.log("");
    console.log("  ◆ First-run admin account created:");
    console.log(`     ${seedResult.email}`);
    console.log("     Change the password after signing in.");
  }
  console.log("");
});

function shutdown(signal) {
  console.log(`\n[api] ${signal} received — closing gracefully…`);
  server.close(async () => {
    await closeDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (error) => console.error("[api] unhandled rejection", error));
