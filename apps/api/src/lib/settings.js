import { collections, nowIso, parseJson } from "../db.js";
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

export async function getSettings() {
  const output = structuredClone(SETTINGS_DEFAULTS);
  const rows = await collections.settings.find({}).toArray();
  for (const row of rows) {
    const key = row.key || row._id;
    if (key in output) {
      output[key] = { ...output[key], ...parseJson(row.value, {}) };
    }
  }
  return output;
}

export async function getSetting(key) {
  return (await getSettings())[key] ?? null;
}

export async function saveSettings(patch) {
  const now = nowIso();
  const current = await getSettings();
  const next = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in SETTINGS_DEFAULTS)) continue;
    next[key] = { ...(current[key] || {}), ...value };
    await collections.settings.updateOne(
      { _id: key },
      { $set: { key, value: next[key], updated_at: now } },
      { upsert: true }
    );
  }
  return next;
}
