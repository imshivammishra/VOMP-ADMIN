"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  Building2,
  Check,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { api, apiWithMeta, queryString } from "@/lib/api";
import { useDebounced } from "@/lib/hooks";
import { useRealtime } from "@/lib/realtime";
import { useToast } from "@/lib/toast";
import type { Venue } from "@/lib/types";
import { PUBLISH_STATUS, cn, formatDate } from "@/lib/utils";
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
  Switch,
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

interface VenueForm {
  id?: string;
  slug: string;
  name: string;
  city: string;
  citySlug: string;
  area: string;
  type: string;
  setting: "Indoor" | "Outdoor" | "Indoor + Outdoor";
  capacityMin: string;
  capacityMax: string;
  priceHint: string;
  image: string;
  imageAlt: string;
  shortDescription: string;
  description: string;
  amenities: string;
  eventTypes: string;
  featured: boolean;
  status: "published" | "draft" | "archived";
}

const EMPTY: VenueForm = {
  slug: "",
  name: "",
  city: "",
  citySlug: "",
  area: "",
  type: "",
  setting: "Indoor + Outdoor",
  capacityMin: "",
  capacityMax: "",
  priceHint: "",
  image: "",
  imageAlt: "",
  shortDescription: "",
  description: "",
  amenities: "",
  eventTypes: "",
  featured: false,
  status: "published",
};

function formFromVenue(venue: Venue): VenueForm {
  return {
    id: venue.id,
    slug: venue.slug,
    name: venue.name,
    city: venue.city,
    citySlug: venue.citySlug,
    area: venue.area,
    type: venue.type,
    setting: venue.setting,
    capacityMin: String(venue.capacityMin || ""),
    capacityMax: String(venue.capacityMax || ""),
    priceHint: venue.priceHint,
    image: venue.image,
    imageAlt: venue.imageAlt,
    shortDescription: venue.shortDescription,
    description: venue.description,
    amenities: venue.amenities.join(", "),
    eventTypes: venue.eventTypes.join(", "),
    featured: venue.featured,
    status: venue.status,
  };
}

function VenuesView() {
  const params = useSearchParams();
  const { toast } = useToast();
  const { seq } = useRealtime();
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 280);
  const [status, setStatus] = useState("all");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<VenueForm | null>(params.get("new") === "1" ? { ...EMPTY } : null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Venue | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => setPage(1), [debounced, status, featuredOnly]);

  const url = `/api/admin/venues${queryString({ q: debounced, status, featured: featuredOnly ? "true" : undefined, page, limit: 20 })}`;
  const { data, mutate, isValidating } = useSWR<Envelope<Venue[]>>(url, fetchEnvelope);

  useEffect(() => {
    if (seq > 0) mutate();
  }, [seq, mutate]);

  useEffect(() => {
    const focus = params.get("focus");
    if (!focus) return;
    api<Venue>(`/api/admin/venues/${focus}`)
      .then((venue) => setForm(formFromVenue(venue)))
      .catch(() => toast("Could not open that venue", { tone: "error" }));
  }, [params, toast]);

  const counts = data?.meta?.counts || {};
  const rows = data?.data || [];

  async function save() {
    if (!form) return;
    if (!form.name.trim() || !form.city.trim()) {
      toast("Add at least a venue name and city", { tone: "error" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        slug: form.slug || undefined,
        name: form.name,
        city: form.city,
        citySlug: form.citySlug || undefined,
        area: form.area,
        type: form.type,
        setting: form.setting,
        capacityMin: Number(form.capacityMin) || 0,
        capacityMax: Number(form.capacityMax) || 0,
        priceHint: form.priceHint,
        image: form.image,
        imageAlt: form.imageAlt,
        shortDescription: form.shortDescription,
        description: form.description,
        amenities: form.amenities.split(",").map((item) => item.trim()).filter(Boolean),
        eventTypes: form.eventTypes.split(",").map((item) => item.trim()).filter(Boolean),
        featured: form.featured,
        status: form.status,
      };
      if (form.id) {
        await api(`/api/admin/venues/${form.id}`, { method: "PATCH", body: payload });
        toast("Venue updated", { description: form.name });
      } else {
        await api("/api/admin/venues", { method: "POST", body: payload });
        toast("Venue created", { description: form.name });
      }
      setForm(null);
      await mutate();
    } catch (error) {
      toast("Could not save venue", {
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleFeatured(venue: Venue) {
    setToggling(venue.id);
    try {
      await api(`/api/admin/venues/${venue.id}`, {
        method: "PATCH",
        body: { ...venue, featured: !venue.featured },
      });
      await mutate();
      toast(venue.featured ? "Removed from featured" : "Marked as featured", { description: venue.name });
    } catch (error) {
      toast("Could not update featured state", {
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setToggling(null);
    }
  }

  async function removeVenue(venue: Venue) {
    setDeleting(true);
    try {
      await api(`/api/admin/venues/${venue.id}`, { method: "DELETE" });
      toast("Venue removed", { description: venue.name });
      setDeleteTarget(null);
      await mutate();
    } catch (error) {
      toast("Could not remove venue", {
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setDeleting(false);
    }
  }

  const tabs = [
    { value: "all", label: "All venues", count: (counts.published || 0) + (counts.draft || 0) + (counts.archived || 0) },
    { value: "published", label: "Published", count: counts.published || 0 },
    { value: "draft", label: "Drafts", count: counts.draft || 0 },
    { value: "archived", label: "Archived", count: counts.archived || 0 },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Venues"
        description="The properties the public website recommends. Publish, edit and feature venues without touching code."
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={() => mutate()} loading={isValidating}>
              Refresh
            </Button>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setForm({ ...EMPTY })}
            >
              New venue
            </Button>
          </>
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <SearchInput value={query} onChange={setQuery} placeholder="Search venue, city, area or type…" className="w-full lg:max-w-[380px]" />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={featuredOnly ? "strong" : "secondary"}
              size="sm"
              icon={Star}
              aria-pressed={featuredOnly}
              onClick={() => setFeaturedOnly((value) => !value)}
            >
              Featured only
            </Button>
            <span className="text-[10.5px] text-muted">
              {data?.meta?.total || 0} venues · {counts.published || 0} live
            </span>
          </div>
        </div>
      </Card>

      <div className="mb-3 overflow-x-auto">
        <Tabs tabs={tabs} value={status} onChange={setStatus} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[900px]">
            <thead>
              <tr>
                <th>Venue</th>
                <th>Type & setting</th>
                <th>Capacity</th>
                <th>Price band</th>
                <th>Status</th>
                <th>Featured</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((venue) => (
                <tr key={venue.id} className="cursor-pointer" onClick={() => setForm(formFromVenue(venue))}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-14 shrink-0 overflow-hidden rounded-lg bg-cream">
                        {venue.image ? (
                          <img src={venue.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-[#a79b88]"><Building2 size={16} /></div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold text-ink">{venue.name}</p>
                        <p className="flex items-center gap-1 truncate text-[10.5px] text-muted">
                          <MapPin size={9} /> {venue.area ? `${venue.area}, ` : ""}{venue.city}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <p className="text-[11.5px] font-medium text-[#5f574a]">{venue.type || "—"}</p>
                    <p className="text-[10px] text-muted">{venue.setting}</p>
                  </td>
                  <td>
                    <span className="flex items-center gap-1 text-[11px] text-[#5f574a]">
                      <Users size={11} className="text-[#a79b88]" /> {venue.capacityMin}–{venue.capacityMax}
                    </span>
                  </td>
                  <td><Badge className="bg-cream-soft text-[#5f574a] ring-ink/6">{venue.priceHint || "On request"}</Badge></td>
                  <td><StatusPill value={venue.status} map={PUBLISH_STATUS} /></td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => toggleFeatured(venue)}
                      disabled={toggling === venue.id}
                      aria-pressed={venue.featured}
                      aria-label={venue.featured ? `Remove ${venue.name} from featured` : `Mark ${venue.name} as featured`}
                      className={cn(
                        "grid h-7 w-7 place-items-center rounded-full transition disabled:opacity-40",
                        venue.featured
                          ? "bg-cream-soft text-ink"
                          : "text-[#c3b7a4] hover:bg-cream-soft hover:text-muted"
                      )}
                      title={venue.featured ? "Remove from featured" : "Mark as featured"}
                    >
                      <Star size={14} fill={venue.featured ? "currentColor" : "none"} />
                    </button>
                  </td>
                  <td><span className="whitespace-nowrap text-[10px] text-muted">{formatDate(venue.updatedAt)}</span></td>
                  <td>
                    <span className="grid h-7 w-7 place-items-center rounded-full text-[#a79b88] transition group-hover:text-[#5f574a]">
                      <Pencil size={12} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!data && <div className="space-y-3 p-4">{[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-14" />)}</div>}
        {data && rows.length === 0 && (
          <EmptyState
            icon={Building2}
            title="No venues found"
            description="Create a venue or adjust the filters. Published venues appear on the public website automatically."
            action={<Button variant="primary" size="sm" icon={Plus} onClick={() => setForm({ ...EMPTY })}>Add venue</Button>}
          />
        )}
        {data?.meta && <Pagination page={data.meta.page} pages={data.meta.pages} total={data.meta.total} limit={data.meta.limit} onPage={setPage} />}
      </Card>

      <Drawer
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? "Edit venue" : "Add a venue"}
        subtitle={form?.id ? form.name : "Publish a new property to the catalogue"}
        size="lg"
        footer={
          form ? (
            <div className="flex items-center justify-between gap-3">
              {form.id ? (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  className="text-[#817665] hover:bg-cream-soft hover:text-ink"
                  onClick={() => {
                    const venue = rows.find((row) => row.id === form.id);
                    if (venue) setDeleteTarget(venue);
                  }}
                >
                  Delete
                </Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setForm(null)}>Cancel</Button>
                <Button variant="primary" size="sm" loading={saving} icon={Check} onClick={save}>
                  {form.id ? "Save changes" : "Create venue"}
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {form && (
          <div className="space-y-5 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Venue name" required className="sm:col-span-2">
                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Enter the venue name" />
              </Field>
              <Field label="City" required>
                <Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="Udaipur" />
              </Field>
              <Field label="Area">
                <Input value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })} placeholder="Lake Pichola" />
              </Field>
              <Field label="Venue type">
                <Input value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} placeholder="Heritage Palace" />
              </Field>
              <Field label="Setting">
                <Select value={form.setting} onChange={(event) => setForm({ ...form, setting: event.target.value as VenueForm["setting"] })}>
                  <option>Indoor</option>
                  <option>Outdoor</option>
                  <option>Indoor + Outdoor</option>
                </Select>
              </Field>
              <Field label="Capacity from">
                <Input type="number" min={0} value={form.capacityMin} onChange={(event) => setForm({ ...form, capacityMin: event.target.value })} placeholder="200" />
              </Field>
              <Field label="Capacity up to">
                <Input type="number" min={0} value={form.capacityMax} onChange={(event) => setForm({ ...form, capacityMax: event.target.value })} placeholder="1200" />
              </Field>
              <Field label="Price band">
                <Input value={form.priceHint} onChange={(event) => setForm({ ...form, priceHint: event.target.value })} placeholder="Premium" />
              </Field>
              <Field label="Slug" hint="Leave blank to generate from the name.">
                <Input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="venue-slug" />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Status">
                <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as VenueForm["status"] })}>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </Select>
              </Field>
              <div className="flex items-end pb-2">
                <Switch checked={form.featured} onChange={(value) => setForm({ ...form, featured: value })} label="Feature on the website" description="Shown first in venue collections." />
              </div>
            </div>

            <div className="space-y-3">
              <Field label="Cover image URL">
                <Input value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} placeholder="https://…" />
              </Field>
              {form.image && (
                <div className="relative h-36 overflow-hidden rounded-xl border border-ink/8 bg-cream">
                  <img src={form.image} alt="" className="h-full w-full object-cover" />
                  <span className="absolute right-2 bottom-2 rounded-full bg-ink/55 px-2 py-0.5 text-[9px] font-semibold text-white">Cover preview</span>
                </div>
              )}
              <Field label="Image alt text">
                <Input value={form.imageAlt} onChange={(event) => setForm({ ...form, imageAlt: event.target.value })} placeholder="Describe the image for accessibility" />
              </Field>
            </div>

            <Field label="Short description" hint="One or two lines used on cards and search results.">
              <Textarea rows={2} value={form.shortDescription} onChange={(event) => setForm({ ...form, shortDescription: event.target.value })} placeholder="A short factual description of the property..." />
            </Field>
            <Field label="Full description">
              <Textarea rows={6} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Describe the spaces, guest flow and what makes this property special…" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Amenities" hint="Comma separated.">
                <Textarea rows={3} value={form.amenities} onChange={(event) => setForm({ ...form, amenities: event.target.value })} placeholder="Bridal suites, In-house catering, Valet parking" />
              </Field>
              <Field label="Event types" hint="Comma separated.">
                <Textarea rows={3} value={form.eventTypes} onChange={(event) => setForm({ ...form, eventTypes: event.target.value })} placeholder="Wedding, Sangeet, Corporate event" />
              </Field>
            </div>

            <div className="rounded-xl bg-cream-soft p-3 text-[10.5px] leading-relaxed text-muted">
              <Sparkles size={12} className="mr-1 inline text-[#5f574a]" />
              Published venues are returned by the public API and appear on the website after its cache refreshes.
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && removeVenue(deleteTarget)}
        title="Remove this venue?"
        description={deleteTarget ? `${deleteTarget.name} · ${deleteTarget.city}` : ""}
        loading={deleting}
      />
    </div>
  );
}

export default function VenuesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] rounded-xl" />}>
      <VenuesView />
    </Suspense>
  );
}
