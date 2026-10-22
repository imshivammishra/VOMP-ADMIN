import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "..");

const env = process.env.NODE_ENV || "development";
const isProd = env === "production";
const port = Number(process.env.PORT || 3101);

function cleanUrl(value, fallback) {
  return (value || fallback).replace(/\/+$/, "");
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function parseOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const frontendUrl = cleanUrl(process.env.FRONTEND_URL, "http://localhost:3100");
const adminUrl = cleanUrl(process.env.ADMIN_URL, "http://localhost:3102");
const apiPublicUrl = cleanUrl(process.env.API_PUBLIC_URL, `http://localhost:${port}`);

const seedPassword = process.env.SEED_ADMIN_PASSWORD?.trim() || (isProd ? "" : "Venue@2026");
const seedEmail = (process.env.SEED_ADMIN_EMAIL || "admin@venueonmyplate.in").trim().toLowerCase();

if (isProd) {
  const insecurePassword =
    !seedPassword ||
    seedPassword.length < 12 ||
    /replace|change[-_ ]?me|venue@2026/i.test(seedPassword);
  if (insecurePassword) {
    throw new Error(
      "SEED_ADMIN_PASSWORD must be set to a unique value of at least 12 characters in production."
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(seedEmail)) {
    throw new Error("SEED_ADMIN_EMAIL must be a valid email address in production.");
  }
}

// Development is often opened through the machine's LAN address or a preview
// host. Include local interface addresses on the three app ports so CORS keeps
// working without editing .env for every network change. Production remains
// restricted to the explicit origins below.
const localHosts = new Set(["localhost", "127.0.0.1", os.hostname()]);
if (!isProd) {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) localHosts.add(entry.address);
    }
  }
}
const localOrigins = [
  frontendUrl,
  adminUrl,
  apiPublicUrl,
  ...[...localHosts].flatMap((host) =>
    [3000, 3001, 3002, 3100, 3101, 3102].map((port) => `http://${host}:${port}`)
  ),
];

const productionOrigins = [frontendUrl, adminUrl, apiPublicUrl];

const defaultOrigins = isProd ? productionOrigins : localOrigins;

export const config = {
  env,
  isProd,
  port,
  host: process.env.HOST || (isProd ? "127.0.0.1" : "0.0.0.0"),
  version: process.env.APP_VERSION || "1.0.0",
  apiPublicUrl,
  frontendUrl,
  adminUrl,
  allowedOrigins: [...new Set([...parseOrigins(process.env.CORS_ORIGINS), ...defaultOrigins])],
  trustProxy: Number(process.env.TRUST_PROXY || 0),
  dbPath: path.resolve(ROOT, process.env.DB_PATH || "data/vomp.sqlite"),
  uploadsDir: path.resolve(ROOT, process.env.UPLOADS_DIR || "uploads"),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB || 8) * 1024 * 1024,
  maxVideoBytes: Number(process.env.MAX_VIDEO_MB || 80) * 1024 * 1024,
  sessionHours: Number(process.env.SESSION_HOURS || 12),
  cookie: {
    name: "vomp_admin_session",
    domain: process.env.COOKIE_DOMAIN || undefined,
    // Secure cookies are required behind HTTPS. Allow an explicit opt-out for
    // temporary HTTP/IP testing; never rely on this for a public deployment.
    secure: parseBoolean(process.env.COOKIE_SECURE, isProd),
  },
  seedAdmin: {
    name: process.env.SEED_ADMIN_NAME || "Administrator",
    email: seedEmail,
    password: seedPassword,
  },
};

if (isProd && !config.cookie.secure) {
  console.warn(
    "[api] COOKIE_SECURE=false — session cookies are not marked Secure. Use this only for temporary HTTP testing and enable HTTPS as soon as possible."
  );
}
