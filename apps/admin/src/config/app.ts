/**
 * Application-level constants. Keep values that affect routing, storage or
 * product identity here instead of scattering string literals through pages.
 */
export const APP = {
  name: "Venue On My Plate",
  console: "Operations console",
  tagline: "Private venue operations",
  supportEmail: "hello@venueonmyplate.in",
} as const;

export const STORAGE_KEYS = {
  sidebar: "vomp.sidebar.collapsed",
} as const;

export const PAGE_SIZE = {
  default: 25,
  media: 24,
  compact: 10,
} as const;
