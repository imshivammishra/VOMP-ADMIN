"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  ArrowDownToLine,
  CalendarDays,
  Check,
  ChevronRight,
  Copy,
  FilterX,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  Plus,
  RefreshCw,
  Send,
  Tags,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { api, apiWithMeta, copyText, downloadFile, queryString } from "@/lib/api";
import { useDebounced } from "@/lib/hooks";
import { useRealtime } from "@/lib/realtime";
import { useToast } from "@/lib/toast";
import type { Destination, Enquiry, User } from "@/lib/types";
import {
  ENQUIRY_STATUS,
  PRIORITY,
  cn,
  formatDate,
  formatDateTime,
  mailtoHref,
  sourceLabel,
  timeAgo,
  toPhoneHref,
  whatsappHref,
} from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Drawer,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Skeleton,
  StatusPill,
  Tabs,
  Textarea,
} from "@/components/ui";

interface ListMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasMore: boolean;
  counts?: Record<string, number>;
}
type Envelope<T> = { data: T; meta?: ListMeta };

function fetchEnvelope<T>(url: string) {
  return apiWithMeta<T>(url) as Promise<Envelope<T>>;
}

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "closed", label: "Closed" },
];

const SOURCES = [
  ["all", "All sources"],
  ["website", "Website"],
  ["concierge-chat", "Concierge chat"],
  ["whatsapp", "WhatsApp"],
  ["instagram", "Instagram"],
  ["referral", "Referral"],
];

function EnquiriesView() {
  const params = useSearchParams();
  const { toast } = useToast();
  const { seq } = useRealtime();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 280);
  const [status, setStatus] = useState(params.get("status") || "all");
  const [source, setSource] = useState("all");
  const [priority, setPriority] = useState("all");
  const [city, setCity] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Enquiry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Enquiry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const lastFocus = useRef<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, status, source, priority, city, assignee, sort]);

  const listParams = {
    q: debouncedQuery,
    status,
    source,
    priority,
    city,
    assignee,
    sort,
    page,
    limit: 25,
  };
  const url = `/api/admin/enquiries${queryString(listParams)}`;

  const { data, mutate, isValidating } = useSWR<Envelope<Enquiry[]>>(url, fetchEnvelope);
  const { data: destinations } = useSWR<Envelope<Destination[]>>(
    "/api/admin/destinations?limit=50",
    fetchEnvelope
  );
  const { data: team } = useSWR<User[]>("/api/admin/team/assignees", (path: string) => api<User[]>(path));

  useEffect(() => {
    if (seq > 0) mutate();
  }, [seq, mutate]);

  const focus = params.get("focus");
  useEffect(() => {
    if (!focus || lastFocus.current === focus) return;
    lastFocus.current = focus;
    setDetailLoading(true);
    api<Enquiry>(`/api/admin/enquiries/${focus}`)
      .then((enquiry) => {
        setDetail(enquiry);
        setTagDraft(enquiry.tags.join(", "));
      })
      .catch(() => toast("Could not open that enquiry", { tone: "error" }))
      .finally(() => setDetailLoading(false));
  }, [focus, toast]);

  const counts = data?.meta?.counts || {};
  const rows = data?.data || [];
  const allSelected = rows.length > 0 && rows.every((row) => selected.includes(row.id));

  const activeFilters = useMemo(
    () => [source, priority, city, assignee].filter((value) => value !== "all").length,
    [source, priority, city, assignee]
  );

  function openEnquiry(enquiry: Enquiry) {
    setDetail(enquiry);
    setTagDraft(enquiry.tags.join(", "));
  }

  async function updateEnquiry(patch: Record<string, unknown>, message?: string) {
    if (!detail) return;
    setSaving(true);
    try {
      const updated = await api<Enquiry>(`/api/admin/enquiries/${detail.id}`, { method: "PATCH", body: patch });
      setDetail(updated);
      setTagDraft(updated.tags.join(", "));
      await mutate();
      if (message) toast(message);
    } catch (error) {
      toast("Could not save changes", {
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    if (!note.trim()) return;
    await updateEnquiry({ note: note.trim() }, "Internal note added");
    setNote("");
  }

  async function removeEnquiry(enquiry: Enquiry) {
    setDeleting(true);
    try {
      await api(`/api/admin/enquiries/${enquiry.id}`, { method: "DELETE" });
      toast("Enquiry removed", { description: `${enquiry.reference} · ${enquiry.name}` });
      setDeleteTarget(null);
      if (detail?.id === enquiry.id) setDetail(null);
      await mutate();
    } catch (error) {
      toast("Could not remove enquiry", {
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setDeleting(false);
    }
  }

  async function bulk(action: "status" | "priority" | "assignee" | "delete", value?: string) {
    if (!selected.length) return;
    if (action === "delete" && !window.confirm(`Remove ${selected.length} enquiries? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await api("/api/admin/enquiries/bulk", {
        method: "POST",
        body: { ids: selected, action, value },
      });
      toast(
        action === "delete" ? `${selected.length} enquiries removed` : `${selected.length} enquiries updated`,
        { description: action === "delete" ? undefined : `Set ${action} to ${value}` }
      );
      setSelected([]);
      await mutate();
    } catch (error) {
      toast("Bulk action failed", {
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function exportCsv() {
    try {
      await downloadFile(
        `/api/admin/enquiries/export.csv${queryString({ q: debouncedQuery, status, source, priority, city, assignee })}`,
        `vomp-enquiries-${new Date().toISOString().slice(0, 10)}.csv`
      );
      toast("Export ready", { description: "The filtered enquiries have been downloaded." });
    } catch {
      toast("Export failed", { tone: "error" });
    }
  }

  function clearFilters() {
    setSource("all");
    setPriority("all");
    setCity("all");
    setAssignee("all");
    setStatus("all");
    setQuery("");
    setSort("newest");
  }

  const tabs = STATUS_TABS.map((tab) => ({
    ...tab,
    count: tab.value === "all" ? counts.all : counts[tab.value] || 0,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Lead desk"
        title="Enquiries"
        description="Every request from the website, concierge chat and WhatsApp — with ownership, priority and the full follow-up trail."
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={() => mutate()} loading={isValidating}>
              Refresh
            </Button>
            <Button variant="secondary" icon={ArrowDownToLine} onClick={exportCsv}>
              Export CSV
            </Button>
          </>
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search name, phone, email, reference, city…"
            className="w-full xl:max-w-[380px]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={source} onChange={(event) => setSource(event.target.value)} className="h-9 w-auto min-w-[135px] py-0 text-[12px]">
              {SOURCES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select value={priority} onChange={(event) => setPriority(event.target.value)} className="h-9 w-auto min-w-[125px] py-0 text-[12px]">
              <option value="all">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </Select>
            <Button variant="secondary" size="sm" onClick={() => setShowFilters((value) => !value)}>
              <Users size={13} /> Team
              {activeFilters > 0 && <span className="ml-0.5  bg-ink px-1.5 text-[9px] text-white">{activeFilters}</span>}
            </Button>
            <Select value={sort} onChange={(event) => setSort(event.target.value)} className="h-9 w-auto min-w-[135px] py-0 text-[12px]">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="priority">By priority</option>
              <option value="updated">Recently updated</option>
            </Select>
            {(activeFilters > 0 || query || status !== "all") && (
              <button type="button" onClick={clearFilters} className="flex items-center gap-1 text-[10.5px] font-semibold text-[#525252] hover:underline">
                <FilterX size={12} /> Clear
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="mt-3 grid gap-3 border-t border-ink/5 pt-3 sm:grid-cols-3">
            <Field label="City">
              <Select value={city} onChange={(event) => setCity(event.target.value)}>
                <option value="all">All cities</option>
                {(destinations?.data || []).map((destination) => (
                  <option key={destination.id} value={destination.name}>
                    {destination.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Assigned to">
              <Select value={assignee} onChange={(event) => setAssignee(event.target.value)}>
                <option value="all">Anyone</option>
                <option value="">Unassigned</option>
                {(team || []).map((member) => (
                  <option key={member.id} value={member.name}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              <p className="text-[11px] leading-relaxed text-muted">
                Filters combine with the status tabs and search. Exports respect the same filters.
              </p>
            </div>
          </div>
        )}
      </Card>

      <div className="mb-3 overflow-x-auto pb-0.5">
        <Tabs
          tabs={tabs}
          value={status}
          onChange={(value) => {
            setStatus(value);
            setSelected([]);
          }}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[980px]">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() =>
                      setSelected(allSelected ? [] : rows.map((row) => row.id))
                    }
                    aria-label="Select all enquiries"
                    className="h-3.5 w-3.5 accent-[#0a0a0a]"
                  />
                </th>
                <th>Contact</th>
                <th>Event</th>
                <th>City</th>
                <th>Source</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Received</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((enquiry) => (
                <tr
                  key={enquiry.id}
                  className={cn("group cursor-pointer", selected.includes(enquiry.id) && "bg-[#f7f7f7]/60")}
                  onClick={() => openEnquiry(enquiry)}
                >
                  <td onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.includes(enquiry.id)}
                      onChange={() =>
                        setSelected((current) =>
                          current.includes(enquiry.id)
                            ? current.filter((id) => id !== enquiry.id)
                            : [...current, enquiry.id]
                        )
                      }
                      aria-label={`Select ${enquiry.reference}`}
                      className="h-3.5 w-3.5 accent-[#0a0a0a]"
                    />
                  </td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={enquiry.name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold text-ink">{enquiry.name}</p>
                        <p className="truncate text-[10.5px] text-muted">{enquiry.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <p className="text-[11.5px] font-medium text-[#525252]">{enquiry.eventType || "Celebration"}</p>
                    <p className="text-[10.5px] text-muted">
                      {enquiry.guestCount || "—"} · {enquiry.eventDate || "flexible"}
                    </p>
                  </td>
                  <td>
                    <span className="text-[11px] text-[#525252]">{enquiry.city || "—"}</span>
                  </td>
                  <td>
                    <Badge className="bg-[#f7f7f7] text-[#525252] ring-ink/6">{sourceLabel(enquiry.source)}</Badge>
                  </td>
                  <td>
                    <StatusPill value={enquiry.status} map={ENQUIRY_STATUS} />
                  </td>
                  <td>
                    <StatusPill value={enquiry.priority} map={PRIORITY} />
                  </td>
                  <td>
                    <p className="whitespace-nowrap text-[10.5px] text-muted">{timeAgo(enquiry.createdAt)}</p>
                    <p className="whitespace-nowrap text-[9.5px] text-[#b3b3b3]">{enquiry.reference}</p>
                  </td>
                  <td>
                    <span className="grid h-7 w-7 place-items-center  text-[#a3a3a3] transition-colors group-hover:bg-[#f7f7f7] group-hover:text-[#525252]">
                      <ChevronRight size={14} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!data && (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3, 4].map((row) => (
              <Skeleton key={row} className="h-12" />
            ))}
          </div>
        )}

        {data && rows.length === 0 && (
          <EmptyState
            icon={MessageSquareText}
            title="No enquiries match"
            description="Try clearing the filters or search term. New website enquiries arrive here in realtime."
            action={
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        )}

        {data?.meta && (
          <Pagination
            page={data.meta.page}
            pages={data.meta.pages}
            total={data.meta.total}
            limit={data.meta.limit}
            onPage={setPage}
          />
        )}
      </Card>

      {selected.length > 0 && (
        <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2  border border-white/10 bg-ink px-3 py-2.5 text-white  lg:left-[calc(50%+134px)]">
          <span className="px-2 text-[11px] font-semibold">{selected.length} selected</span>
          <div className="h-5 w-px bg-white/15" />
          <Select
            defaultValue=""
            onChange={(event) => {
              if (event.target.value) bulk("status", event.target.value);
              event.target.value = "";
            }}
            className="h-8 min-w-[125px] border-white/15 bg-white/10 py-0 text-[11px] text-white"
          >
            <option value="">Set status…</option>
            {Object.entries(ENQUIRY_STATUS).map(([value, item]) => (
              <option key={value} value={value} className="text-ink">
                {item.label}
              </option>
            ))}
          </Select>
          <Select
            defaultValue=""
            onChange={(event) => {
              if (event.target.value) bulk("priority", event.target.value);
              event.target.value = "";
            }}
            className="hidden h-8 min-w-[115px] border-white/15 bg-white/10 py-0 text-[11px] text-white sm:block"
          >
            <option value="">Priority…</option>
            {Object.entries(PRIORITY).map(([value, item]) => (
              <option key={value} value={value} className="text-ink">
                {item.label}
              </option>
            ))}
          </Select>
          <Button variant="danger" size="sm" icon={Trash2} onClick={() => bulk("delete")} disabled={saving}>
            Delete
          </Button>
          <button type="button" onClick={() => setSelected([])} aria-label="Clear selection" className="grid h-7 w-7 place-items-center  text-white/50 hover:bg-white/10 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      <Drawer
        open={Boolean(detail) || detailLoading}
        onClose={() => {
          setDetail(null);
          setDetailLoading(false);
          setNote("");
        }}
        title={detail ? detail.name : "Loading enquiry"}
        subtitle={detail ? `${detail.reference} · received ${formatDateTime(detail.createdAt)}` : "Fetching the latest record…"}
        size="lg"
        footer={
          detail ? (
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="sm"
                icon={Trash2}
                className="text-[#6b6b6b] hover:bg-[#f7f7f7] hover:text-ink"
                onClick={() => setDeleteTarget(detail)}
              >
                Delete
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Copy}
                  onClick={() => {
                    copyText(`${detail.name} · ${detail.phone} · ${detail.email} · ${detail.eventType} · ${detail.eventDate}`)
                      .then(() => toast("Enquiry copied to clipboard"))
                      .catch(() => toast("Could not copy", { tone: "error" }));
                  }}
                >
                  Copy brief
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  loading={saving}
                  onClick={() => {
                    if (detail.status === "new") updateEnquiry({ status: "contacted" }, "Marked as contacted");
                    else toast("Everything is up to date");
                  }}
                >
                  {detail.status === "new" ? "Mark contacted" : "Save"}
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {detailLoading && !detail && (
          <div className="space-y-4 p-5">
            <Skeleton className="h-20" />
            <Skeleton className="h-40" />
            <Skeleton className="h-24" />
          </div>
        )}

        {detail && (
          <div className="divide-y divide-black/6">
            <div className="flex flex-wrap items-center gap-2 px-5 py-4">
              <Select
                value={detail.status}
                onChange={(event) => updateEnquiry({ status: event.target.value }, "Status updated")}
                className="h-9 w-auto min-w-[130px] py-0 text-[12px] font-semibold"
                disabled={saving}
              >
                {Object.entries(ENQUIRY_STATUS).map(([value, item]) => (
                  <option key={value} value={value}>
                    {item.label}
                  </option>
                ))}
              </Select>
              <Select
                value={detail.priority}
                onChange={(event) => updateEnquiry({ priority: event.target.value }, "Priority updated")}
                className="h-9 w-auto min-w-[115px] py-0 text-[12px]"
                disabled={saving}
              >
                {Object.entries(PRIORITY).map(([value, item]) => (
                  <option key={value} value={value}>
                    {item.label} priority
                  </option>
                ))}
              </Select>
              <Select
                value={detail.assignee}
                onChange={(event) => updateEnquiry({ assignee: event.target.value }, "Assignment updated")}
                className="h-9 w-auto min-w-[145px] py-0 text-[12px]"
                disabled={saving}
              >
                <option value="">Unassigned</option>
                {(team || []).map((member) => (
                  <option key={member.id} value={member.name}>
                    {member.name}
                  </option>
                ))}
              </Select>
              <div className="ml-auto flex items-center gap-1.5">
                <a href={toPhoneHref(detail.phone)} className="grid h-8 w-8 place-items-center  bg-[#f7f7f7] text-[#525252] transition-colors hover:bg-ink hover:text-white" title="Call">
                  <Phone size={13} />
                </a>
                <a href={whatsappHref(detail.phone, `Hi ${detail.name.split(" ")[0]}, this is Venue On My Plate.`)} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center  bg-[#f7f7f7] text-[#525252] transition-colors hover:bg-ink hover:text-white" title="WhatsApp">
                  <Send size={13} />
                </a>
                <a href={mailtoHref(detail.email, `Your Venue On My Plate enquiry ${detail.reference}`)} className="grid h-8 w-8 place-items-center  bg-[#f7f7f7] text-[#525252] transition-colors hover:bg-[#525252] hover:text-white" title="Email">
                  <Mail size={13} />
                </a>
              </div>
            </div>

            <div className="px-5 py-5">
              <p className="text-[9.5px] font-bold tracking-[0.18em] text-[#525252] uppercase">Contact</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className=" border border-ink/6 bg-[#f7f7f7] p-3">
                  <p className="flex items-center gap-1.5 text-[9px] font-bold tracking-[0.12em] text-[#a3a3a3] uppercase">
                    <Phone size={10} /> Phone
                  </p>
                  <button
                    type="button"
                    onClick={() => copyText(detail.phone).then(() => toast("Phone number copied"))}
                    className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink hover:text-[#525252]"
                  >
                    {detail.phone} <Copy size={10} className="text-[#a3a3a3]" />
                  </button>
                </div>
                <div className=" border border-ink/6 bg-[#f7f7f7] p-3">
                  <p className="flex items-center gap-1.5 text-[9px] font-bold tracking-[0.12em] text-[#a3a3a3] uppercase">
                    <Mail size={10} /> Email
                  </p>
                  <button
                    type="button"
                    onClick={() => copyText(detail.email).then(() => toast("Email copied"))}
                    className="mt-1 flex max-w-full items-center gap-1.5 truncate text-[12.5px] font-semibold text-ink hover:text-[#525252]"
                  >
                    <span className="truncate">{detail.email || "Not shared"}</span>
                    {detail.email && <Copy size={10} className="shrink-0 text-[#a3a3a3]" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="px-5 py-5">
              <p className="text-[9.5px] font-bold tracking-[0.18em] text-[#525252] uppercase">Event brief</p>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
                {[
                  ["City", detail.city || "—", MapPin],
                  ["Occasion", detail.eventType || "—", CalendarDays],
                  ["Date", detail.eventDate || "Flexible", CalendarDays],
                  ["Guests", detail.guestCount || "—", Users],
                  ["Source", sourceLabel(detail.source), MessageSquareText],
                  ["First reply", detail.firstResponseAt ? formatDateTime(detail.firstResponseAt) : "Not yet", UserRound],
                ].map(([label, value, Icon]) => {
                  const Cmp = Icon as typeof MapPin;
                  return (
                    <div key={String(label)}>
                      <p className="flex items-center gap-1 text-[9px] font-bold tracking-[0.1em] text-[#a3a3a3] uppercase">
                        <Cmp size={9} /> {String(label)}
                      </p>
                      <p className="mt-1 text-[12px] font-semibold text-ink">{String(value)}</p>
                    </div>
                  );
                })}
              </div>
              {detail.message && (
                <div className="mt-4  border border-line bg-[#f7f7f7] p-4">
                  <p className="text-[9px] font-bold tracking-[0.12em] text-[#525252] uppercase">Message</p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#525252]">{detail.message}</p>
                </div>
              )}
            </div>

            <div className="px-5 py-5">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[9.5px] font-bold tracking-[0.18em] text-[#525252] uppercase">
                  <Tags size={11} /> Tags
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={saving}
                  onClick={() =>
                    updateEnquiry(
                      { tags: tagDraft.split(",").map((tag) => tag.trim()).filter(Boolean) },
                      "Tags updated"
                    )
                  }
                >
                  Save tags
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {detail.tags.map((tag) => (
                  <Badge key={tag} className="bg-[#f7f7f7] text-[#525252] ring-ink/6">
                    {tag}
                  </Badge>
                ))}
                {detail.tags.length === 0 && <span className="text-[11px] text-[#a3a3a3]">No tags yet</span>}
              </div>
              <Input
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                placeholder="hot, proposal shared, visit planned"
                className="mt-2 h-9 py-0 text-[12px]"
              />
            </div>

            <div className="px-5 py-5">
              <p className="text-[9.5px] font-bold tracking-[0.18em] text-[#525252] uppercase">Internal notes</p>
              <div className="mt-3 flex gap-2">
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Add context for the team — a call summary, next step or site-visit note…"
                  rows={3}
                  className="text-[12px]"
                />
                <Button variant="primary" size="sm" loading={saving} onClick={addNote} className="self-end" icon={Plus}>
                  Add
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {detail.notes.map((item) => (
                  <div key={item.id} className="flex gap-2.5">
                    <Avatar name={item.author} size="xs" />
                    <div className="min-w-0 flex-1  bg-[#f7f7f7] p-3">
                      <p className="text-[11.5px] leading-relaxed text-[#525252]">{item.text}</p>
                      <p className="mt-1 text-[9.5px] text-[#a3a3a3]">
                        {item.author} · {timeAgo(item.at)}
                      </p>
                    </div>
                  </div>
                ))}
                {detail.notes.length === 0 && <p className="text-[11px] text-[#a3a3a3]">No internal notes yet.</p>}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#f7f7f7] px-5 py-3 text-[10px] text-[#a3a3a3]">
              <span>Created {formatDate(detail.createdAt, { hour: "numeric", minute: "2-digit" })}</span>
              <span className="flex items-center gap-1">
                <Check size={11} /> Updated {timeAgo(detail.updatedAt)}
              </span>
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && removeEnquiry(deleteTarget)}
        title="Remove this enquiry?"
        description={deleteTarget ? `${deleteTarget.reference} · ${deleteTarget.name}` : ""}
        loading={deleting}
      />
    </div>
  );
}

export default function EnquiriesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] " />}>
      <EnquiriesView />
    </Suspense>
  );
}
