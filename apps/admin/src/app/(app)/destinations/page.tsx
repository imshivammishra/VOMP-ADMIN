"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  Check,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { api, apiWithMeta, queryString } from "@/lib/api";
import { useDebounced } from "@/lib/hooks";
import { useRealtime } from "@/lib/realtime";
import { useToast } from "@/lib/toast";
import type { Destination } from "@/lib/types";
import { PUBLISH_STATUS } from "@/lib/utils";
import {
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

interface ListMeta { total: number; page: number; limit: number; pages: number; hasMore: boolean; counts?: Record<string, number> }
type Envelope<T> = { data: T; meta?: ListMeta };
function fetchEnvelope<T>(url: string) { return apiWithMeta<T>(url) as Promise<Envelope<T>>; }

interface DestinationForm {
  id?: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  image: string;
  imageAlt: string;
  venueCountLabel: string;
  popularTypes: string;
  status: "published" | "draft";
}

const EMPTY: DestinationForm = {
  name: "",
  slug: "",
  tagline: "",
  description: "",
  image: "",
  imageAlt: "",
  venueCountLabel: "",
  popularTypes: "",
  status: "published",
};

function toForm(item: Destination): DestinationForm {
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    tagline: item.tagline,
    description: item.description,
    image: item.image,
    imageAlt: item.imageAlt,
    venueCountLabel: item.venueCountLabel,
    popularTypes: item.popularTypes.join(", "),
    status: item.status,
  };
}

export default function DestinationsPage() {
  const { toast } = useToast();
  const { seq } = useRealtime();
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 280);
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<DestinationForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Destination | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => setPage(1), [debounced, status]);
  const url = `/api/admin/destinations${queryString({ q: debounced, status, page, limit: 20 })}`;
  const { data, mutate, isValidating } = useSWR<Envelope<Destination[]>>(url, fetchEnvelope);

  useEffect(() => { if (seq > 0) mutate(); }, [seq, mutate]);

  const counts = data?.meta?.counts || {};
  const rows = data?.data || [];

  async function save() {
    if (!form) return;
    if (!form.name.trim()) {
      toast("Add a destination name", { tone: "error" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug || undefined,
        tagline: form.tagline,
        description: form.description,
        image: form.image,
        imageAlt: form.imageAlt,
        venueCountLabel: form.venueCountLabel,
        popularTypes: form.popularTypes.split(",").map((item) => item.trim()).filter(Boolean),
        status: form.status,
      };
      if (form.id) await api(`/api/admin/destinations/${form.id}`, { method: "PATCH", body: payload });
      else await api("/api/admin/destinations", { method: "POST", body: payload });
      toast(form.id ? "Destination updated" : "Destination created", { description: form.name });
      setForm(null);
      await mutate();
    } catch (error) {
      toast("Could not save destination", { description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: Destination) {
    setDeleting(true);
    try {
      await api(`/api/admin/destinations/${item.id}`, { method: "DELETE" });
      toast("Destination removed", { description: item.name });
      setDeleteTarget(null);
      await mutate();
    } catch (error) {
      toast("Could not remove destination", { description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Destinations"
        description="City and region landing pages — the place visitors browse before they shortlist a venue."
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={() => mutate()} loading={isValidating}>Refresh</Button>
            <Button variant="primary" icon={Plus} onClick={() => setForm({ ...EMPTY })}>New destination</Button>
          </>
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
          <SearchInput value={query} onChange={setQuery} placeholder="Search city, tagline or description…" className="w-full md:max-w-[380px]" />
          <Tabs
            tabs={[
              { value: "all", label: "All", count: (counts.published || 0) + (counts.draft || 0) },
              { value: "published", label: "Published", count: counts.published || 0 },
              { value: "draft", label: "Drafts", count: counts.draft || 0 },
            ]}
            value={status}
            onChange={setStatus}
          />
        </div>
      </Card>

      {!data && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((row) => <Skeleton key={row} className="h-[290px] rounded-xl" />)}</div>}

      {data && rows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((item, index) => (
            <Card key={item.id} className="group overflow-hidden transition hover:-translate-y-0.5 hover:border-line">
              <div className="relative h-36 overflow-hidden bg-cream">
                {item.image ? (
                  <img src={item.image} alt={item.imageAlt || item.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" loading="lazy" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-[#a79b88]"><MapPin size={28} /></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                <div className="absolute right-2.5 bottom-2.5"><StatusPill value={item.status} map={PUBLISH_STATUS} /></div>
                {index === 0 && (
                  <span className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-full bg-cream-soft/95 px-2 py-1 text-[8.5px] font-bold tracking-[0.08em] text-[#5f574a] uppercase">
                    <Sparkles size={9} /> Spotlight
                  </span>
                )}
                <h3 className="font-display absolute bottom-2.5 left-3.5 max-w-[75%] text-[26px] leading-none font-semibold text-white">{item.name}</h3>
              </div>
              <div className="p-4">
                <p className="line-clamp-1 text-[10px] font-bold tracking-[0.1em] text-[#5f574a] uppercase">{item.tagline || "Destination"}</p>
                <p className="mt-1.5 line-clamp-2 min-h-[32px] text-[11.5px] leading-relaxed text-muted">{item.description || "No description yet."}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {item.popularTypes.slice(0, 3).map((type) => (
                    <Badge key={type} className="bg-cream-soft text-[#5f574a] ring-ink/6">{type}</Badge>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-ink/5 pt-3">
                  <span className="text-[10px] text-muted">{item.venueCountLabel || "Venue count not set"}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setForm(toForm(item))} className="grid h-7 w-7 place-items-center rounded-full text-muted transition hover:bg-cream-soft hover:text-[#5f574a]" title="Edit">
                      <Pencil size={12} />
                    </button>
                    <button type="button" onClick={() => setDeleteTarget(item)} className="grid h-7 w-7 place-items-center rounded-full text-[#a79b88] transition hover:bg-cream-soft hover:text-ink" title="Delete">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {data && rows.length === 0 && (
        <Card>
          <EmptyState icon={MapPin} title="No destinations yet" description="Add the cities and regions you want to rank for." action={<Button variant="primary" size="sm" icon={Plus} onClick={() => setForm({ ...EMPTY })}>Add destination</Button>} />
        </Card>
      )}

      {data?.meta && (
        <div className="mt-4">
          <Card><Pagination page={data.meta.page} pages={data.meta.pages} total={data.meta.total} limit={data.meta.limit} onPage={setPage} /></Card>
        </div>
      )}

      <Drawer
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? "Edit destination" : "Add a destination"}
        subtitle={form?.name || "A new city landing page"}
        size="md"
        footer={form ? (
          <div className="flex items-center justify-between">
            {form.id ? (
              <Button variant="ghost" size="sm" icon={Trash2} className="text-[#817665] hover:bg-cream-soft hover:text-ink" onClick={() => {
                const item = rows.find((row) => row.id === form.id);
                if (item) setDeleteTarget(item);
              }}>Delete</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setForm(null)}>Cancel</Button>
              <Button variant="primary" size="sm" icon={Check} loading={saving} onClick={save}>Save</Button>
            </div>
          </div>
        ) : null}
      >
        {form && (
          <div className="space-y-4 p-5">
            <Field label="Name" required><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Udaipur" /></Field>
            <Field label="Slug" hint="Used in the website URL, e.g. /cities/udaipur."><Input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="udaipur" /></Field>
            <Field label="Tagline"><Input value={form.tagline} onChange={(event) => setForm({ ...form, tagline: event.target.value })} placeholder="Lakes, palaces and long wedding weekends" /></Field>
            <Field label="Description"><Textarea rows={5} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Status">
                <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as DestinationForm["status"] })}>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </Select>
              </Field>
              <Field label="Venue count label"><Input value={form.venueCountLabel} onChange={(event) => setForm({ ...form, venueCountLabel: event.target.value })} placeholder="40+ venues" /></Field>
            </div>
            <Field label="Popular event types" hint="Comma separated."><Input value={form.popularTypes} onChange={(event) => setForm({ ...form, popularTypes: event.target.value })} placeholder="Wedding, Sangeet, Corporate" /></Field>
            <Field label="Cover image URL"><Input value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} placeholder="https://…" /></Field>
            {form.image && <div className="h-32 overflow-hidden rounded-xl border border-ink/8"><img src={form.image} alt="" className="h-full w-full object-cover" /></div>}
            <Field label="Image alt text"><Input value={form.imageAlt} onChange={(event) => setForm({ ...form, imageAlt: event.target.value })} /></Field>
          </div>
        )}
      </Drawer>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && remove(deleteTarget)} title="Remove this destination?" description={deleteTarget ? `${deleteTarget.name} · ${deleteTarget.status}` : ""} loading={deleting} />
    </div>
  );
}
