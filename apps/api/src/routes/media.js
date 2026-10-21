import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { nowIso, paginationMeta, sql, uid } from "../db.js";
import { asyncHandler, HttpError, ok, parse, parsePagination } from "../lib/http.js";
import { mediaUpdateSchema } from "../lib/schemas.js";
import { mediaRow } from "../lib/serializers.js";
import { actorName, logActivity } from "../lib/activity.js";
import { requireRole } from "../lib/auth.js";
import { config } from "../config.js";
import { broadcast } from "../lib/realtime.js";

const IMAGE_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/avif", ".avif"],
  ["image/gif", ".gif"],
]);

const VIDEO_TYPES = new Map([
  ["video/mp4", ".mp4"],
  ["video/webm", ".webm"],
  ["video/quicktime", ".mov"],
  ["video/x-m4v", ".m4v"],
]);

const ALLOWED = new Map([...IMAGE_TYPES, ...VIDEO_TYPES]);

function detectMime(filePath) {
  let descriptor;
  try {
    descriptor = fs.openSync(filePath, "r");
    const header = Buffer.alloc(24);
    const bytes = fs.readSync(descriptor, header, 0, 24, 0);
    if (bytes < 12) return null;
    const hex = header.subarray(0, bytes).toString("hex");
    const ascii = header.subarray(0, bytes).toString("latin1");
    if (hex.startsWith("ffd8ff")) return "image/jpeg";
    if (hex.startsWith("89504e470d0a1a0a")) return "image/png";
    if (hex.startsWith("4749463837") || hex.startsWith("4749463839")) return "image/gif";
    if (hex.startsWith("52494646") && ascii.slice(8, 12) === "WEBP") return "image/webp";
    if (hex.startsWith("1a45dfa3")) return "video/webm";
    if (ascii.slice(4, 8) !== "ftyp") return null;
    const brand = ascii.slice(8, 12);
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (brand === "qt  ") return "video/quicktime";
    if (brand.startsWith("M4V")) return "video/x-m4v";
    return "video/mp4";
  } catch {
    return null;
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {
        /* already closed */
      }
    }
  }
}

function removeFile(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* best effort */
  }
}

fs.mkdirSync(path.join(config.uploadsDir, "library"), { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, path.join(config.uploadsDir, "library"));
  },
  filename: (_req, file, callback) => {
    const ext = ALLOWED.get(file.mimetype) || ".bin";
    callback(null, `${Date.now().toString(36)}-${crypto.randomBytes(6).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxVideoBytes, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED.has(file.mimetype)) {
      return callback(new HttpError(422, "UNSUPPORTED_FILE", "Use a JPG, PNG, WebP, AVIF or GIF image, or an MP4, WebM, MOV or M4V video."));
    }
    callback(null, true);
  },
});

export const mediaRouter = Router();

mediaRouter.get(
  "/",
  asyncHandler((req, res) => {
    const { page, limit, offset } = parsePagination(req.query, { limit: 24, maxLimit: 100 });
    const where = [];
    const params = [];
    if (req.query.q) {
      where.push("(original_name LIKE ? OR alt LIKE ? OR filename LIKE ?)");
      params.push(`%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`);
    }
    const kind = String(req.query.kind || "").trim();
    if (kind === "image") {
      where.push("kind IN ('image', 'external')");
    } else if (kind === "video") {
      where.push("kind = 'video'");
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const total = sql.get(`SELECT COUNT(*) AS count FROM media ${clause}`, ...params).count;
    const rows = sql.all(
      `SELECT * FROM media ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset
    );
    const counts = { all: 0, image: 0, video: 0 };
    for (const row of sql.all("SELECT kind, COUNT(*) AS count FROM media GROUP BY kind")) {
      const bucket = row.kind === "video" ? "video" : "image";
      counts[bucket] += row.count;
      counts.all += row.count;
    }
    ok(res, rows.map((row) => mediaRow(row)), { ...paginationMeta(total, page, limit), counts });
  })
);

mediaRouter.post(
  "/",
  requireRole("admin", "editor"),
  upload.single("file"),
  asyncHandler((req, res) => {
    if (!req.file) throw new HttpError(422, "NO_FILE", "Choose an image or video to upload.");
    const detectedMime = detectMime(req.file.path);
    if (!detectedMime || detectedMime !== req.file.mimetype) {
      removeFile(req.file.path);
      throw new HttpError(
        422,
        "INVALID_FILE",
        "This file does not match its image or video type. Re-export it and try again."
      );
    }
    const isVideo = req.file.mimetype.startsWith("video/");
    if (!isVideo && req.file.size > config.maxUploadBytes) {
      removeFile(req.file.path);
      throw new HttpError(
        422,
        "FILE_TOO_LARGE",
        `Images can be up to ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB.`
      );
    }
    const id = uid("med_");
    const url = `/uploads/library/${req.file.filename}`;
    try {
      sql.run(
        `INSERT INTO media (id, filename, original_name, mime, size, url, alt, kind, uploaded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        req.file.filename,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        url,
        "",
        isVideo ? "video" : "image",
        req.user.name,
        nowIso()
      );
    } catch (error) {
      removeFile(req.file.path);
      throw error;
    }
    const media = mediaRow(sql.get("SELECT * FROM media WHERE id = ?", id));
    logActivity({
      actor: actorName(req),
      action: "media.uploaded",
      entity: "media",
      entityId: id,
      detail: `${req.file.originalname} · ${(req.file.size / 1024).toFixed(0)} KB`,
    });
    broadcast("media:changed", { media });
    ok(res, media, undefined, 201);
  })
);

mediaRouter.patch(
  "/:id",
  requireRole("admin", "editor"),
  asyncHandler((req, res) => {
    const row = sql.get("SELECT * FROM media WHERE id = ?", req.params.id);
    if (!row) throw new HttpError(404, "NOT_FOUND", "Media item not found.");
    const input = parse(mediaUpdateSchema)(req.body);
    sql.run("UPDATE media SET alt = ? WHERE id = ?", input.alt, row.id);
    ok(res, mediaRow(sql.get("SELECT * FROM media WHERE id = ?", row.id)));
  })
);

mediaRouter.delete(
  "/:id",
  requireRole("admin", "editor"),
  asyncHandler((req, res) => {
    const row = sql.get("SELECT * FROM media WHERE id = ?", req.params.id);
    if (!row) throw new HttpError(404, "NOT_FOUND", "Media item not found.");
    if (row.url.startsWith("/uploads/")) {
      const filePath = path.join(config.uploadsDir, row.url.replace("/uploads/", ""));
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* already removed */
      }
    }
    sql.run("DELETE FROM media WHERE id = ?", row.id);
    logActivity({
      actor: actorName(req),
      action: "media.deleted",
      entity: "media",
      entityId: row.id,
      detail: row.original_name,
    });
    broadcast("media:changed", { deleted: row.id });
    ok(res, { ok: true });
  })
);
