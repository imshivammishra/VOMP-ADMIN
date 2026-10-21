import { nowIso, parseJson, sql } from "../db.js";
import { config } from "../config.js";

export const SETTINGS_DEFAULTS = {
  general: {
    brandName: "Venue On My Plate",
    tagline: "Luxury venues · India",
    email: "contact@venueonmyplate.in",
    phone: "+91 94624 60555",
    whatsapp: "+91 94624 60555",
    address: "Udaipur · Jaipur · Goa · Delhi NCR · Mumbai",
    hours: "Mon–Sat, 9:30am – 7:00pm IST",
    responseNote: "Replies within one business day",
    instagram: "https://instagram.com/venueonmyplate",
    footerNote: "Luxury venue discovery, bespoke proposal support, and partner onboarding across India.",
  },
  notifications: {
    newEnquiryEmail: true,
    newMessageEmail: true,
    partnerEmail: true,
    dailyDigest: false,
    browserSound: true,
    digestEmail: "team@venueonmyplate.in",
  },
  api: {
    frontendUrl: config.frontendUrl,
    apiUrl: config.apiPublicUrl,
    adminUrl: config.adminUrl,
    environment: config.env,
    corsOrigins: config.allowedOrigins,
  },
  security: {
    sessionHours: config.sessionHours,
    loginAlerts: true,
    requireStrongPasswords: true,
  },
};

export function getSettings() {
  const output = structuredClone(SETTINGS_DEFAULTS);
  for (const row of sql.all("SELECT key, value FROM settings")) {
    if (row.key in output) {
      output[row.key] = { ...output[row.key], ...parseJson(row.value, {}) };
    }
  }
  return output;
}

export function getSetting(key) {
  return getSettings()[key] ?? null;
}

export function saveSettings(patch) {
  const now = nowIso();
  const current = getSettings();
  const next = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in SETTINGS_DEFAULTS)) continue;
    next[key] = { ...(current[key] || {}), ...value };
    sql.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      key,
      JSON.stringify(next[key]),
      now
    );
  }
  return next;
}
