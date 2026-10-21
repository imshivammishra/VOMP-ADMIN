PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor', 'viewer')),
  password_hash TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at    TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  ip           TEXT,
  user_agent   TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS venues (
  id                TEXT PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  city              TEXT NOT NULL,
  city_slug         TEXT NOT NULL,
  area              TEXT NOT NULL DEFAULT '',
  type              TEXT NOT NULL DEFAULT '',
  setting           TEXT NOT NULL DEFAULT 'Indoor',
  capacity_min      INTEGER NOT NULL DEFAULT 0,
  capacity_max      INTEGER NOT NULL DEFAULT 0,
  price_hint        TEXT,
  image             TEXT,
  image_alt         TEXT,
  short_description TEXT NOT NULL DEFAULT '',
  description       TEXT NOT NULL DEFAULT '',
  amenities         TEXT NOT NULL DEFAULT '[]',
  event_types       TEXT NOT NULL DEFAULT '[]',
  featured          INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft', 'archived')),
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_venues_status ON venues(status);
CREATE INDEX IF NOT EXISTS idx_venues_city ON venues(city_slug);
CREATE INDEX IF NOT EXISTS idx_venues_featured ON venues(featured);

CREATE TABLE IF NOT EXISTS destinations (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  tagline         TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',
  image           TEXT,
  image_alt       TEXT,
  venue_count_label TEXT NOT NULL DEFAULT '',
  popular_types   TEXT NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_destinations_status ON destinations(status);

CREATE TABLE IF NOT EXISTS posts (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  excerpt         TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT 'Journal',
  author          TEXT NOT NULL DEFAULT 'Venue On My Plate Studio',
  published_on    TEXT NOT NULL,
  reading_minutes INTEGER NOT NULL DEFAULT 5,
  image           TEXT,
  image_alt       TEXT,
  body            TEXT NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);

CREATE TABLE IF NOT EXISTS enquiries (
  id               TEXT PRIMARY KEY,
  reference        TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  phone            TEXT NOT NULL,
  email            TEXT,
  city             TEXT NOT NULL DEFAULT '',
  event_type       TEXT NOT NULL DEFAULT '',
  event_date       TEXT NOT NULL DEFAULT '',
  guest_count      TEXT NOT NULL DEFAULT '',
  message          TEXT NOT NULL DEFAULT '',
  source           TEXT NOT NULL DEFAULT 'website',
  status           TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'won', 'lost', 'closed')),
  priority         TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assignee         TEXT NOT NULL DEFAULT '',
  tags             TEXT NOT NULL DEFAULT '[]',
  notes            TEXT NOT NULL DEFAULT '[]',
  ip               TEXT,
  user_agent       TEXT,
  first_response_at TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_enquiries_created ON enquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);
CREATE INDEX IF NOT EXISTS idx_enquiries_source ON enquiries(source);
CREATE INDEX IF NOT EXISTS idx_enquiries_assignee ON enquiries(assignee);

CREATE TABLE IF NOT EXISTS threads (
  id               TEXT PRIMARY KEY,
  reference        TEXT NOT NULL UNIQUE,
  customer_name    TEXT NOT NULL DEFAULT 'Website visitor',
  phone            TEXT NOT NULL DEFAULT '',
  email            TEXT,
  city             TEXT NOT NULL DEFAULT '',
  channel          TEXT NOT NULL DEFAULT 'website-chat',
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting', 'resolved')),
  assignee         TEXT NOT NULL DEFAULT '',
  unread_admin     INTEGER NOT NULL DEFAULT 0,
  unread_customer  INTEGER NOT NULL DEFAULT 0,
  last_message_at  TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_threads_last ON threads(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_status ON threads(status);

CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY,
  thread_id  TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  sender     TEXT NOT NULL CHECK (sender IN ('customer', 'admin', 'bot', 'system')),
  body       TEXT NOT NULL,
  meta       TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  read_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, created_at);

CREATE TABLE IF NOT EXISTS partners (
  id           TEXT PRIMARY KEY,
  reference    TEXT NOT NULL UNIQUE,
  venue_name   TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email        TEXT NOT NULL,
  phone        TEXT NOT NULL,
  city         TEXT NOT NULL DEFAULT '',
  venue_type   TEXT NOT NULL DEFAULT '',
  rooms        INTEGER NOT NULL DEFAULT 0,
  website      TEXT,
  message      TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'verified', 'active', 'declined')),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status);

CREATE TABLE IF NOT EXISTS media (
  id            TEXT PRIMARY KEY,
  filename      TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime          TEXT NOT NULL,
  size          INTEGER NOT NULL DEFAULT 0,
  url           TEXT NOT NULL,
  alt           TEXT NOT NULL DEFAULT '',
  kind          TEXT NOT NULL DEFAULT 'image',
  uploaded_by   TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_created ON media(created_at DESC);

CREATE TABLE IF NOT EXISTS activity (
  id         TEXT PRIMARY KEY,
  actor      TEXT NOT NULL,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT,
  detail     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity(created_at DESC);

CREATE TABLE IF NOT EXISTS content_blocks (
  id         TEXT PRIMARY KEY,
  section    TEXT NOT NULL,
  block_key  TEXT NOT NULL DEFAULT '',
  title      TEXT NOT NULL DEFAULT '',
  subtitle   TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL DEFAULT '',
  image      TEXT NOT NULL DEFAULT '',
  image_alt  TEXT NOT NULL DEFAULT '',
  link_label TEXT NOT NULL DEFAULT '',
  link_href  TEXT NOT NULL DEFAULT '',
  icon       TEXT NOT NULL DEFAULT '',
  meta       TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_content_section ON content_blocks(section, sort_order);

CREATE TABLE IF NOT EXISTS reviews (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  context    TEXT NOT NULL DEFAULT '',
  quote      TEXT NOT NULL,
  rating     INTEGER NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  image      TEXT NOT NULL DEFAULT '',
  venue_slug TEXT NOT NULL DEFAULT '',
  featured   INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status, sort_order);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
