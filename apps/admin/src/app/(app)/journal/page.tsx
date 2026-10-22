"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { BookOpen, Check, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api, apiWithMeta, queryString } from "@/lib/api";
import { useDebounced } from "@/lib/hooks";
import { useRealtime } from "@/lib/realtime";
import { useToast } from "@/lib/toast";
import type { Post } from "@/lib/types";
import { PUBLISH_STATUS, formatDate } from "@/lib/utils";
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

interface PostForm {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  author: string;
  publishedOn: string;
  readingMinutes: string;
  image: string;
  imageAlt: string;
  body: string;
  status: "published" | "draft";
}

const EMPTY: PostForm = {
  title: "",
  slug: "",
  excerpt: "",
  category: "Journal",
  author: "Venue On My Plate Studio",
  publishedOn: new Date().toISOString().slice(0, 10),
  readingMinutes: "5",
  image: "",
  imageAlt: "",
  body: "",
  status: "published",
};

function toForm(post: Post): PostForm {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    category: post.category,
    author: post.author,
    publishedOn: post.publishedOn?.slice(0, 10) || "",
    readingMinutes: String(post.readingMinutes),
    image: post.image,
    imageAlt: post.imageAlt,
    body: post.body.join("\n\n"),
    status: post.status,
  };
}

export default function JournalPage() {
  const { toast } = useToast();
  const { seq } = useRealtime();
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 280);
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<PostForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => setPage(1), [debounced, status]);
  const url = `/api/admin/posts${queryString({ q: debounced, status, page, limit: 20 })}`;
  const { data, mutate, isValidating } = useSWR<Envelope<Post[]>>(url, fetchEnvelope);
  useEffect(() => { if (seq > 0) mutate(); }, [seq, mutate]);

  const counts = data?.meta?.counts || {};
  const rows = data?.data || [];

  async function save() {
    if (!form) return;
    if (!form.title.trim()) { toast("Add a title", { tone: "error" }); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        slug: form.slug || undefined,
        excerpt: form.excerpt,
        category: form.category,
        author: form.author,
        publishedOn: form.publishedOn,
        readingMinutes: Number(form.readingMinutes) || 5,
        image: form.image,
        imageAlt: form.imageAlt,
        body: form.body.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean),
        status: form.status,
      };
      if (form.id) await api(`/api/admin/posts/${form.id}`, { method: "PATCH", body: payload });
      else await api("/api/admin/posts", { method: "POST", body: payload });
      toast(form.id ? "Story updated" : "Story published", { description: form.title });
      setForm(null);
      await mutate();
    } catch (error) {
      toast("Could not save story", { description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(post: Post) {
    setDeleting(true);
    try {
      await api(`/api/admin/posts/${post.id}`, { method: "DELETE" });
      toast("Story removed", { description: post.title });
      setDeleteTarget(null);
      await mutate();
    } catch (error) {
      toast("Could not remove story", { description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Journal"
        description="Editorial stories that bring search traffic and answer the questions couples ask before they enquire."
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={() => mutate()} loading={isValidating}>Refresh</Button>
            <Button variant="primary" icon={Plus} onClick={() => setForm({ ...EMPTY })}>New story</Button>
          </>
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
          <SearchInput value={query} onChange={setQuery} placeholder="Search title, category or author…" className="w-full md:max-w-[380px]" />
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

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[820px]">
            <thead>
              <tr><th>Story</th><th>Category</th><th>Status</th><th>Published</th><th>Read</th><th>Updated</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((post) => (
                <tr key={post.id} className="cursor-pointer" onClick={() => setForm(toForm(post))}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-14 shrink-0 overflow-hidden  bg-[#f0f0f0]">
                        {post.image ? <img src={post.image} alt="" className="h-full w-full object-cover" loading="lazy" /> : <div className="grid h-full w-full place-items-center text-[#a3a3a3]"><BookOpen size={15} /></div>}
                      </div>
                      <div className="min-w-0">
                        <p className="max-w-[360px] truncate text-[12px] font-semibold text-ink">{post.title}</p>
                        <p className="max-w-[360px] truncate text-[10.5px] text-muted">{post.excerpt || post.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td><Badge className="bg-[#f7f7f7] text-[#525252] ring-ink/6">{post.category}</Badge></td>
                  <td><StatusPill value={post.status} map={PUBLISH_STATUS} /></td>
                  <td><span className="whitespace-nowrap text-[10.5px] text-[#525252]">{formatDate(post.publishedOn)}</span></td>
                  <td><span className="text-[10.5px] text-muted">{post.readingMinutes} min</span></td>
                  <td><span className="whitespace-nowrap text-[10px] text-muted">{formatDate(post.updatedAt)}</span></td>
                  <td>
                    <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                      <button type="button" onClick={() => setForm(toForm(post))} className="grid h-7 w-7 place-items-center  text-muted hover:bg-[#f7f7f7] hover:text-[#525252]" title="Edit"><Pencil size={12} /></button>
                      <button type="button" onClick={() => setDeleteTarget(post)} className="grid h-7 w-7 place-items-center  text-[#a3a3a3] hover:bg-[#f7f7f7] hover:text-ink" title="Delete"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data && <div className="space-y-3 p-4">{[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-14" />)}</div>}
        {data && rows.length === 0 && <EmptyState icon={BookOpen} title="No stories yet" description="Write the first journal entry to build organic traffic and trust." action={<Button variant="primary" size="sm" icon={Plus} onClick={() => setForm({ ...EMPTY })}>Write a story</Button>} />}
        {data?.meta && <Pagination page={data.meta.page} pages={data.meta.pages} total={data.meta.total} limit={data.meta.limit} onPage={setPage} />}
      </Card>

      <Drawer
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? "Edit story" : "New journal story"}
        subtitle={form?.title || "A story for the Venue On My Plate journal"}
        size="lg"
        footer={form ? (
          <div className="flex items-center justify-between">
            {form.id ? <Button variant="ghost" size="sm" icon={Trash2} className="text-[#6b6b6b] hover:bg-[#f7f7f7] hover:text-ink" onClick={() => { const post = rows.find((row) => row.id === form.id); if (post) setDeleteTarget(post); }}>Delete</Button> : <span />}
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setForm(null)}>Cancel</Button>
              <Button variant="primary" size="sm" icon={Check} loading={saving} onClick={save}>Save story</Button>
            </div>
          </div>
        ) : null}
      >
        {form && (
          <div className="space-y-4 p-5">
            <Field label="Title" required><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="How to choose a wedding venue in India" /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Slug"><Input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="choose-wedding-venue-india" /></Field>
              <Field label="Category"><Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Planning" /></Field>
              <Field label="Author"><Input value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} /></Field>
              <Field label="Published on"><Input type="date" value={form.publishedOn} onChange={(event) => setForm({ ...form, publishedOn: event.target.value })} /></Field>
              <Field label="Reading minutes"><Input type="number" min={1} value={form.readingMinutes} onChange={(event) => setForm({ ...form, readingMinutes: event.target.value })} /></Field>
              <Field label="Status">
                <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as PostForm["status"] })}>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </Select>
              </Field>
            </div>
            <Field label="Excerpt"><Textarea rows={2} value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} /></Field>
            <Field label="Body" hint="Separate paragraphs with a blank line."><Textarea rows={12} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Start writing…" /></Field>
            <Field label="Cover image URL"><Input value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} placeholder="https://…" /></Field>
            {form.image && <div className="h-32 overflow-hidden  border border-ink/8"><img src={form.image} alt="" className="h-full w-full object-cover" /></div>}
            <Field label="Image alt text"><Input value={form.imageAlt} onChange={(event) => setForm({ ...form, imageAlt: event.target.value })} /></Field>
          </div>
        )}
      </Drawer>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && remove(deleteTarget)} title="Remove this story?" description={deleteTarget ? deleteTarget.title : ""} loading={deleting} />
    </div>
  );
}
