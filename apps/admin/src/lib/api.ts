export const API_BASE = (() => {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  // Older builds used /api-backend, which the API does not expose. Treat it as
  // the same-origin root so requests still reach /api/... through Next/Nginx.
  const normalized = configured === "/api-backend" ? "" : configured;
  const raw = normalized ?? (process.env.NODE_ENV === "production" ? "" : "http://localhost:3101");
  return raw.replace(/\/+$/, "");
})();

export class ApiError extends Error {
  status: number;
  code: string;
  details?: { field: string; message: string }[];

  constructor(status: number, code: string, message: string, details?: { field: string; message: string }[]) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  skipAuthRedirect?: boolean;
};

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuthRedirect, headers, ...rest } = options;
  const isForm = body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "X-VOMP-CSRF": "1",
      ...(isForm ? {} : body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(headers || {}),
    },
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    if (response.status === 401 && !skipAuthRedirect && typeof window !== "undefined") {
      window.dispatchEvent(new Event("vomp:unauthorized"));
    }
    const error = payload?.error;
    throw new ApiError(
      response.status,
      error?.code || "REQUEST_FAILED",
      error?.message || `Request failed with HTTP ${response.status}.`,
      error?.details
    );
  }

  return (payload?.data ?? payload) as T;
}

export async function apiWithMeta<T = unknown>(path: string, options: RequestOptions = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "X-VOMP-CSRF": "1",
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
    body:
      options.body instanceof FormData
        ? options.body
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("vomp:unauthorized"));
    }
    const error = payload?.error;
    throw new ApiError(response.status, error?.code || "REQUEST_FAILED", error?.message || "Request failed.", error?.details);
  }
  return payload as { data: T; meta?: Record<string, unknown> };
}

export const fetcher = <T = unknown>(path: string) => api<T>(path);

export function queryString(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === "all") continue;
    search.set(key, String(value));
  }
  const suffix = search.toString();
  return suffix ? `?${suffix}` : "";
}

export async function downloadFile(path: string, filename: string) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "X-VOMP-CSRF": "1" },
  });
  if (!response.ok) throw new Error("Download failed. Please try again.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const area = document.createElement("textarea");
  area.value = value;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}
