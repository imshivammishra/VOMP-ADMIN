import { twMerge } from "tailwind-merge";

export function cn(...classes: Array<string | false | null | undefined>) {
  return twMerge(classes.filter(Boolean).join(" "));
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function titleCase(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN").format(value || 0);
}

export function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  }).format(date);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function timeAgo(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value).getTime();
  if (Number.isNaN(date)) return value;
  const seconds = Math.round((Date.now() - date) / 1000);
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.round(seconds / 86400)}d ago`;
  return formatDate(value);
}

export function toPhoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function whatsappHref(phone: string, message?: string) {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${normalized}${query}`;
}

export function mailtoHref(email: string, subject?: string) {
  return `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
}

export function pct(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export const ENQUIRY_STATUS: Record<string, { label: string; className: string; dot: string }> = {
  new: { label: "New", className: "bg-black text-white ring-black", dot: "bg-white" },
  contacted: { label: "Contacted", className: "bg-neutral-100 text-neutral-700 ring-neutral-300", dot: "bg-neutral-500" },
  qualified: { label: "Qualified", className: "bg-neutral-200 text-black ring-neutral-300", dot: "bg-black" },
  won: { label: "Won", className: "bg-black text-white ring-black", dot: "bg-white" },
  lost: { label: "Lost", className: "bg-white text-neutral-500 ring-neutral-300", dot: "bg-neutral-400" },
  closed: { label: "Closed", className: "bg-neutral-50 text-neutral-400 ring-neutral-200", dot: "bg-neutral-300" },
};

export const PRIORITY: Record<string, { label: string; className: string }> = {
  urgent: { label: "Urgent", className: "bg-black text-white ring-black" },
  high: { label: "High", className: "bg-neutral-800 text-white ring-neutral-800" },
  normal: { label: "Normal", className: "bg-neutral-100 text-neutral-700 ring-neutral-200" },
  low: { label: "Low", className: "bg-white text-neutral-400 ring-neutral-200" },
};

export const THREAD_STATUS: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-black text-white ring-black" },
  waiting: { label: "Waiting", className: "bg-neutral-200 text-black ring-neutral-300" },
  resolved: { label: "Resolved", className: "bg-neutral-100 text-neutral-600 ring-neutral-200" },
};

export const PARTNER_STATUS: Record<string, { label: string; className: string }> = {
  new: { label: "New", className: "bg-black text-white ring-black" },
  reviewing: { label: "Reviewing", className: "bg-neutral-200 text-black ring-neutral-300" },
  verified: { label: "Verified", className: "bg-neutral-100 text-neutral-700 ring-neutral-300" },
  active: { label: "Active", className: "bg-black text-white ring-black" },
  declined: { label: "Declined", className: "bg-white text-neutral-400 ring-neutral-200" },
};

export const PUBLISH_STATUS: Record<string, { label: string; className: string }> = {
  published: { label: "Published", className: "bg-black text-white ring-black" },
  draft: { label: "Draft", className: "bg-neutral-200 text-black ring-neutral-300" },
  archived: { label: "Archived", className: "bg-neutral-100 text-neutral-500 ring-neutral-200" },
};

export const SOURCE_LABEL: Record<string, string> = {
  website: "Website",
  "concierge-chat": "Concierge chat",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  referral: "Referral",
  "website-chat": "Website chat",
  manual: "Manual",
};

export function sourceLabel(source: string) {
  return SOURCE_LABEL[source] || titleCase(source || "Unknown");
}

export function avatarTone(value: string) {
  const tones = [
    "bg-[#0a0a0a] text-white",
    "bg-[#262626] text-white",
    "bg-[#404040] text-white",
    "bg-[#171717] text-white",
    "bg-[#525252] text-white",
    "bg-[#737373] text-white",
  ];
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) % 997;
  return tones[hash % tones.length];
}

export function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
