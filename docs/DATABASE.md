# Database

Venue On My Plate uses **SQLite in WAL mode** through Node's built-in
`node:sqlite` driver. It is a real SQL database with no native build dependency
and no separate database server to secure on the VPS.

## Location

| Environment | Path |
| --- | --- |
| Local | `apps/api/data/vomp.sqlite` |
| Production | `/var/www/vomp/shared/data/vomp.sqlite` |

Production data, uploads, backups and env files live outside the Git working
trees under `/var/www/vomp/shared/`, so deploys never overwrite them.

## Tables

### Identity and audit

- `users` — team accounts, roles (`admin`, `editor`, `viewer`), status, last login
- `sessions` — hashed session tokens, expiry, IP and user agent
- `activity` — append-only audit trail shown in the console

### Demand

- `enquiries` — leads, event details, source, status, priority and assignee
- `threads` — concierge conversations and unread counters
- `messages` — messages attached to a thread
- `partners` — venue-owner applications and review status

### Catalogue and publishing

- `venues` — public venue catalogue
- `destinations` — city pages
- `posts` — journal stories
- `content_blocks` — homepage sections grouped by `section` + `block_key`, with
  ordering, draft/published status and arbitrary `meta` JSON
- `reviews` — client reviews, rating, venue link, feature flag, order and status
- `media` — uploaded image/video metadata and relative `/uploads/...` URL
- `settings` — site identity, contact details, social links and feature toggles

All tables use `TEXT` ISO-8601 timestamps in UTC and snake_case columns. List
queries use indexed status, ordering or creation columns.

## Bootstrap and migrations

`src/db.js` opens the database, applies `src/schema.sql` idempotently with
`CREATE TABLE IF NOT EXISTS`, and enables WAL + foreign keys. Small additive
column changes are applied defensively at startup. The schema file is the source
of truth for fresh installs.

For a schema change:

1. Start from an empty local database and update `src/schema.sql`.
2. Add a safe additive migration guard in `db.js` for existing databases.
3. Run the seed and smoke test.
4. Back up production before deploying.

## Backup

```bash
sudo -u vomp bash /var/www/vomp/workspace/deploy/scripts/backup.sh
```

The script uses SQLite's online `.backup` command to produce a consistent copy,
then gzips it into `/var/www/vomp/shared/backups/`. It retains 14 days by
default. Copy backups off the VPS as well.

## Restore

```bash
sudo -u vomp pm2 stop vomp-api
sudo -u vomp cp /var/www/vomp/shared/backups/vomp-YYYY-MM-DD.sqlite.gz /tmp/restore.sqlite.gz
sudo -u vomp gunzip -f /tmp/restore.sqlite.gz
sudo -u vomp cp /tmp/restore.sqlite /var/www/vomp/shared/data/vomp.sqlite
sudo -u vomp pm2 start vomp-api
```

Remove stale `-wal` and `-shm` files while the API is stopped if restoring over
an existing database. Verify with:

```bash
sudo -u vomp sqlite3 /var/www/vomp/shared/data/vomp.sqlite "PRAGMA quick_check;"
```

## Operational queries

```sql
-- Enquiries by status
SELECT status, COUNT(*) FROM enquiries GROUP BY status ORDER BY 2 DESC;

-- Published content sections
SELECT section, COUNT(*) FROM content_blocks
WHERE status = 'published' GROUP BY section;

-- Published reviews in display order
SELECT name, rating, featured, sort_order FROM reviews
WHERE status = 'published' ORDER BY sort_order, created_at;

-- Recent audit activity
SELECT created_at, actor, action, detail FROM activity
ORDER BY created_at DESC LIMIT 50;
```

## Why SQLite is appropriate

This is a single-writer admin workload with a small team and modest read volume.
SQLite avoids a network hop and a second service to harden. WAL mode allows
concurrent readers during writes. The API can move to Postgres later if write
concurrency grows; route modules and serializers isolate most SQL access.
