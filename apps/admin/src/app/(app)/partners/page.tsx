"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowUpRight,
  Check,
  Globe2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Send,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { api, apiWithMeta, queryString } from "@/lib/api";
import { useDebounced } from "@/lib/hooks";
import { useRealtime } from "@/lib/realtime";
import { useToast } from "@/lib/toast";
import type { Partner, Venue } from "@/lib/types";
import { PARTNER_STATUS, formatDate, mailtoHref, timeAgo, toPhoneHref, whatsappHref } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Drawer,
  EmptyState,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Skeleton,
  StatusPill,
  Tabs,
  Textarea,
} from "@/components/ui";

interface ListMeta { total: number; page: number; limit: number; pages: number; hasMore: boolean; counts?: Record<string, number> }
type Envelope<T> = { data: T; meta?: ListMeta };
function fetchEnvelope<T>(url: string) { return apiWithMeta<T>(url) as Promise<Envelope<T>>; }

const TABS = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "verified", label: "Verified" },
  { value: "active", label: "Active" },
  { value: "declined", label: "Declined" },
];

export default function PartnersPage() {
  const { toast } = useToast();
  const { seq } = useRealtime();
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 280);
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Partner | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Partner | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => setPage(1), [debounced, status]);
  const url = `/api/admin/partners${queryString({ q: debounced, status, page, limit: 20 })}`;
  const { data, mutate, isValidating } = useSWR<Envelope<Partner[]>>(url, fetchEnvelope);
  useEffect(() => { if (seq > 0) mutate(); }, [seq, mutate]);

  const counts = data?.meta?.counts || {};
  const rows = data?.data || [];

  function open(partner: Partner) {
    setDetail(partner);
    setNote(partner.message);
  }

  async function update(patch: Record<string, unknown>, message: string) {
    if (!detail) return;
    setSaving(true);
    try {
      const updated = await api<Partner>(`/api/admin/partners/${detail.id}`, { method: "PATCH", body: patch });
      setDetail(updated);
      await mutate();
      toast(message);
    } catch (error) {
      toast("Could not update partner", { description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function convert() {
    if (!detail) return;
    setConverting(true);
    try {
      const result = await api<{ venue: Venue }>(`/api/admin/partners/${detail.id}/convert`, { method: "POST" });
      toast("Draft venue created", { description: `${result.venue.name} is ready to review in Venues.` });
      await mutate();
      setDetail({ ...detail, status: "verified" });
    } catch (error) {
      toast("Could not create venue", { description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setConverting(false);
    }
  }

  async function remove(partner: Partner) {
    setDeleting(true);
    try {
      await api(`/api/admin/partners/${partner.id}`, { method: "DELETE" });
      toast("Application removed", { description: partner.venueName });
      setDeleteTarget(null);
      if (detail?.id === partner.id) setDetail(null);
      await mutate();
    } catch (error) {
      toast("Could not remove application", { description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setDeleting(false);
    }
  }

  const tabs = TABS.map((tab) => ({ ...tab, count: tab.value === "all" ? (counts.all || 0) : counts[tab.value] || 0 }));

  return (
    <div>
      <PageHeader
        eyebrow="Growth"
        title="Partner applications"
        description="Venue owners who want to be listed. Verify the property, convert it into a draft venue and keep the relationship moving."
        actions={<Button variant="secondary" icon={RefreshCw} onClick={() => mutate()} loading={isValidating}>Refresh</Button>}
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <SearchInput value={query} onChange={setQuery} placeholder="Search venue, contact, city or reference…" className="w-full lg:max-w-[380px]" />
          <p className="text-[10.5px] text-muted">{counts.new || 0} new applications waiting for review</p>
        </div>
      </Card>

      <div className="mb-3 overflow-x-auto"><Tabs tabs={tabs} value={status} onChange={setStatus} /></div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[900px]">
            <thead><tr><th>Venue</th><th>Contact</th><th>City</th><th>Rooms</th><th>Status</th><th>Received</th><th /></tr></thead>
            <tbody>
              {rows.map((partner) => (
                <tr key={partner.id} className="cursor-pointer" onClick={() => open(partner)}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center  bg-[#f7f7f7] text-[#525252]"><Star size={14} /></span>
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold text-ink">{partner.venueName}</p>
                        <p className="truncate text-[10.5px] text-muted">{partner.venueType || "Venue"} · {partner.reference}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <p className="text-[11.5px] font-medium text-[#525252]">{partner.contactName}</p>
                    <p className="text-[10.5px] text-muted">{partner.email}</p>
                  </td>
                  <td><span className="flex items-center gap-1 text-[11px] text-[#525252]"><MapPin size={10} className="text-[#a3a3a3]" /> {partner.city || "—"}</span></td>
                  <td><span className="text-[11px] text-[#525252]">{partner.rooms || "—"}</span></td>
                  <td><StatusPill value={partner.status} map={PARTNER_STATUS} /></td>
                  <td><p className="text-[10.5px] text-muted">{timeAgo(partner.createdAt)}</p><p className="text-[9.5px] text-[#b3b3b3]">{formatDate(partner.createdAt)}</p></td>
                  <td><ArrowUpRight size={13} className="text-[#a3a3a3]" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data && <div className="space-y-3 p-4">{[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-14" />)}</div>}
        {data && rows.length === 0 && <EmptyState icon={Star} title="No applications" description="New partner applications from the website will appear here." />}
        {data?.meta && <Pagination page={data.meta.page} pages={data.meta.pages} total={data.meta.total} limit={data.meta.limit} onPage={setPage} />}
      </Card>

      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.venueName || "Partner application"}
        subtitle={detail ? `${detail.reference} · received ${formatDate(detail.createdAt)}` : ""}
        size="lg"
        footer={detail ? (
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" icon={Trash2} className="text-[#6b6b6b] hover:bg-[#f7f7f7] hover:text-ink" onClick={() => setDeleteTarget(detail)}>Delete</Button>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" icon={Globe2} onClick={convert} loading={converting}>Create draft venue</Button>
              <Button variant="primary" size="sm" icon={Check} loading={saving} onClick={() => update({ status: "verified", message: note }, "Application verified")}>Verify</Button>
            </div>
          </div>
        ) : null}
      >
        {detail && (
          <div className="divide-y divide-black/6">
            <div className="flex flex-wrap items-center gap-2 px-5 py-4">
              <Select value={detail.status} onChange={(event) => update({ status: event.target.value }, "Status updated")} className="h-9 w-auto min-w-[135px] py-0 text-[12px]">
                {Object.entries(PARTNER_STATUS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
              </Select>
              <div className="ml-auto flex items-center gap-1.5">
                <a href={toPhoneHref(detail.phone)} className="grid h-8 w-8 place-items-center  bg-[#f7f7f7] text-[#525252] hover:bg-ink hover:text-white" title="Call"><Phone size={13} /></a>
                <a href={whatsappHref(detail.phone, `Hi ${detail.contactName.split(" ")[0]}, this is Venue On My Plate.`)} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center  bg-[#f7f7f7] text-[#525252] hover:bg-ink hover:text-white" title="WhatsApp"><Send size={13} /></a>
                <a href={mailtoHref(detail.email, `Venue On My Plate partnership — ${detail.venueName}`)} className="grid h-8 w-8 place-items-center  bg-[#f7f7f7] text-[#525252] hover:bg-[#525252] hover:text-white" title="Email"><Mail size={13} /></a>
              </div>
            </div>
            <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
              <div>
                <p className="text-[9px] font-bold tracking-[0.12em] text-[#a3a3a3] uppercase">Contact</p>
                <p className="mt-1 text-[12.5px] font-semibold text-ink">{detail.contactName}</p>
                <p className="text-[11px] text-muted">{detail.email}</p>
                <p className="text-[11px] text-muted">{detail.phone}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold tracking-[0.12em] text-[#a3a3a3] uppercase">Property</p>
                <p className="mt-1 text-[12.5px] font-semibold text-ink">{detail.venueType || "Venue"}</p>
                <p className="text-[11px] text-muted">{detail.city} {detail.rooms ? `· ${detail.rooms} rooms` : ""}</p>
                {detail.website && <a href={detail.website} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#525252] hover:underline">Visit website <ArrowUpRight size={10} /></a>}
              </div>
            </div>
            <div className="px-5 py-5">
              <p className="text-[9px] font-bold tracking-[0.12em] text-[#a3a3a3] uppercase">Application message</p>
              <Textarea rows={5} value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 text-[12px]" />
              <div className="mt-2 flex justify-end"><Button variant="secondary" size="sm" loading={saving} onClick={() => update({ message: note }, "Message updated")}>Save note</Button></div>
            </div>
            <div className=" bg-[#f7f7f7] p-3 text-[10.5px] leading-relaxed text-muted">
              <Badge className="mr-2 bg-white text-[#525252] ring-[#a3a3a3]/25">{detail.status}</Badge>
              Creating a draft venue copies the partner&apos;s name, city, type and message into the catalogue — you can enrich it before publishing.
            </div>
            <div className="flex items-center justify-between px-5 py-3 text-[10px] text-[#a3a3a3]">
              <span className="flex items-center gap-1"><Users size={10} /> Added {timeAgo(detail.createdAt)}</span>
              <Link href="/venues" className="flex items-center gap-1 font-semibold text-[#525252] hover:underline">Open venues <ArrowUpRight size={10} /></Link>
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && remove(deleteTarget)} title="Remove this application?" description={deleteTarget ? `${deleteTarget.reference} · ${deleteTarget.venueName}` : ""} loading={deleting} />
    </div>
  );
}
