"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Image as ImageIcon,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import { api, apiWithMeta } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useToast } from "@/lib/toast";
import type { MediaItem, Review } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Drawer,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  StatusPill,
  Switch,
  Tabs,
  Textarea,
} from "@/components/ui";
import { MediaPicker } from "@/components/MediaPicker";

interface ListMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasMore: boolean;
  counts?: Record<string, number>;
}
type Envelope<T> = { data: T; meta?: ListMeta };

interface ReviewForm {
  id?: string;
  name: string;
  context: string;
  quote: string;
  rating: string;
  image: string;
  venueSlug: string;
  featured: boolean;
  status: "published" | "draft";
  sortOrder: number;
  updatedAt?: string;
}

const EMPTY: ReviewForm = {
  name: "",
  context: "",
  quote: "",
  rating: "5",
  image: "",
  venueSlug: "",
  featured: true,
  status: "published",
  sortOrder: 0,
};

function formFromReview(review: Review): ReviewForm {
  return {
    id: review.id,
    name: review.name,
    context: review.context,
    quote: review.quote,
    rating: String(review.rating),
    image: review.image,
    venueSlug: review.venueSlug,
    featured: review.featured,
    status: review.status,
    sortOrder: review.sortOrder,
    updatedAt: review.updatedAt,
  };
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          size={11}
          className={index < rating ? "fill-black text-ink" : "fill-neutral-200 text-neutral-200"}
        />
      ))}
    </span>
  );
}

export default function ReviewsPage() {
  const { toast } = useToast();
  const { seq } = useRealtime();
  const [status, setStatus] = useState("all");
  const [form, setForm] = useState<ReviewForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [moving, setMoving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data, mutate, isValidating } = useSWR<Envelope<Review[]>>(
    `/api/admin/reviews?limit=500&status=${status === "all" ? "" : status}`,
    (url: string) => apiWithMeta<Review[]>(url) as Promise<Envelope<Review[]>>
  );

  useEffect(() => {
    if (seq > 0) mutate();
  }, [seq, mutate]);

  const reviews = data?.data || [];
  const counts = data?.meta?.counts || {};
  const published = counts.published || reviews.filter((review) => review.status === "published").length;
  const drafts = counts.draft || reviews.filter((review) => review.status === "draft").length;
  const average = reviews.length
    ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
    : "—";

  function set<K extends keyof ReviewForm>(key: K, value: ReviewForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save() {
    if (!form) return;
    if (!form.name.trim()) {
      toast("Add the reviewer's name", { tone: "error" });
      return;
    }
    if (form.quote.trim().length < 5) {
      toast("Add the review text", { tone: "error" });
      return;
    }
    const payload = {
      name: form.name,
      context: form.context,
      quote: form.quote,
      rating: Number(form.rating) || 5,
      image: form.image,
      venueSlug: form.venueSlug,
      featured: form.featured,
      sortOrder: form.sortOrder,
      status: form.status,
    };
    setSaving(true);
    try {
      if (form.id) {
        await api(`/api/admin/reviews/${form.id}`, { method: "PATCH", body: payload });
        toast("Review updated", { description: form.name });
      } else {
        await api("/api/admin/reviews", { method: "POST", body: payload });
        toast("Review added", { description: form.name });
      }
      setForm(null);
      await mutate();
    } catch (error) {
      toast("Could not save this review", {
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove(review: Review) {
    setDeleting(true);
    try {
      await api(`/api/admin/reviews/${review.id}`, { method: "DELETE" });
      toast("Review removed", { description: review.name });
      setDeleteTarget(null);
      await mutate();
    } catch (error) {
      toast("Could not remove this review", {
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setDeleting(false);
    }
  }

  async function move(review: Review, direction: -1 | 1) {
    const ordered = reviews.map((item) => item.id);
    const index = ordered.indexOf(review.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setMoving(true);
    try {
      await api("/api/admin/reviews/reorder", { method: "POST", body: { ids: ordered } });
      await mutate();
    } catch (error) {
      toast("Could not reorder reviews", {
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setMoving(false);
    }
  }

  async function toggleFeatured(review: Review) {
    try {
      await api(`/api/admin/reviews/${review.id}`, {
        method: "PATCH",
        body: {
          name: review.name,
          context: review.context,
          quote: review.quote,
          rating: review.rating,
          image: review.image,
          venueSlug: review.venueSlug,
          featured: !review.featured,
          sortOrder: review.sortOrder,
          status: review.status,
        },
      });
      await mutate();
      toast(review.featured ? "Removed from featured" : "Marked as featured", { description: review.name });
    } catch (error) {
      toast("Could not update this review", {
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    }
  }

  const tabs = [
    { value: "all", label: "All reviews", count: (counts.published || 0) + (counts.draft || 0) },
    { value: "published", label: "Published", count: counts.published || 0 },
    { value: "draft", label: "Drafts", count: counts.draft || 0 },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Website"
        title="Reviews"
        description="Real client words shown on the homepage. Add, edit, feature or remove a review without touching code."
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={() => mutate()} loading={isValidating}>Refresh</Button>
            <Button icon={Plus} onClick={() => setForm({ ...EMPTY })}>Add review</Button>
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[8.5px] font-semibold tracking-[0.14em] text-[#8b7e69] uppercase">Published</p>
          <p className="font-display mt-1 text-[34px] leading-none font-semibold tracking-[-0.02em] text-ink">{published}</p>
          <p className="mt-1.5 text-[10.5px] text-[#817665]">Visible on the website</p>
        </Card>
        <Card className="p-4">
          <p className="text-[8.5px] font-semibold tracking-[0.14em] text-[#8b7e69] uppercase">Drafts</p>
          <p className="font-display mt-1 text-[34px] leading-none font-semibold tracking-[-0.02em] text-ink">{drafts}</p>
          <p className="mt-1.5 text-[10.5px] text-[#817665]">Waiting to be reviewed</p>
        </Card>
        <Card className="p-4">
          <p className="text-[8.5px] font-semibold tracking-[0.14em] text-[#8b7e69] uppercase">Average rating</p>
          <p className="font-display mt-1 text-[34px] leading-none font-semibold tracking-[-0.02em] text-ink">{average}</p>
          <p className="mt-1.5 text-[10.5px] text-[#817665]">Across this view</p>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={tabs} value={status} onChange={setStatus} />
        <p className="text-[10.5px] text-[#948771]">Featured reviews are shown first.</p>
      </div>

      {!data && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[210px] rounded-xl" />)}
        </div>
      )}

      {data && reviews.length === 0 && (
        <Card className="p-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-cream-soft text-[#817665]"><Star size={20} /></span>
          <p className="font-display mt-3 text-[24px] font-semibold tracking-[-0.02em] text-ink">
            {status === "all" ? "No reviews yet." : `No ${status} reviews.`}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-[#817665]">
            Add a real client review and it will appear on the homepage as soon as it is published.
          </p>
          {status === "all" && <Button className="mt-4" size="sm" icon={Plus} onClick={() => setForm({ ...EMPTY })}>Add the first review</Button>}
        </Card>
      )}

      {reviews.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {reviews.map((review, index) => (
            <Card key={review.id} className="flex flex-col p-5 transition hover:border-line-strong">
              <div className="flex items-start gap-3">
                {review.image ? (
                  <img src={review.image} alt={review.name} className="h-11 w-11 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cream-soft text-[12px] font-semibold text-[#817665]">
                    {review.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[12.5px] font-semibold text-ink">{review.name}</p>
                    <StatusPill
                      value={review.status}
                      map={{
                        published: { label: "Published", className: "bg-cream-soft text-[#5f574a] ring-line", dot: "bg-ink" },
                        draft: { label: "Draft", className: "bg-white text-[#817665] ring-line", dot: "bg-[#d7ccba]" },
                      }}
                    />
                    {review.featured && <Badge className="bg-ink text-white ring-ink">Featured</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Stars rating={review.rating} />
                    {review.context && <span className="text-[10.5px] text-[#948771]">{review.context}</span>}
                  </div>
                </div>
              </div>

              <blockquote className="mt-3 flex-1 text-[12.5px] leading-relaxed text-muted">
                &ldquo;{review.quote}&rdquo;
              </blockquote>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#f0e9dd] pt-3">
                <button
                  type="button"
                  onClick={() => toggleFeatured(review)}
                  className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-[#817665] transition hover:text-ink"
                >
                  <Star size={11} className={review.featured ? "fill-black text-ink" : ""} />
                  {review.featured ? "Featured" : "Feature this review"}
                </button>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="sm" icon={ArrowUp} aria-label="Move up" disabled={index === 0 || moving} onClick={() => move(review, -1)} className="h-8 w-8 px-0" />
                  <Button variant="ghost" size="sm" icon={ArrowDown} aria-label="Move down" disabled={index === reviews.length - 1 || moving} onClick={() => move(review, 1)} className="h-8 w-8 px-0" />
                  <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setForm(formFromReview(review))}>Edit</Button>
                  <Button variant="ghost" size="sm" icon={Trash2} aria-label="Delete" onClick={() => setDeleteTarget(review)} className="h-8 w-8 px-0 text-[#948771] hover:text-ink" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Drawer
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? "Edit review" : "Add review"}
        subtitle="Shown on the homepage testimonial section."
        size="md"
        footer={
          form ? (
            <div className="flex items-center justify-between">
              <p className="text-[10.5px] text-[#948771]">{form.status === "published" ? "Visible on the website after saving." : "Saved as a draft."}</p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setForm(null)}>Cancel</Button>
                <Button size="sm" icon={Check} loading={saving} onClick={save}>Save review</Button>
              </div>
            </div>
          ) : null
        }
      >
        {form && (
          <div className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Reviewer name" required>
                <Input value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="Ananya & Reyansh" />
              </Field>
              <Field label="Context" hint="City, month or event.">
                <Input value={form.context} onChange={(event) => set("context", event.target.value)} placeholder="Udaipur · Dec '25" />
              </Field>
            </div>
            <Field label="Review" required>
              <Textarea rows={5} value={form.quote} onChange={(event) => set("quote", event.target.value)} placeholder="What did the shortlist or venue support make easier?" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Rating">
                <Select value={form.rating} onChange={(event) => set("rating", event.target.value)}>
                  {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} out of 5</option>)}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={form.status} onChange={(event) => set("status", event.target.value as "published" | "draft")}>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </Select>
              </Field>
            </div>
            <Field label="Photo" hint="Optional. A portrait or couple photo works best.">
              <div className="flex gap-2">
                <Input value={form.image} onChange={(event) => set("image", event.target.value)} placeholder="https://… or /uploads/library/…" />
                <Button variant="secondary" size="sm" icon={ImageIcon} className="h-[42px] shrink-0" onClick={() => setPickerOpen(true)}>Choose</Button>
              </div>
            </Field>
            <Field label="Venue slug" hint="Optional. Links this review to a venue page.">
              <Input value={form.venueSlug} onChange={(event) => set("venueSlug", event.target.value)} placeholder="venue-slug" />
            </Field>
            <div className="rounded-lg border border-line bg-cream-soft p-4">
              <Switch
                checked={form.featured}
                onChange={(value) => set("featured", value)}
                label="Feature this review"
                description="Featured reviews appear first on the homepage."
              />
            </div>
            {form.id && (
              <p className="text-[10px] text-[#948771]">Last updated {formatDate(form.updatedAt || new Date().toISOString())}</p>
            )}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        title="Remove this review?"
        description={deleteTarget ? `${deleteTarget.name} · ${deleteTarget.context || "Homepage review"}` : ""}
        loading={deleting}
      />

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        kind="image"
        title="Choose a review photo"
        onSelect={(url: string, _item: MediaItem) => set("image", url)}
      />
    </div>
  );
}
