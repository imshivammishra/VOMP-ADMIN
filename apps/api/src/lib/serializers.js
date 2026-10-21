import { parseJson } from "../db.js";

export function venueRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    city: row.city,
    citySlug: row.city_slug,
    area: row.area,
    type: row.type,
    setting: row.setting,
    capacityMin: row.capacity_min,
    capacityMax: row.capacity_max,
    priceHint: row.price_hint || "",
    image: row.image || "",
    imageAlt: row.image_alt || "",
    shortDescription: row.short_description,
    description: row.description,
    amenities: parseJson(row.amenities, []),
    eventTypes: parseJson(row.event_types, []),
    featured: Boolean(row.featured),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function destinationRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    image: row.image || "",
    imageAlt: row.image_alt || "",
    venueCountLabel: row.venue_count_label,
    popularTypes: parseJson(row.popular_types, []),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function postRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category,
    author: row.author,
    publishedOn: row.published_on,
    readingMinutes: row.reading_minutes,
    image: row.image || "",
    imageAlt: row.image_alt || "",
    body: parseJson(row.body, []),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function enquiryRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    reference: row.reference,
    name: row.name,
    phone: row.phone,
    email: row.email || "",
    city: row.city,
    eventType: row.event_type,
    eventDate: row.event_date,
    guestCount: row.guest_count,
    message: row.message,
    source: row.source,
    status: row.status,
    priority: row.priority,
    assignee: row.assignee,
    tags: parseJson(row.tags, []),
    notes: parseJson(row.notes, []),
    firstResponseAt: row.first_response_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function threadRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    reference: row.reference,
    customerName: row.customer_name,
    phone: row.phone,
    email: row.email || "",
    city: row.city,
    channel: row.channel,
    status: row.status,
    assignee: row.assignee,
    unreadAdmin: row.unread_admin,
    unreadCustomer: row.unread_customer,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessage: row.last_message || "",
  };
}

export function messageRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    threadId: row.thread_id,
    sender: row.sender,
    body: row.body,
    meta: parseJson(row.meta, {}),
    createdAt: row.created_at,
    readAt: row.read_at || null,
  };
}

export function partnerRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    reference: row.reference,
    venueName: row.venue_name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    city: row.city,
    venueType: row.venue_type,
    rooms: row.rooms,
    website: row.website || "",
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mediaRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    filename: row.filename,
    originalName: row.original_name,
    mime: row.mime,
    size: row.size,
    url: row.url,
    alt: row.alt,
    kind: row.kind,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

export function contentBlockRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    section: row.section,
    blockKey: row.block_key,
    title: row.title,
    subtitle: row.subtitle,
    body: row.body,
    image: row.image,
    imageAlt: row.image_alt,
    linkLabel: row.link_label,
    linkHref: row.link_href,
    icon: row.icon,
    meta: parseJson(row.meta, {}),
    sortOrder: row.sort_order,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function reviewRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    context: row.context,
    quote: row.quote,
    rating: row.rating,
    image: row.image,
    venueSlug: row.venue_slug,
    featured: Boolean(row.featured),
    sortOrder: row.sort_order,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function userRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at || null,
  };
}

export function activityRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    actor: row.actor,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    detail: row.detail,
    createdAt: row.created_at,
  };
}
