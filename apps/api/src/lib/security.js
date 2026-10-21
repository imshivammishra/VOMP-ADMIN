import crypto from "node:crypto";
import { config } from "../config.js";
import { clientIp } from "./http.js";

export function corsOptions() {
  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (config.allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed`));
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-VOMP-CSRF", "X-Requested-With"],
    exposedHeaders: ["X-Request-Id"],
    maxAge: 86400,
  };
}

export function helmetOptions() {
  return {
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  };
}

export function requestId(req, res, next) {
  req.id = req.headers["x-request-id"] || crypto.randomBytes(8).toString("hex");
  res.setHeader("X-Request-Id", req.id);
  next();
}

export function requestLogger(req, res, next) {
  const started = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - started) / 1_000_000;
    if (req.path.startsWith("/uploads/")) return;
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(0)}ms`;
    if (res.statusCode >= 500) console.error(`[api] ${line}`);
    else if (!config.isProd) console.log(`[api] ${line}`);
  });
  next();
}

const buckets = new Map();

export function rateLimit({ windowMs, max, keyPrefix = "", message = "Too many requests. Please slow down." }) {
  return (req, res, next) => {
    const key = `${keyPrefix}:${clientIp(req)}`;
    const current = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= current) {
      bucket = { count: 0, resetAt: current + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    const remaining = Math.max(0, max - bucket.count);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - current) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ error: { code: "RATE_LIMITED", message } });
    }
    next();
  };
}

setInterval(() => {
  const current = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= current) buckets.delete(key);
  }
}, 60_000).unref();

export function csrfGuard(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (origin && config.allowedOrigins.includes(origin)) return next();
  if (req.get("x-vomp-csrf") === "1") return next();
  return res.status(403).json({
    error: { code: "CSRF_REJECTED", message: "Request origin could not be verified." },
  });
}

export function errorHandler(error, req, res, _next) {
  if (res.headersSent) return;
  let status = error.status || 500;
  let code = error.code || (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR");
  let message = error.message || "Request failed.";
  if (error.code === "LIMIT_FILE_SIZE") {
    status = 413;
    code = "FILE_TOO_LARGE";
    message = "That image is larger than the upload limit.";
  }
  if (error.name === "MulterError") {
    status = 422;
    code = "UPLOAD_REJECTED";
    message = error.message;
  }
  if (status >= 500) console.error(`[api] ${req.method} ${req.originalUrl}`, error);
  const payload = {
    error: {
      code,
      message:
        status >= 500 && config.isProd
          ? "Something went wrong on our side. Please try again."
          : message,
    },
  };
  if (error.details) payload.error.details = error.details;
  res.status(status).json(payload);
}

export function notFound(req, res) {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `No route matches ${req.method} ${req.originalUrl}.` },
  });
}
