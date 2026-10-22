"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  LayoutTemplate,
  List,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Star,
  Trash2,
  Type,
  Video,
} from "lucide-react";
import { api, apiWithMeta } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useToast } from "@/lib/toast";
import type { ContentBlock, ContentSection, MediaItem } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import {
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

const SECTIONS: { value: ContentSection; label: string; hint: string; icon: typeof Type }[] = [
  { value: "heading", label: "Section copy", hint: "Eyebrows, headings and intro lines for each homepage section.", icon: Type },
  { value: "hero", label: "Hero", hint: "The opening headline, rotating slides and background film.", icon: LayoutTemplate },
  { value: "ticker", label: "Ticker", hint: "The scrolling destinations and occasion strip at the top of the page.", icon: Megaphone },
  { value: "about", label: "About", hint: "The introduction block, proof points and phone number.", icon: Star },
  { value: "category", label: "Categories", hint: "The six venue categories visitors can browse.", icon: List },
  { value: "feature", label: "Why us", hint: "The three reasons families choose Venue On My Plate. Also shown as our principles on the About page.", icon: Star },
  { value: "step", label: "Steps", hint: "The three-step shortlist process.", icon: List },
  { value: "gallery", label: "Gallery", hint: "Real celebration images shown on the homepage.", icon: ImageIcon },
  { value: "film", label: "Films", hint: "Video reels and the full-width signature film.", icon: Video },
  { value: "faq", label: "FAQs", hint: "Questions shown beside the enquiry form and used for search results.", icon: HelpCircle },
  { value: "seo", label: "SEO copy", hint: "The closing paragraph block that helps search engines understand the site.", icon: Search },
  { value: "cta", label: "Footer CTA", hint: "The partner call-to-action above the footer.", icon: Megaphone },
];

const HEADING_KEYS = [
  { value: "highlights", label: "Highlights by occasion" },
  { value: "about", label: "About us" },
  { value: "cities", label: "Destinations" },
  { value: "categories", label: "Venue categories" },
  { value: "why", label: "Why families trust us" },
  { value: "steps", label: "How it works" },
  { value: "gallery", label: "Events gallery" },
  { value: "films", label: "Celebration films" },
  { value: "testimonials", label: "Client testimonials" },
  { value: "journal", label: "Journal" },
  { value: "support", label: "Support / enquiry" },
];

const ICONS = [
  { value: "castle", label: "Castle" },
  { value: "palm", label: "Palm tree" },
  { value: "landmark", label: "Landmark" },
  { value: "tent", label: "Tent" },
  { value: "building", label: "Building" },
  { value: "users", label: "People" },
  { value: "badge", label: "Badge percent" },
  { value: "sparkles", label: "Sparkles" },
  { value: "phone", label: "Phone" },
];

const FILM_PLACEMENTS = [
  { value: "grid", label: "Reel grid" },
  { value: "band", label: "Full-width signature film" },
];

interface ContentForm {
  id?: string;
  section: ContentSection;
  blockKey: string;
  title: string;
  subtitle: string;
  body: string;
  image: string;
  imageAlt: string;
  linkLabel: string;
  linkHref: string;
  icon: string;
  status: "published" | "draft";
  sortOrder: number;
  updatedAt?: string;
  meta: Record<string, unknown>;
  stats: string;
  phone: string;
  badge: string;
  secondaryLabel: string;
  secondaryHref: string;
  placement: string;
}

const str = (value: unknown) => (typeof value === "string" ? value : "");

function statsToText(stats: unknown) {
  if (!Array.isArray(stats)) return "";
  return stats
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const row = item as Record<string, unknown>;
      return `${str(row.value)}|${str(row.label)}`;
    })
    .filter(Boolean)
    .join("\n");
}

function parseStats(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.split("|"))
    .map(([statValue, label]) => ({ value: (statValue || "").trim(), label: (label || "").trim() }))
    .filter((item) => item.value && item.label);
}

function formFromBlock(block: ContentBlock): ContentForm {
  const meta = block.meta || {};
  return {
    id: block.id,
    section: block.section,
    blockKey: block.blockKey,
    title: block.title,
    subtitle: block.subtitle,
    body: block.body,
    image: block.image,
    imageAlt: block.imageAlt,
    linkLabel: block.linkLabel,
    linkHref: block.linkHref,
    icon: block.icon,
    status: block.status,
    sortOrder: block.sortOrder,
    updatedAt: block.updatedAt,
    meta,
    stats: statsToText(meta.stats),
    phone: str(meta.phone),
    badge: str(meta.badge),
    secondaryLabel: str(meta.secondaryLabel),
    secondaryHref: str(meta.secondaryHref),
    placement: str(meta.placement) || "grid",
  };
}

function emptyForm(section: ContentSection, blocks: ContentBlock[]): ContentForm {
  const existingKeys = new Set(blocks.filter((block) => block.section === section).map((block) => block.blockKey));
  const firstHeading = HEADING_KEYS.find((item) => !existingKeys.has(item.value));
  const blockKey =
    section === "heading"
      ? firstHeading?.value || `custom-${Date.now().toString(36)}`
      : section === "hero"
        ? `slide-${Date.now().toString(36)}`
        : section === "about"
          ? "about-main"
          : section === "cta"
            ? "partner-cta"
            : section === "seo"
              ? "home-seo"
              : section === "film"
                ? `film-${Date.now().toString(36)}`
                : "";
  return {
    section,
    blockKey,
    title: "",
    subtitle: "",
    body: "",
    image: "",
    imageAlt: "",
    linkLabel: "",
    linkHref: "",
    icon: section === "category" ? "castle" : section === "feature" ? "sparkles" : "",
    status: "published",
    sortOrder: 0,
    meta: {},
    stats: "",
    phone: "",
    badge: "",
    secondaryLabel: "",
    secondaryHref: "",
    placement: "grid",
  };
}

function blockHeading(block: ContentBlock) {
  if (block.section === "heading") {
    return HEADING_KEYS.find((item) => item.value === block.blockKey)?.label || block.title || "Section copy";
  }
  if (block.section === "hero") {
    return block.blockKey === "video" ? "Hero background film" : block.title || "Hero slide";
  }
  if (block.section === "about") return "Introduction block";
  if (block.section === "cta") return block.title || "Partner call-to-action";
  if (block.section === "seo") return block.title || "SEO paragraph";
  if (block.section === "film" && block.meta?.placement === "band") return "Signature film";
  return block.title || "Untitled";
}

function BlockPreview({ block }: { block: ContentBlock }) {
  const meta = block.meta || {};
  if (block.section === "hero" && block.blockKey === "video") {
    return (
      <span className="grid h-14 w-24 shrink-0 place-items-center overflow-hidden  bg-ink text-white">
        <Video size={18} />
      </span>
    );
  }
  if (block.section === "hero") {
    return block.image ? (
      <img src={block.image} alt={block.imageAlt || block.title} className="h-14 w-24 shrink-0  object-cover" />
    ) : (
      <span className="grid h-14 w-24 shrink-0 place-items-center  bg-[#f7f7f7] text-[#8a8a8a]"><ImageIcon size={18} /></span>
    );
  }
  if (block.section === "gallery" || block.section === "about") {
    return block.image ? (
      <img src={block.image} alt={block.imageAlt || block.title} className="h-14 w-24 shrink-0  object-cover" />
    ) : (
      <span className="grid h-14 w-24 shrink-0 place-items-center  bg-[#f7f7f7] text-[#8a8a8a]"><ImageIcon size={18} /></span>
    );
  }
  if (block.section === "film") {
    return (
      <span className="relative grid h-14 w-24 shrink-0 place-items-center overflow-hidden  bg-ink text-white">
        <Video size={18} />
        {meta.placement === "band" && <span className="absolute right-1 bottom-1  bg-white/20 px-1 text-[8px]">BAND</span>}
      </span>
    );
  }
  if (block.section === "heading") {
    return <span className="grid h-14 w-24 shrink-0 place-items-center  bg-[#f7f7f7] text-[#6b6b6b]"><Type size={18} /></span>;
  }
  return <span className="grid h-14 w-24 shrink-0 place-items-center  bg-[#f7f7f7] text-[#6b6b6b]"><FileText size={18} /></span>;
}

export default function WebsiteContentPage() {
  const { toast } = useToast();
  const { seq } = useRealtime();
  const [section, setSection] = useState<ContentSection>("hero");
  const [form, setForm] = useState<ContentForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContentBlock | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [moving, setMoving] = useState(false);
  const [picker, setPicker] = useState<{ field: "image" | "title"; kind: "image" | "video"; title: string } | null>(null);

  const { data, mutate, isValidating } = useSWR<Envelope<ContentBlock[]>>(
    "/api/admin/content?limit=500",
    (url: string) => apiWithMeta<ContentBlock[]>(url) as Promise<Envelope<ContentBlock[]>>
  );

  useEffect(() => {
    if (seq > 0) mutate();
  }, [seq, mutate]);

  const blocks = useMemo(() => data?.data ?? [], [data]);
  const counts = useMemo(() => {
    const output: Record<string, number> = {};
    for (const block of blocks) output[block.section] = (output[block.section] || 0) + 1;
    return output;
  }, [blocks]);

  const sectionBlocks = blocks
    .filter((block) => block.section === section)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));

  const activeSection = SECTIONS.find((item) => item.value === section) || SECTIONS[0];
  const isSingleBlockSection = section === "about" || section === "seo" || section === "cta";

  function openNew() {
    setForm(emptyForm(section, blocks));
  }

  function set<K extends keyof ContentForm>(key: K, value: ContentForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save() {
    if (!form) return;
    if (form.section === "heading" && (!form.title.trim() || !form.subtitle.trim())) {
      toast("Add the eyebrow and section heading", { tone: "error" });
      return;
    }
    if (form.section === "hero" && form.blockKey === "video" && !form.title.trim()) {
      toast("Add a video URL or choose a video", { tone: "error" });
      return;
    }
    if (form.section !== "hero" && form.section !== "heading" && !form.title.trim() && form.section !== "seo") {
      toast("Add a title first", { tone: "error" });
      return;
    }
    if (form.section === "faq" && !form.body.trim()) {
      toast("Add the answer for this question", { tone: "error" });
      return;
    }

    const meta: Record<string, unknown> = { ...form.meta };
    if (form.section === "about") {
      meta.stats = parseStats(form.stats);
      meta.phone = form.phone;
      meta.badge = form.badge;
    }
    if (form.section === "cta" || (form.section === "hero" && form.blockKey !== "video")) {
      meta.secondaryLabel = form.secondaryLabel;
      meta.secondaryHref = form.secondaryHref;
    }
    if (form.section === "film") {
      meta.placement = form.placement;
    }

    const video = form.section === "hero" && form.blockKey === "video";
    const payload = {
      section: form.section,
      blockKey: video ? "video" : form.blockKey,
      title: form.title,
      subtitle: video ? "" : form.subtitle,
      body: video ? "" : form.body,
      image: form.image,
      imageAlt: form.imageAlt,
      linkLabel: video ? "" : form.linkLabel,
      linkHref: video ? "" : form.linkHref,
      icon: form.icon,
      meta: video ? {} : meta,
      sortOrder: form.sortOrder,
      status: form.status,
    };

    setSaving(true);
    try {
      if (form.id) {
        await api(`/api/admin/content/${form.id}`, { method: "PATCH", body: payload });
        toast("Content updated", { description: form.title || form.blockKey });
      } else {
        await api("/api/admin/content", { method: "POST", body: payload });
        toast("Content added", { description: form.title || form.blockKey });
      }
      setForm(null);
      await mutate();
    } catch (error) {
      toast("Could not save this content", {
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove(block: ContentBlock) {
    setDeleting(true);
    try {
      await api(`/api/admin/content/${block.id}`, { method: "DELETE" });
      toast("Content removed", { description: blockHeading(block) });
      setDeleteTarget(null);
      await mutate();
    } catch (error) {
      toast("Could not remove this content", {
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setDeleting(false);
    }
  }

  async function move(block: ContentBlock, direction: -1 | 1) {
    const ordered = sectionBlocks.map((item) => item.id);
    const index = ordered.indexOf(block.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setMoving(true);
    try {
      await api("/api/admin/content/reorder", { method: "POST", body: { ids: ordered } });
      await mutate();
    } catch (error) {
      toast("Could not reorder content", {
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setMoving(false);
    }
  }

  function chooseMedia(field: "image" | "title") {
    if (!form) return;
    const video = form.section === "film" || (form.section === "hero" && form.blockKey === "video" && field === "title");
    setPicker({
      field,
      kind: video ? "video" : "image",
      title: video ? "Choose a video" : "Choose an image",
    });
  }

  const tabs = SECTIONS.map((item) => ({ value: item.value, label: item.label, count: counts[item.value] || 0 }));

  return (
    <div>
      <PageHeader
        eyebrow="Website"
        title="Page content"
        description="Edit the homepage section by section. Published changes appear on the public site within a minute."
        actions={
          <>
            <Link
              href={process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2  border border-line-strong bg-white px-4 text-[12px] font-semibold text-ink transition-colors hover:border-ink hover:bg-[#f7f7f7]"
            >
              View website <ExternalLink size={13} />
            </Link>
            <Button variant="secondary" icon={RefreshCw} onClick={() => mutate()} loading={isValidating}>
              Refresh
            </Button>
          </>
        }
      />

      <Card className="mb-5 flex items-start gap-3 p-4">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center  bg-[#f7f7f7] text-muted">
          <HelpCircle size={15} />
        </span>
        <div>
          <p className="text-[12px] font-semibold text-ink">Changes save to the live website.</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-[#6b6b6b]">
            Draft blocks stay hidden from visitors. Images and videos can be chosen from the media library, or pasted as a URL.
            Reviews are managed separately under <Link href="/reviews" className="font-semibold text-ink underline underline-offset-2">Reviews</Link>.
          </p>
        </div>
      </Card>

      <div className="mb-5 overflow-hidden  border border-line bg-white">
        <Tabs tabs={tabs} value={section} onChange={(value) => setSection(value as ContentSection)} className="border-b border-line p-2" />
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[12px] font-semibold text-ink">{activeSection.label}</p>
            <p className="mt-0.5 text-[11px] text-[#6b6b6b]">{activeSection.hint}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {section === "hero" && !sectionBlocks.some((block) => block.blockKey === "video") && (
              <Button
                variant="secondary"
                size="sm"
                icon={Video}
                onClick={() => {
                  const next = emptyForm("hero", blocks);
                  next.blockKey = "video";
                  next.image = "";
                  next.title = "";
                  setForm(next);
                }}
              >
                Add video
              </Button>
            )}
            {!isSingleBlockSection || sectionBlocks.length === 0 ? (
              <Button size="sm" icon={Plus} onClick={openNew}>
                {section === "hero" ? "Add slide" : `Add ${activeSection.label.toLowerCase().replace(/s$/, "")}`}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {!data && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[86px] " />
          ))}
        </div>
      )}

      {data && sectionBlocks.length === 0 && (
        <Card className="p-10 text-center">
          <p className="font-display text-[24px] font-semibold tracking-[-0.02em] text-ink">Nothing here yet.</p>
          <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-[#6b6b6b]">
            Add the first block for this section. It will appear on the homepage as soon as it is published.
          </p>
          {!isSingleBlockSection && (
            <Button className="mt-4" size="sm" icon={Plus} onClick={openNew}>
              Add content
            </Button>
          )}
        </Card>
      )}

      {sectionBlocks.length > 0 && (
        <div className="space-y-3">
          {sectionBlocks.map((block, index) => (
            <Card key={block.id} className="group p-3 transition-colors hover:border-line-strong">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <BlockPreview block={block} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[12.5px] font-semibold text-ink">{blockHeading(block)}</p>
                      <StatusPill
                        value={block.status}
                        map={{
                          published: { label: "Published", className: "bg-[#f7f7f7] text-[#525252] ring-line", dot: "bg-ink" },
                          draft: { label: "Draft", className: "bg-white text-[#6b6b6b] ring-line", dot: "bg-[#d4d4d4]" },
                        }}
                      />
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#6b6b6b]">
                      {block.section === "heading"
                        ? [block.title, block.subtitle, block.body].filter(Boolean).join(" · ")
                        : block.section === "hero" && block.blockKey === "video"
                          ? block.title || "No video selected"
                          : [block.subtitle, block.body].filter(Boolean).join(" · ") || block.title}
                    </p>
                    <p className="mt-1.5 text-[9.5px] text-[#8a8a8a]">Updated {formatDate(block.updatedAt)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 self-end sm:self-start">
                  <Button variant="ghost" size="sm" icon={ArrowUp} aria-label="Move up" disabled={index === 0 || moving} onClick={() => move(block, -1)} className="h-8 w-8 px-0" />
                  <Button variant="ghost" size="sm" icon={ArrowDown} aria-label="Move down" disabled={index === sectionBlocks.length - 1 || moving} onClick={() => move(block, 1)} className="h-8 w-8 px-0" />
                  <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setForm(formFromBlock(block))}>Edit</Button>
                  <Button variant="ghost" size="sm" icon={Trash2} aria-label="Delete" onClick={() => setDeleteTarget(block)} className="h-8 w-8 px-0 text-[#8a8a8a] hover:text-ink" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Drawer
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? "Edit content" : "Add content"}
        subtitle={form ? activeSection.label : undefined}
        size="lg"
        footer={
          form ? (
            <div className="flex items-center justify-between">
              <p className="text-[10.5px] text-[#8a8a8a]">
                {form.status === "published" ? "Visible on the website after saving." : "Saved as a draft — hidden from visitors."}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setForm(null)}>Cancel</Button>
                <Button variant="primary" size="sm" icon={Save} loading={saving} onClick={save}>Save changes</Button>
              </div>
            </div>
          ) : null
        }
      >
        {form && (
          <div className="space-y-5 p-5">
            {(form.section === "heading" || (form.section === "hero" && form.blockKey !== "video")) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {form.section === "heading" ? (
                  <Field label="Section" hint="Choose the homepage area this copy belongs to.">
                    <Select value={form.blockKey} onChange={(event) => set("blockKey", event.target.value)}>
                      {HEADING_KEYS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </Select>
                  </Field>
                ) : null}
                <Field label={form.section === "heading" ? "Eyebrow" : "Eyebrow"} hint="Small line above the headline.">
                  <Input value={form.title} onChange={(event) => set("title", event.target.value)} placeholder="Destinations" />
                </Field>
              </div>
            )}

            {form.section !== "hero" && form.section !== "heading" && form.section !== "seo" && (
              <Field label={form.section === "faq" ? "Question" : form.section === "gallery" || form.section === "film" ? "Caption" : form.section === "about" ? "Heading" : "Title"}>
                <Input value={form.title} onChange={(event) => set("title", event.target.value)} placeholder="Add a title" />
              </Field>
            )}

            {form.section === "heading" && (
              <Field label="Heading">
                <Input value={form.subtitle} onChange={(event) => set("subtitle", event.target.value)} placeholder="Every celebration starts with the right venue" />
              </Field>
            )}

            {form.section === "hero" && form.blockKey === "video" && (
              <>
                <Field label="Video URL" hint="Use an MP4, WebM or MOV from the media library.">
                  <div className="flex gap-2">
                    <Input value={form.title} onChange={(event) => set("title", event.target.value)} placeholder="/uploads/library/hero.mp4" />
                    <Button variant="secondary" size="sm" icon={Video} className="h-[42px] shrink-0" onClick={() => chooseMedia("title")}>Choose</Button>
                  </div>
                </Field>
                <Field label="Poster image" hint="Shown while the video loads.">
                  <div className="flex gap-2">
                    <Input value={form.image} onChange={(event) => set("image", event.target.value)} placeholder="https://… or /uploads/library/…" />
                    <Button variant="secondary" size="sm" icon={ImageIcon} className="h-[42px] shrink-0" onClick={() => chooseMedia("image")}>Choose</Button>
                  </div>
                </Field>
                <Field label="Poster alt text">
                  <Input value={form.imageAlt} onChange={(event) => set("imageAlt", event.target.value)} placeholder="Wedding venue highlights video" />
                </Field>
              </>
            )}

            {form.section === "hero" && form.blockKey !== "video" && (
              <>
                <Field label="Headline">
                  <Input value={form.title} onChange={(event) => set("title", event.target.value)} placeholder="A venue as unforgettable as your love story." />
                </Field>
                <Field label="Copy">
                  <Textarea rows={3} value={form.body} onChange={(event) => set("body", event.target.value)} placeholder="One or two sentences about the venue promise." />
                </Field>
              </>
            )}

            {["about", "category", "feature", "faq", "cta"].includes(form.section) && (
              <Field label={form.section === "faq" ? "Answer" : "Description"} hint={form.section === "faq" ? "Keep the answer useful and specific." : undefined}>
                <Textarea rows={form.section === "faq" ? 4 : 3} value={form.body} onChange={(event) => set("body", event.target.value)} placeholder="Add a short description" />
              </Field>
            )}

            {form.section === "heading" && (
              <Field label="Intro line" hint="Optional. Sits under the heading.">
                <Textarea rows={2} value={form.body} onChange={(event) => set("body", event.target.value)} placeholder="One sentence that sets up the section." />
              </Field>
            )}

            {form.section === "step" && (
              <Field label="Step number">
                <Input value={form.subtitle} onChange={(event) => set("subtitle", event.target.value)} placeholder="01" className="max-w-[120px]" />
              </Field>
            )}

            {(form.section === "about" || form.section === "gallery" || (form.section === "hero" && form.blockKey !== "video")) && (
              <>
                <Field label={form.section === "about" ? "Image" : "Background image"}>
                  <div className="flex gap-2">
                    <Input value={form.image} onChange={(event) => set("image", event.target.value)} placeholder="https://… or /uploads/library/…" />
                    <Button variant="secondary" size="sm" icon={ImageIcon} className="h-[42px] shrink-0" onClick={() => chooseMedia("image")}>Choose</Button>
                  </div>
                </Field>
                <Field label="Image alt text" hint="Describe the image for accessibility and search engines.">
                  <Input value={form.imageAlt} onChange={(event) => set("imageAlt", event.target.value)} placeholder="A palace courtyard set for a wedding at golden hour" />
                </Field>
              </>
            )}

            {form.section === "film" && (
              <>
                <Field label="Video URL" hint="Use an MP4, WebM or MOV from the media library.">
                  <div className="flex gap-2">
                    <Input value={form.image} onChange={(event) => set("image", event.target.value)} placeholder="/uploads/library/reel.mp4" />
                    <Button variant="secondary" size="sm" icon={Video} className="h-[42px] shrink-0" onClick={() => chooseMedia("image")}>Choose</Button>
                  </div>
                </Field>
                <Field label="Placement">
                  <Select value={form.placement} onChange={(event) => set("placement", event.target.value)}>
                    {FILM_PLACEMENTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </Select>
                </Field>
              </>
            )}

            {["category", "feature"].includes(form.section) && (
              <Field label="Icon">
                <Select value={form.icon} onChange={(event) => set("icon", event.target.value)}>
                  {ICONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
              </Field>
            )}

            {form.section === "about" && (
              <>
                <Field label="Proof points" hint="One per line, using value | label. Keep these factual.">
                  <Textarea rows={4} value={form.stats} onChange={(event) => set("stats", event.target.value)} placeholder={"Venue-only|No decor or catering commissions\nHuman|Assisted follow-up\nPrivate|Quote-led proposals"} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Image badge" hint="Short line shown over the image."><Input value={form.badge} onChange={(event) => set("badge", event.target.value)} placeholder="Private, quote-led shortlists" /></Field>
                  <Field label="Phone"><Input value={form.phone} onChange={(event) => set("phone", event.target.value)} placeholder="+91 94624 60555" /></Field>
                </div>
              </>
            )}

            {form.section === "seo" && (
              <>
                <Field label="Heading">
                  <Input value={form.title} onChange={(event) => set("title", event.target.value)} placeholder="Finding wedding and party venues in India, without the legwork." />
                </Field>
                <Field label="Paragraphs" hint="Separate paragraphs with a blank line.">
                  <Textarea rows={9} value={form.body} onChange={(event) => set("body", event.target.value)} placeholder="Write the closing SEO copy here." />
                </Field>
              </>
            )}

            {["heading", "hero", "about", "category", "feature", "step", "film", "seo", "cta"].includes(form.section) && form.blockKey !== "video" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Link label" hint={form.section === "film" ? "Only used for the full-width band." : undefined}>
                  <Input value={form.linkLabel} onChange={(event) => set("linkLabel", event.target.value)} placeholder={form.section === "seo" ? "Optional" : "Explore venues"} />
                </Field>
                <Field label="Link URL">
                  <Input value={form.linkHref} onChange={(event) => set("linkHref", event.target.value)} placeholder="/venues" />
                </Field>
              </div>
            )}

            {(form.section === "cta" || (form.section === "hero" && form.blockKey !== "video")) && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Secondary button label"><Input value={form.secondaryLabel} onChange={(event) => set("secondaryLabel", event.target.value)} placeholder="Get a private quote" /></Field>
                <Field label="Secondary button URL"><Input value={form.secondaryHref} onChange={(event) => set("secondaryHref", event.target.value)} placeholder="/contact" /></Field>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status">
                <Select value={form.status} onChange={(event) => set("status", event.target.value as "published" | "draft")}>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </Select>
              </Field>
              {form.id && (
                <div className=" bg-[#f7f7f7] px-3 py-2.5">
                  <p className="text-[10px] text-[#8a8a8a]">Last updated</p>
                  <p className="mt-0.5 text-[11.5px] font-medium text-[#525252]">{formatDate(form.updatedAt || new Date().toISOString())}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        title="Remove this content?"
        description={deleteTarget ? blockHeading(deleteTarget) : ""}
        loading={deleting}
      />

      <MediaPicker
        open={Boolean(picker)}
        onClose={() => setPicker(null)}
        kind={picker?.kind || "image"}
        title={picker?.title || "Choose media"}
        onSelect={(url: string, _item: MediaItem) => {
          if (!picker) return;
          set(picker.field, url);
        }}
      />
    </div>
  );
}
