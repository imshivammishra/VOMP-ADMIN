export type Role = "admin" | "editor" | "viewer";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "suspended";
  createdAt: string;
  lastLoginAt: string | null;
  assignedCount?: number;
  activeSessions?: number;
}

export interface Venue {
  id: string;
  slug: string;
  name: string;
  city: string;
  citySlug: string;
  area: string;
  type: string;
  setting: "Indoor" | "Outdoor" | "Indoor + Outdoor";
  capacityMin: number;
  capacityMax: number;
  priceHint: string;
  image: string;
  imageAlt: string;
  shortDescription: string;
  description: string;
  amenities: string[];
  eventTypes: string[];
  featured: boolean;
  status: "published" | "draft" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface Destination {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  image: string;
  imageAlt: string;
  venueCountLabel: string;
  popularTypes: string[];
  status: "published" | "draft";
  createdAt: string;
  updatedAt: string;
}

export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  publishedOn: string;
  readingMinutes: number;
  image: string;
  imageAlt: string;
  body: string[];
  status: "published" | "draft";
  createdAt: string;
  updatedAt: string;
}

export type EnquiryStatus = "new" | "contacted" | "qualified" | "won" | "lost" | "closed";
export type Priority = "low" | "normal" | "high" | "urgent";

export interface EnquiryNote {
  id: string;
  text: string;
  author: string;
  at: string;
}

export interface Enquiry {
  id: string;
  reference: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  eventType: string;
  eventDate: string;
  guestCount: string;
  message: string;
  source: string;
  status: EnquiryStatus;
  priority: Priority;
  assignee: string;
  tags: string[];
  notes: EnquiryNote[];
  firstResponseAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Thread {
  id: string;
  reference: string;
  customerName: string;
  phone: string;
  email: string;
  city: string;
  channel: string;
  status: "open" | "waiting" | "resolved";
  assignee: string;
  unreadAdmin: number;
  unreadCustomer: number;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  lastMessage: string;
}

export interface Message {
  id: string;
  threadId: string;
  sender: "customer" | "admin" | "bot" | "system";
  body: string;
  meta: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
}

export interface Partner {
  id: string;
  reference: string;
  venueName: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  venueType: string;
  rooms: number;
  website: string;
  message: string;
  status: "new" | "reviewing" | "verified" | "active" | "declined";
  createdAt: string;
  updatedAt: string;
}

export interface MediaItem {
  id: string;
  filename: string;
  originalName: string;
  mime: string;
  size: number;
  url: string;
  alt: string;
  kind: string;
  uploadedBy: string;
  createdAt: string;
}

export type ContentSection =
  | "heading"
  | "hero"
  | "ticker"
  | "about"
  | "category"
  | "feature"
  | "step"
  | "gallery"
  | "film"
  | "faq"
  | "seo"
  | "cta";

export interface ContentBlock {
  id: string;
  section: ContentSection;
  blockKey: string;
  title: string;
  subtitle: string;
  body: string;
  image: string;
  imageAlt: string;
  linkLabel: string;
  linkHref: string;
  icon: string;
  meta: Record<string, unknown>;
  sortOrder: number;
  status: "published" | "draft";
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  name: string;
  context: string;
  quote: string;
  rating: number;
  image: string;
  venueSlug: string;
  featured: boolean;
  sortOrder: number;
  status: "published" | "draft";
  createdAt: string;
  updatedAt: string;
}

export interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string | null;
  detail: string;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    hasMore: boolean;
    counts?: Record<string, number>;
    unread?: number;
  };
}

export interface Overview {
  generatedAt: string;
  stats: {
    totalEnquiries: number;
    newEnquiries: number;
    todayEnquiries: number;
    yesterdayEnquiries: number;
    weekEnquiries: number;
    prevWeekEnquiries: number;
    wonEnquiries: number;
    conversionRate: number;
    unreadMessages: number;
    openThreads: number;
    liveVenues: number;
    draftVenues: number;
    publishedPosts: number;
    newPartners: number;
    totalPartners: number;
    avgResponseHours: number | null;
    realtimeClients: number;
  };
  trend: { date: string; enquiries: number }[];
  sources: { source: string; count: number }[];
  statuses: { status: EnquiryStatus; count: number }[];
  cities: { city: string; count: number }[];
  assignees: { assignee: string; count: number; won: number }[];
  partnerStatuses: { status: string; count: number }[];
  recentEnquiries: Enquiry[];
  recentThreads: Thread[];
  recentActivity: ActivityItem[];
}

export interface Settings {
  general: {
    brandName: string;
    tagline: string;
    email: string;
    phone: string;
    whatsapp: string;
    address: string;
    hours: string;
    responseNote: string;
    instagram: string;
    footerNote: string;
  };
  notifications: {
    newEnquiryEmail: boolean;
    newMessageEmail: boolean;
    partnerEmail: boolean;
    dailyDigest: boolean;
    browserSound: boolean;
    digestEmail: string;
  };
  api: {
    frontendUrl: string;
    apiUrl: string;
    adminUrl: string;
    environment: string;
    corsOrigins: string[];
  };
  security: {
    sessionHours: number;
    loginAlerts: boolean;
    requireStrongPasswords: boolean;
  };
}

export interface ServiceStatus {
  key: string;
  label: string;
  host: string;
  url: string;
  status: "online" | "healthy" | "degraded" | "offline" | "unknown";
  latencyMs: number;
  message: string;
  meta?: string;
  httpStatus?: number;
}

export interface Connections {
  checkedAt: string;
  services: ServiceStatus[];
  counts: Record<string, number>;
  database: { path: string; bytes: number; quickCheck: string; latencyMs: number; journalMode: string };
  storage: { path: string; files: number; bytes: number };
  runtime: { node: string; platform: string; uptimeSeconds: number; rssMb: number; environment: string };
  domains: {
    frontend: string;
    api: string;
    admin: string;
    cookieDomain: string;
    origins: string[];
  };
}

export interface EnvironmentInfo {
  node: string;
  platform: string;
  environment: string;
  version: string;
  uptimeSeconds: number;
  memoryMb: number;
  domains: Record<string, string>;
  flags: {
    secureCookies: boolean;
    trustProxy: number;
    sessionHours: number;
    maxUploadMb: number;
    maxVideoMb: number;
    allowedOrigins: string[];
  };
  secrets: Record<string, string>;
  checkedAt: string;
}

export interface SearchResults {
  query: string;
  enquiries: { id: string; reference: string; name: string; phone: string; city: string; status: string; href: string }[];
  threads: { id: string; reference: string; customer_name: string; phone: string; city: string; status: string; href: string }[];
  venues: { id: string; name: string; city: string; status: string; href: string }[];
  posts: { id: string; title: string; category: string; status: string; href: string }[];
  partners: { id: string; reference: string; venue_name: string; contact_name: string; city: string; status: string; href: string }[];
}
