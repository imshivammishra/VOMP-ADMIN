import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "..");

const env = process.env.NODE_ENV || "development";
const isProd = env === "production";
const port = Number(process.env.PORT || 8081);

function cleanUrl(value, fallback) {
  return (value || fallback).replace(/\/+$/, "");
}

function parseOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const frontendUrl = cleanUrl(process.env.FRONTEND_URL, "http://localhost:3000");
const adminUrl = cleanUrl(process.env.ADMIN_URL, "http://localhost:3002");
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

const localOrigins = [
  frontendUrl,
  adminUrl,
  apiPublicUrl,
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
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
    secure: isProd,
  },
  seedAdmin: {
    name: process.env.SEED_ADMIN_NAME || "Administrator",
    email: seedEmail,
    password: seedPassword,
  },
};
