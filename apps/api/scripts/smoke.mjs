import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "vomp-smoke-"));
const port = 18100 + Math.floor(Math.random() * 400);
const base = `http://127.0.0.1:${port}`;
const email = "smoke-admin@venueonmyplate.test";
const password = "SmokeTestOnly!2026";

const env = {
  ...process.env,
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: String(port),
  DB_PATH: path.join(temp, "vomp.sqlite"),
  UPLOADS_DIR: path.join(temp, "uploads"),
  SEED_ADMIN_NAME: "Smoke Admin",
  SEED_ADMIN_EMAIL: email,
  SEED_ADMIN_PASSWORD: password,
  FRONTEND_URL: "http://127.0.0.1:3999",
  ADMIN_URL: "http://127.0.0.1:3998",
  API_PUBLIC_URL: base,
  CORS_ORIGINS: "",
  TRUST_PROXY: "0",
};

let output = "";
const child = spawn(process.execPath, ["src/server.js"], {
  cwd: root,
  env,
  stdio: ["ignore", "pipe", "pipe"],
});

child.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

function fail(message) {
  throw new Error(`${message}\n\nAPI output:\n${output}`);
}

async function request(pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, options);
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function waitForApi() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) fail(`API exited during startup with code ${child.exitCode}.`);
    try {
      const { response } = await request("/api/health");
      if (response.ok) return;
    } catch {
      /* server still starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  fail("API did not become healthy within 20 seconds.");
}

async function main() {
  await waitForApi();

  const health = await request("/api/health");
  if (!health.response.ok || health.body?.ok !== true || health.body?.database !== "ok") {
    fail(`Health endpoint returned HTTP ${health.response.status}.`);
  }

  const settings = await request("/api/v1/public/settings");
  if (!settings.response.ok || !settings.body?.data) {
    fail(`Public settings endpoint returned HTTP ${settings.response.status}.`);
  }

  const venues = await request("/api/v1/public/venues");
  if (!venues.response.ok || !Array.isArray(venues.body?.data)) {
    fail(`Public venues endpoint returned HTTP ${venues.response.status}.`);
  }
  if (venues.body.data.length !== 0) {
    fail("Fresh seed must not fabricate venue records. Add real venues from the admin console.");
  }

  const login = await request("/api/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-VOMP-CSRF": "1" },
    body: JSON.stringify({ email, password }),
  });
  if (!login.response.ok || !login.body?.data?.user?.id) {
    fail(`Login failed with HTTP ${login.response.status}: ${login.body?.error?.message || "unknown error"}`);
  }

  const cookie = (login.response.headers.get("set-cookie") || "").split(";")[0];
  if (!cookie) fail("Login did not return a session cookie.");

  const me = await request("/api/admin/auth/me", {
    headers: { Cookie: cookie },
  });
  if (!me.response.ok || me.body?.data?.user?.email !== email) {
    fail(`Session check failed with HTTP ${me.response.status}.`);
  }

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl5sAAAAASUVORK5CYII=",
    "base64"
  );
  const form = new FormData();
  form.set("file", new Blob([png], { type: "image/png" }), "smoke.png");
  const upload = await request("/api/admin/media", {
    method: "POST",
    headers: { Cookie: cookie, "X-VOMP-CSRF": "1" },
    body: form,
  });
  if (upload.response.status !== 201 || upload.body?.data?.kind !== "image") {
    fail(`PNG upload failed with HTTP ${upload.response.status}: ${upload.body?.error?.message || ""}`);
  }

  const invalid = new FormData();
  invalid.set("file", new Blob([Buffer.from("not a real png")], { type: "image/png" }), "invalid.png");
  const rejected = await request("/api/admin/media", {
    method: "POST",
    headers: { Cookie: cookie, "X-VOMP-CSRF": "1" },
    body: invalid,
  });
  if (rejected.response.status !== 422) {
    fail(`Disguised upload should be rejected with 422, got ${rejected.response.status}.`);
  }

  const removed = await request(`/api/admin/media/${upload.body.data.id}`, {
    method: "DELETE",
    headers: { Cookie: cookie, "X-VOMP-CSRF": "1" },
  });
  if (!removed.response.ok) fail(`Media cleanup failed with HTTP ${removed.response.status}.`);

  console.log("API smoke test passed: health, content, login, session and media validation.");}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (child.exitCode === null) child.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (child.exitCode === null) child.kill("SIGKILL");
    fs.rmSync(temp, { recursive: true, force: true });
  });
