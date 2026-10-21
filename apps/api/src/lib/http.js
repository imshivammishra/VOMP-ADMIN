export class HttpError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function ok(res, data, meta = undefined, status = 200) {
  const payload = { data };
  if (meta !== undefined) payload.meta = meta;
  return res.status(status).json(payload);
}

export function created(res, data, meta = undefined) {
  return ok(res, data, meta, 201);
}

export function parsePagination(query, defaults = {}) {
  const page = Math.max(1, Number.parseInt(query.page || defaults.page || "1", 10) || 1);
  const maxLimit = defaults.maxLimit || 100;
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit || defaults.limit || "25", 10) || 25));
  return { page, limit, offset: (page - 1) * limit };
}

export function parse(handler) {
  return (value) => {
    const result = handler.safeParse(value);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      throw new HttpError(422, "VALIDATION_ERROR", "Some fields need your attention.", details);
    }
    return result.data;
  };
}

export function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const string = String(value);
  if (/[",\n\r]/.test(string)) return `"${string.replaceAll('"', '""')}"`;
  return string;
}

export function toCsv(rows, columns) {
  const header = columns.map((column) => csvEscape(column.label)).join(",");
  const body = rows
    .map((row) => columns.map((column) => csvEscape(column.value(row))).join(","))
    .join("\r\n");
  return `\uFEFF${header}\r\n${body}`;
}

export function clientIp(req) {
  return (req.headers["x-forwarded-for"] || req.ip || "").toString().split(",")[0].trim();
}

export function intBool(value) {
  return value === true || value === 1 || value === "1" || value === "true" ? 1 : 0;
}

export function asString(value, fallback = "") {
  return value === null || value === undefined ? fallback : String(value).trim();
}
