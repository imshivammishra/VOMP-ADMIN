"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  Check,
  Copy,
  Database,
  Globe2,
  HardDrive,
  KeyRound,
  Laptop,
  LockKeyhole,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Wifi,
} from "lucide-react";
import { api, copyText } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { Connections, EnvironmentInfo, Settings } from "@/lib/types";
import { cn, formatBytes, formatDateTime, timeAgo } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Field,
  Input,
  PageHeader,
  Skeleton,
  Tabs,
  Textarea,
} from "@/components/ui";

const TABS = [
  { value: "general", label: "General" },
  { value: "api", label: "API & domains" },
  { value: "security", label: "Security" },
];

interface SessionRow {
  id: string;
  current: boolean;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  ip: string;
  userAgent: string;
}

const SERVICE_ICONS: Record<string, typeof Server> = {
  api: Server,
  database: Database,
  storage: HardDrive,
  frontend: Globe2,
  admin: Laptop,
  realtime: Wifi,
};

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "h-2 w-2 ",
        status === "online" || status === "healthy"
          ? "bg-ink live-dot"
          : status === "degraded"
            ? "bg-[#a3a3a3]"
            : status === "offline"
              ? "bg-[#6b6b6b]"
              : "bg-[#d4d4d4]"
      )}
    />
  );
}

export default function SettingsPage() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState("general");
  const [form, setForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [changing, setChanging] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<SessionRow | null>(null);
  const [revoking, setRevoking] = useState(false);

  const { data, mutate } = useSWR<Settings>("/api/admin/settings", (path: string) => api<Settings>(path));
  const { data: connections, mutate: mutateConnections, isValidating: checking } = useSWR<Connections>(
    "/api/admin/health/connections",
    (path: string) => api<Connections>(path)
  );
  const { data: environment } = useSWR<EnvironmentInfo>(
    user?.role === "admin" ? "/api/admin/settings/environment" : null,
    (path: string) => api<EnvironmentInfo>(path),
    { shouldRetryOnError: false }
  );
  const { data: sessions, mutate: mutateSessions } = useSWR<SessionRow[]>(
    "/api/admin/auth/sessions",
    (path: string) => api<SessionRow[]>(path)
  );

  useEffect(() => {
    if (data && !form) setForm(structuredClone(data));
  }, [data, form]);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const updated = await api<Settings>("/api/admin/settings", {
        method: "PUT",
        body: { [tab]: form[tab as keyof Settings] },
      });
      setForm(updated);
      await mutate();
      toast("Settings saved");
    } catch (error) {
      toast("Could not save settings", { description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (!password.currentPassword || !password.newPassword) {
      toast("Fill in your current and new password", { tone: "error" });
      return;
    }
    if (password.newPassword !== password.confirm) {
      toast("The new passwords do not match", { tone: "error" });
      return;
    }
    if (password.newPassword.length < 10) {
      toast("Use at least 10 characters", { tone: "error" });
      return;
    }
    setChanging(true);
    try {
      await api("/api/admin/auth/change-password", {
        method: "POST",
        body: { currentPassword: password.currentPassword, newPassword: password.newPassword },
      });
      setPassword({ currentPassword: "", newPassword: "", confirm: "" });
      await Promise.all([refresh(), mutateSessions()]);
      toast("Password changed", { description: "Every other session has been signed out." });
    } catch (error) {
      toast("Could not change password", { description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setChanging(false);
    }
  }

  async function revokeSession() {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await api(`/api/admin/auth/sessions/${revokeTarget.id}`, { method: "DELETE" });
      toast("Session signed out");
      setRevokeTarget(null);
      await mutateSessions();
    } catch (error) {
      toast("Could not revoke session", { description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setRevoking(false);
    }
  }

  const dirty = form && data && JSON.stringify(form) !== JSON.stringify(data);

  if (!form) {
    return (
      <div>
        <Skeleton className="h-20 w-2/3" />
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Skeleton className="h-[430px] " />
          <Skeleton className="h-[430px] " />
        </div>
      </div>
    );
  }

  const apiUrl = connections?.domains?.api || form.api.apiUrl;
  const siteUrl = connections?.domains?.frontend || form.api.frontendUrl;
  const websiteEnv = `NEXT_PUBLIC_API_URL=/\nAPI_INTERNAL_URL=${apiUrl}\nNEXT_PUBLIC_SITE_URL=${siteUrl}`;

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Settings"
        description="Workspace identity, connection details and enforced security controls — all in one place."
        actions={
          tab === "general" ? (
            <>
              <Button variant="secondary" icon={RefreshCw} onClick={() => { mutate(); mutateConnections(); mutateSessions(); }} loading={checking}>
                Recheck
              </Button>
              <Button variant="primary" icon={Save} onClick={save} loading={saving} disabled={!dirty}>
                Save changes
              </Button>
            </>
          ) : (
            <Button variant="secondary" icon={RefreshCw} onClick={() => { mutateConnections(); mutateSessions(); }} loading={checking}>
              Recheck
            </Button>
          )
        }
      />

      <div className="mb-4"><Tabs tabs={TABS} value={tab} onChange={setTab} /></div>

      {tab === "general" && (
        <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
          <Card className="p-5">
            <p className="text-[9.5px] font-bold tracking-[0.18em] text-[#525252] uppercase">Brand identity</p>
            <h2 className="font-display mt-0.5 text-[27px] leading-none font-semibold text-ink">Public details</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Brand name"><Input value={form.general.brandName} onChange={(event) => setForm({ ...form, general: { ...form.general, brandName: event.target.value } })} /></Field>
              <Field label="Tagline"><Input value={form.general.tagline} onChange={(event) => setForm({ ...form, general: { ...form.general, tagline: event.target.value } })} /></Field>
              <Field label="Contact email"><Input type="email" value={form.general.email} onChange={(event) => setForm({ ...form, general: { ...form.general, email: event.target.value } })} /></Field>
              <Field label="Contact phone"><Input value={form.general.phone} onChange={(event) => setForm({ ...form, general: { ...form.general, phone: event.target.value } })} /></Field>
              <Field label="WhatsApp"><Input value={form.general.whatsapp} onChange={(event) => setForm({ ...form, general: { ...form.general, whatsapp: event.target.value } })} /></Field>
              <Field label="Instagram"><Input value={form.general.instagram} onChange={(event) => setForm({ ...form, general: { ...form.general, instagram: event.target.value } })} /></Field>
              <Field label="Office coverage" className="sm:col-span-2"><Input value={form.general.address} onChange={(event) => setForm({ ...form, general: { ...form.general, address: event.target.value } })} /></Field>
              <Field label="Working hours"><Input value={form.general.hours} onChange={(event) => setForm({ ...form, general: { ...form.general, hours: event.target.value } })} /></Field>
              <Field label="Response note"><Input value={form.general.responseNote} onChange={(event) => setForm({ ...form, general: { ...form.general, responseNote: event.target.value } })} /></Field>
              <Field label="Footer description" hint="One line shown under the footer logo." className="sm:col-span-2"><Textarea rows={2} value={form.general.footerNote} onChange={(event) => setForm({ ...form, general: { ...form.general, footerNote: event.target.value } })} /></Field>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-5">
              <p className="text-[9.5px] font-bold tracking-[0.18em] text-[#525252] uppercase">Brand preview</p>
              <div className="mt-3  border border-line bg-white p-5 text-ink">
                <p className="font-display text-[24px] leading-none font-semibold tracking-[0.05em]">VENUE</p>
                <p className="mt-1.5 text-[8px] font-bold tracking-[0.26em] text-[#6b6b6b]">ON MY PLATE</p>
                <p className="mt-4 text-[11px] text-[#6b6b6b]">{form.general.tagline}</p>
                <div className="mt-4 border-t border-[#f0f0f0] pt-3 text-[10px] text-[#8a8a8a]">
                  <p>{form.general.email}</p>
                  <p>{form.general.phone}</p>
                  <p>{form.general.hours}</p>
                </div>
              </div>
              <p className="mt-3 text-[10.5px] leading-relaxed text-muted">
                These details are used across the public website, enquiry emails and concierge chat replies.
              </p>
            </Card>
            <Card className="p-5">
              <p className="flex items-center gap-1.5 text-[9px] font-bold tracking-[0.14em] text-[#525252] uppercase"><ShieldCheck size={11} /> Signed in as</p>
              <p className="mt-2 text-[13px] font-semibold text-ink">{user?.name}</p>
              <p className="text-[11px] text-muted">{user?.email}</p>
              <Badge className="mt-2 bg-[#f7f7f7] text-[#525252] ring-[#a3a3a3]/25">{user?.role}</Badge>
            </Card>
          </div>
        </div>
      )}

      {tab === "api" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Public website", connections?.domains?.frontend || form.api.frontendUrl, "Frontend · Next.js"],
              ["API application", connections?.domains?.api || form.api.apiUrl, "Express · SQLite · SSE"],
              ["Admin console", connections?.domains?.admin || form.api.adminUrl, "Private workspace"],
            ].map(([label, value, note]) => (
              <Card key={label} className="p-4">
                <p className="text-[9px] font-bold tracking-[0.14em] text-[#525252] uppercase">{label}</p>
                <p className="mt-1.5 truncate text-[12px] font-semibold text-ink" title={value}>{value}</p>
                <p className="mt-0.5 text-[10px] text-muted">{note}</p>
                <button type="button" onClick={() => copyText(value).then(() => toast("URL copied"))} className="mt-2.5 flex items-center gap-1 text-[10px] font-semibold text-[#525252] hover:underline"><Copy size={10} /> Copy</button>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-ink/6 px-5 py-4">
                <div>
                  <p className="text-[9.5px] font-bold tracking-[0.18em] text-[#525252] uppercase">Live diagnostics</p>
                  <h2 className="font-display mt-0.5 text-[26px] leading-none font-semibold text-ink">Connections</h2>
                </div>
                <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => mutateConnections()} loading={checking}>Recheck</Button>
              </div>
              <div className="divide-y divide-black/5">
                {(connections?.services || []).map((service) => {
                  const Icon = SERVICE_ICONS[service.key] || Server;
                  return (
                    <div key={service.key} className="flex items-center gap-3 px-5 py-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center  bg-[#f7f7f7] text-[#525252]"><Icon size={14} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink"><StatusDot status={service.status} /> {service.label}</p>
                        <p className="truncate text-[10px] text-muted">{service.host || service.message}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9.5px] font-semibold text-[#525252]">{service.status}</p>
                        <p className="text-[9px] text-[#a3a3a3]">{service.latencyMs}ms</p>
                      </div>
                    </div>
                  );
                })}
                {!connections && <div className="space-y-2 p-4">{[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-10" />)}</div>}
              </div>
            </Card>

            <div className="space-y-4">
              <Card className="p-5">
                <p className="text-[9.5px] font-bold tracking-[0.18em] text-[#525252] uppercase">Public API</p>
                <div className="mt-2 space-y-2">
                  {[
                    ["Enquiries", "/api/v1/public/enquiries"],
                    ["Concierge chat", "/api/v1/public/chat"],
                    ["Venues", "/api/v1/public/venues"],
                    ["Destinations", "/api/v1/public/cities"],
                    ["Journal", "/api/v1/public/blogs"],
                    ["Partners", "/api/v1/public/partners"],
                  ].map(([label, path]) => (
                    <div key={path} className="flex items-center justify-between gap-2  bg-[#f7f7f7] px-2.5 py-1.5">
                      <span className="text-[10.5px] font-medium text-[#525252]">{label}</span>
                      <code className="text-[9px] text-[#525252]">{path}</code>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <p className="text-[9.5px] font-bold tracking-[0.18em] text-[#525252] uppercase">Website environment</p>
                <pre className="scrollbar-thin mt-2 overflow-x-auto  bg-ink p-3 text-[9.5px] leading-relaxed text-[#d4d4d4]">{websiteEnv}</pre>
                <button
                  type="button"
                  onClick={() => copyText(websiteEnv).then(() => toast("Environment copied"))}
                  className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-[#525252] hover:underline"
                >
                  <Copy size={10} /> Copy variables
                </button>
                <p className="mt-2 text-[9.5px] leading-relaxed text-muted">
                  Browser requests stay same-origin. Only Next server components read the private API address.
                </p>
              </Card>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <p className="flex items-center gap-1.5 text-[9.5px] font-bold tracking-[0.18em] text-[#525252] uppercase"><Database size={11} /> Storage & runtime</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                <div><p className="text-[9px] tracking-[0.1em] text-[#a3a3a3] uppercase">Database</p><p className="mt-1 font-semibold text-ink">{formatBytes(connections?.database.bytes || 0)}</p><p className="text-[9.5px] text-muted">quick_check: {connections?.database.quickCheck || "…"}</p></div>
                <div><p className="text-[9px] tracking-[0.1em] text-[#a3a3a3] uppercase">Media storage</p><p className="mt-1 font-semibold text-ink">{formatBytes(connections?.storage.bytes || 0)}</p><p className="text-[9.5px] text-muted">{connections?.storage.files || 0} files</p></div>
                <div><p className="text-[9px] tracking-[0.1em] text-[#a3a3a3] uppercase">Node runtime</p><p className="mt-1 font-semibold text-ink">{connections?.runtime.node || environment?.node || "—"}</p><p className="text-[9.5px] text-muted">{connections?.runtime.platform}</p></div>
                <div><p className="text-[9px] tracking-[0.1em] text-[#a3a3a3] uppercase">Uptime</p><p className="mt-1 font-semibold text-ink">{Math.floor((connections?.runtime.uptimeSeconds || 0) / 60)}m</p><p className="text-[9.5px] text-muted">RSS {connections?.runtime.rssMb || 0} MB</p></div>
              </div>
            </Card>

            <Card className="p-5">
              <p className="flex items-center gap-1.5 text-[9.5px] font-bold tracking-[0.18em] text-[#525252] uppercase"><Globe2 size={11} /> CORS allowlist</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(connections?.domains.origins || form.api.corsOrigins).map((origin) => (
                  <Badge key={origin} className="bg-[#f7f7f7] text-[#525252] ring-ink/6">{origin}</Badge>
                ))}
              </div>
              <p className="mt-3 text-[10.5px] leading-relaxed text-muted">
                Configured in the API <code className=" bg-[#f7f7f7] px-1">CORS_ORIGINS</code> environment. The cookie domain is{" "}
                <span className="font-semibold text-[#525252]">{connections?.domains.cookieDomain || "host-only"}</span>.
              </p>
              {environment && (
                <div className="mt-3 grid gap-1.5 border-t border-ink/5 pt-3 text-[10.5px]">
                  <p className="flex justify-between"><span className="text-muted">Secure cookies</span><span className="font-semibold text-ink">{environment.flags.secureCookies ? "yes" : "no (local)"}</span></p>
                  <p className="flex justify-between"><span className="text-muted">Session lifetime</span><span className="font-semibold text-ink">{environment.flags.sessionHours} hours</span></p>
                  <p className="flex justify-between"><span className="text-muted">Max upload</span><span className="font-semibold text-ink">{environment.flags.maxUploadMb} MB</span></p>
                  <p className="flex justify-between"><span className="text-muted">Trust proxy</span><span className="font-semibold text-ink">{environment.flags.trustProxy}</span></p>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === "security" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-4">
            <Card className="p-5">
              <p className="flex items-center gap-1.5 text-[9.5px] font-bold tracking-[0.18em] text-[#525252] uppercase"><KeyRound size={11} /> Password</p>
              <h2 className="font-display mt-0.5 text-[27px] leading-none font-semibold text-ink">Change your password</h2>
              <div className="mt-4 space-y-3">
                <Field label="Current password"><Input type="password" value={password.currentPassword} onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} autoComplete="current-password" /></Field>
                <Field label="New password" hint="At least 10 characters. Other sessions will be signed out."><Input type="password" value={password.newPassword} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} autoComplete="new-password" /></Field>
                <Field label="Confirm new password"><Input type="password" value={password.confirm} onChange={(event) => setPassword({ ...password, confirm: event.target.value })} autoComplete="new-password" /></Field>
                <Button variant="primary" size="md" icon={LockKeyhole} loading={changing} onClick={changePassword} className="w-full">Update password</Button>
              </div>
            </Card>

            <Card className="p-5">
              <p className="text-[9.5px] font-bold tracking-[0.18em] text-[#525252] uppercase">Policy</p>
              <div className="mt-3 divide-y divide-black/5 text-[11px]">
                <div className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="font-semibold text-ink">Sign-in alerts</p>
                    <p className="mt-1 leading-relaxed text-muted">Every successful sign-in is recorded in the activity log with its IP address.</p>
                  </div>
                  <Badge className="bg-[#f7f7f7] text-[#525252] ring-[#a3a3a3]/25">Always on</Badge>
                </div>
                <div className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="font-semibold text-ink">Password minimum</p>
                    <p className="mt-1 leading-relaxed text-muted">Ten characters, enforced for every new account and password change.</p>
                  </div>
                  <Badge className="bg-[#f7f7f7] text-[#525252] ring-[#a3a3a3]/25">10+ chars</Badge>
                </div>
                <div className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="font-semibold text-ink">Session lifetime</p>
                    <p className="mt-1 leading-relaxed text-muted">
                      {environment?.flags.sessionHours ?? form.security.sessionHours} hours. Change{" "}
                      <code className=" bg-[#f7f7f7] px-1">SESSION_HOURS</code> in the API environment and restart the service.
                    </p>
                  </div>
                  <Badge className="bg-[#f7f7f7] text-[#525252] ring-[#a3a3a3]/25">{environment?.flags.sessionHours ?? form.security.sessionHours}h</Badge>
                </div>
                <div className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="font-semibold text-ink">Secure cookies</p>
                    <p className="mt-1 leading-relaxed text-muted">HttpOnly, SameSite=Lax and Secure in production, set automatically.</p>
                  </div>
                  <Badge className="bg-[#f7f7f7] text-[#525252] ring-[#a3a3a3]/25">Enforced</Badge>
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-ink/6 px-5 py-4">
                <div>
                  <p className="text-[9.5px] font-bold tracking-[0.18em] text-[#525252] uppercase">Active sessions</p>
                  <h2 className="font-display mt-0.5 text-[26px] leading-none font-semibold text-ink">Where you are signed in</h2>
                </div>
                <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => mutateSessions()}>Refresh</Button>
              </div>
              <div className="divide-y divide-black/5">
                {(sessions || []).map((session) => (
                  <div key={session.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className={cn("grid h-8 w-8 shrink-0 place-items-center ", session.current ? "bg-[#f7f7f7] text-[#525252]" : "bg-[#f7f7f7] text-muted")}><Laptop size={14} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11.5px] font-semibold text-ink">{session.current ? "This device" : session.userAgent || "Unknown device"}</p>
                      <p className="truncate text-[9.5px] text-muted">{session.ip || "unknown IP"} · last seen {timeAgo(session.lastSeenAt)}</p>
                      <p className="text-[9px] text-[#a3a3a3]">Expires {formatDateTime(session.expiresAt)}</p>
                    </div>
                    {session.current ? (
                      <Badge className="bg-ink text-white ring-ink">current</Badge>
                    ) : (
                      <button type="button" onClick={() => setRevokeTarget(session)} className="grid h-7 w-7 place-items-center  text-[#a3a3a3] hover:bg-[#f7f7f7] hover:text-ink" title="Sign out this session"><Trash2 size={13} /></button>
                    )}
                  </div>
                ))}
                {sessions && sessions.length === 0 && <p className="px-5 py-8 text-center text-[11px] text-muted">No active sessions recorded.</p>}
              </div>
            </Card>

            <Card className="p-5">
              <p className="flex items-center gap-1.5 text-[9.5px] font-bold tracking-[0.18em] text-[#525252] uppercase"><ShieldCheck size={11} /> Built-in protection</p>
              <div className="mt-3 space-y-2.5 text-[11px] leading-relaxed text-muted">
                {[
                  "Scrypt password hashing with per-user salts",
                  "Database-backed HttpOnly session cookies",
                  "CSRF origin and header checks on writes",
                  "Login lockout after repeated failures",
                  "Strict CORS allowlist and security headers",
                  "Bounded uploads and validated request payloads",
                ].map((item) => (
                  <p key={item} className="flex gap-2"><Check size={12} className="mt-0.5 shrink-0 text-[#525252]" /> {item}</p>
                ))}
              </div>
              <div className="mt-4 flex items-start gap-2  bg-[#f7f7f7] p-3 text-[10.5px] leading-relaxed text-muted">
                <TriangleAlert size={13} className="mt-0.5 shrink-0 text-[#525252]" />
                Production keeps <code className="mx-1  bg-white px-1">COOKIE_DOMAIN</code> blank. Admin and website call{" "}
                <code className="mx-1  bg-white px-1">/api</code> on their own domain, so the session is host-only and first-party.
                HTTPS makes the cookie Secure automatically.
              </div>
            </Card>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        onConfirm={revokeSession}
        title="Sign out this session?"
        description={revokeTarget ? `${revokeTarget.userAgent || "Unknown device"} · ${revokeTarget.ip || "unknown IP"}` : ""}
        confirmLabel="Sign out"
        loading={revoking}
      />
    </div>
  );
}
