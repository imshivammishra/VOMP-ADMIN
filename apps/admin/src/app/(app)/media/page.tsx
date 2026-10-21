"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import {
  Check,
  Copy,
  FileVideo,
  Image as ImageIcon,
  Images,
  Loader2,
  RefreshCw,
  Trash2,
  UploadCloud,
  Video,
} from "lucide-react";
import { api, apiWithMeta, copyText, queryString } from "@/lib/api";
import { useDebounced } from "@/lib/hooks";
import { useRealtime } from "@/lib/realtime";
import { useToast } from "@/lib/toast";
import type { MediaItem } from "@/lib/types";
import { cn, formatBytes, formatDate } from "@/lib/utils";
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
  Skeleton,
  Tabs,
} from "@/components/ui";

interface ListMeta { total: number; page: number; limit: number; pages: number; hasMore: boolean; counts?: Record<string, number> }
type Envelope<T> = { data: T; meta?: ListMeta };
function fetchEnvelope<T>(url: string) { return apiWithMeta<T>(url) as Promise<Envelope<T>>; }

const MAX_IMAGE_MB = 8;
const MAX_VIDEO_MB = 80;

export default function MediaPage() {
  const { toast } = useToast();
  const { seq } = useRealtime();
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 280);
  const [kind, setKind] = useState("all");
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [detail, setDetail] = useState<MediaItem | null>(null);
  const [alt, setAlt] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setPage(1), [debounced, kind]);
  const url = `/api/admin/media${queryString({ q: debounced, kind, page, limit: 24 })}`;
  const { data, mutate, isValidating } = useSWR<Envelope<MediaItem[]>>(url, fetchEnvelope);

  useEffect(() => { if (seq > 0) mutate(); }, [seq, mutate]);

  async function uploadFiles(files: FileList | File[] | null) {
    if (!files || !files.length) return;
    const file = files[0];
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      toast("Choose an image or video file", { tone: "error" });
      return;
    }
    if (isImage && file.size > MAX_IMAGE_MB * 1024 * 1024) {
      toast(`Image is larger than ${MAX_IMAGE_MB} MB`, { tone: "error" });
      return;
    }
    if (isVideo && file.size > MAX_VIDEO_MB * 1024 * 1024) {
      toast(`Video is larger than ${MAX_VIDEO_MB} MB`, { tone: "error" });
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await api<MediaItem>("/api/admin/media", { method: "POST", body: form });
      toast(isVideo ? "Video uploaded" : "Image uploaded", { description: file.name });
      await mutate();
    } catch (error) {
      toast("Upload failed", { description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function saveAlt() {
    if (!detail) return;
    setSaving(true);
    try {
      const updated = await api<MediaItem>(`/api/admin/media/${detail.id}`, { method: "PATCH", body: { alt } });
      setDetail(updated);
      await mutate();
      toast("Alt text saved");
    } catch (error) {
      toast("Could not save alt text", { description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: MediaItem) {
    setDeleting(true);
    try {
      await api(`/api/admin/media/${item.id}`, { method: "DELETE" });
      toast(item.kind === "video" ? "Video removed" : "Image removed", { description: item.originalName });
      setDeleteTarget(null);
      if (detail?.id === item.id) setDetail(null);
      await mutate();
    } catch (error) {
      toast("Could not remove this file", { description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setDeleting(false);
    }
  }

  const items = data?.data || [];
  const totalBytes = items.reduce((sum, item) => sum + item.size, 0);
  const counts = data?.meta?.counts || {};
  const kindTabs = [
    { value: "all", label: "All files", count: counts.all || data?.meta?.total || 0 },
    { value: "image", label: "Images", count: counts.image || 0 },
    { value: "video", label: "Videos", count: counts.video || 0 },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Growth"
        title="Media library"
        description="The image and video store behind venues, destinations, page content and journal stories. Upload once, copy the URL, reuse everywhere."
        actions={<Button variant="secondary" icon={RefreshCw} onClick={() => mutate()} loading={isValidating}>Refresh</Button>}
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card
          className={cn(
            "relative flex min-h-[164px] cursor-pointer flex-col items-center justify-center overflow-hidden border-2 border-dashed p-6 text-center transition",
            dragging ? "border-[#525252] bg-cream-soft" : "border-[#a3a3a3]/35 hover:border-[#525252]/60 hover:bg-cream-soft"
          )}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); uploadFiles(event.dataTransfer.files); }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm,video/quicktime,video/x-m4v"
            className="hidden"
            onChange={(event) => uploadFiles(event.target.files)}
          />
          <span className="grid h-12 w-12 place-items-center rounded-full bg-cream-soft text-[#5f574a] ring-1 ring-[#a3a3a3]/25">
            {uploading ? <Loader2 size={20} className="animate-spin" /> : <UploadCloud size={20} />}
          </span>
          <p className="mt-3 text-[13px] font-semibold text-ink">
            {uploading ? "Uploading file…" : "Drop a file here, or click to browse"}
          </p>
          <p className="mt-1 text-[11px] text-muted">Images up to {MAX_IMAGE_MB} MB · videos up to {MAX_VIDEO_MB} MB</p>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <p className="text-[9px] font-bold tracking-[0.16em] text-[#5f574a] uppercase">Library</p>
            <p className="font-display mt-1 text-[34px] leading-none font-semibold text-ink">{data?.meta?.total || 0}</p>
            <p className="mt-1.5 text-[10.5px] text-muted">files stored</p>
          </Card>
          <Card className="p-4">
            <p className="text-[9px] font-bold tracking-[0.16em] text-[#5f574a] uppercase">This page</p>
            <p className="font-display mt-1 text-[34px] leading-none font-semibold text-ink">{totalBytes > 0 ? formatBytes(totalBytes) : "—"}</p>
            <p className="mt-1.5 text-[10.5px] text-muted">across {items.length} files</p>
          </Card>
          <Card className="col-span-2 p-4">
            <p className="flex items-center gap-1.5 text-[9px] font-bold tracking-[0.16em] text-[#5f574a] uppercase"><Images size={11} /> How it works</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
              Uploaded files are served from the API&apos;s <code className="rounded bg-cream-soft px-1">/uploads</code> path and proxied by both domains in production. Use the copied URL in any image or video field.
            </p>
          </Card>
        </div>
      </div>

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput value={query} onChange={setQuery} placeholder="Search filename or description…" className="w-full sm:max-w-[380px]" />
            <span className="text-[10.5px] text-muted">{items.length} files on this page</span>
          </div>
          <Tabs tabs={kindTabs} value={kind} onChange={setKind} />
        </div>
      </Card>

      {!data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => <Skeleton key={item} className="h-[210px] rounded-xl" />)}
        </div>
      )}

      {data && items.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <Card key={item.id} className="group overflow-hidden transition hover:-translate-y-0.5 hover:border-line">
              <button type="button" onClick={() => { setDetail(item); setAlt(item.alt); }} className="relative block aspect-[4/3] w-full overflow-hidden bg-cream">
                {item.kind === "video" ? (
                  <>
                    <video src={item.url} className="h-full w-full object-cover" muted preload="metadata" />
                    <span className="absolute inset-0 grid place-items-center bg-ink/25 text-white"><Video size={24} /></span>
                  </>
                ) : (
                  <img src={item.url} alt={item.alt || item.originalName} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" loading="lazy" />
                )}
                <span className="absolute top-2 right-2 rounded-full bg-ink/55 px-2 py-0.5 text-[8.5px] font-semibold text-white">
                  {item.kind === "video" ? "video" : item.size > 0 ? formatBytes(item.size) : "image"}
                </span>
              </button>
              <div className="p-3">
                <p className="truncate text-[11px] font-semibold text-ink" title={item.originalName}>{item.originalName}</p>
                <p className="mt-0.5 truncate text-[9.5px] text-muted">{item.alt || "No alt text"}</p>
                <div className="mt-2 flex items-center justify-between border-t border-ink/5 pt-2">
                  <span className="text-[8.5px] text-[#a79b88]">{formatDate(item.createdAt)}</span>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => copyText(item.url).then(() => toast(item.kind === "video" ? "Video URL copied" : "Image URL copied")).catch(() => toast("Could not copy URL", { tone: "error" }))}
                      className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-cream-soft hover:text-[#5f574a]"
                      title="Copy URL"
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="grid h-7 w-7 place-items-center rounded-full text-[#a79b88] hover:bg-cream-soft hover:text-ink"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {data && items.length === 0 && (
        <Card>
          <EmptyState
            icon={kind === "video" ? FileVideo : ImageIcon}
            title={debounced ? "No files match" : kind === "video" ? "No videos yet" : "No images yet"}
            description={debounced ? "Try a different filename or description." : "Upload the first file to build your venue, page and journal library."}
            action={!debounced ? <Button variant="primary" size="sm" icon={UploadCloud} onClick={() => inputRef.current?.click()}>Choose a file</Button> : undefined}
          />
        </Card>
      )}

      {data?.meta && (
        <div className="mt-4"><Card><Pagination page={data.meta.page} pages={data.meta.pages} total={data.meta.total} limit={data.meta.limit} onPage={setPage} /></Card></div>
      )}

      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.originalName || "File"}
        subtitle={detail ? `${detail.size > 0 ? formatBytes(detail.size) : "External media"} · ${detail.mime} · uploaded ${formatDate(detail.createdAt)}` : ""}
        size="md"
        footer={detail ? (
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" icon={Trash2} className="text-[#817665] hover:bg-cream-soft hover:text-ink" onClick={() => setDeleteTarget(detail)}>Delete</Button>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" icon={Copy} onClick={() => copyText(detail.url).then(() => toast(detail.kind === "video" ? "Video URL copied" : "Image URL copied"))}>Copy URL</Button>
              <Button variant="primary" size="sm" icon={Check} loading={saving} onClick={saveAlt}>Save description</Button>
            </div>
          </div>
        ) : null}
      >
        {detail && (
          <div className="space-y-4 p-5">
            <div className="overflow-hidden rounded-xl border border-ink/8 bg-cream">
              {detail.kind === "video" ? (
                <video src={detail.url} controls className="max-h-[340px] w-full bg-ink object-contain" />
              ) : (
                <img src={detail.url} alt={detail.alt || detail.originalName} className="max-h-[340px] w-full object-contain" />
              )}
            </div>
            <Field label={detail.kind === "video" ? "Video URL" : "Image URL"}>
              <div className="flex gap-2">
                <Input value={detail.url} readOnly className="text-[11px]" />
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Copy}
                  className="h-[42px] shrink-0"
                  onClick={() => copyText(detail.url).then(() => toast(detail.kind === "video" ? "Video URL copied" : "Image URL copied")).catch(() => toast("Could not copy", { tone: "error" }))}
                >
                  Copy
                </Button>
              </div>
            </Field>
            <Field label="Description / alt text" hint="Describe the file for accessibility and search engines.">
              <Input value={alt} onChange={(event) => setAlt(event.target.value)} placeholder={detail.kind === "video" ? "A short wedding film from a palace venue" : "A palace courtyard set for a wedding at golden hour"} />
            </Field>
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-cream-soft p-3">
              <div><p className="text-[9px] font-bold tracking-[0.1em] text-[#a79b88] uppercase">Type</p><p className="mt-1 text-[11px] font-semibold text-ink">{detail.mime}</p></div>
              <div><p className="text-[9px] font-bold tracking-[0.1em] text-[#a79b88] uppercase">Uploaded by</p><p className="mt-1 text-[11px] font-semibold text-ink">{detail.uploadedBy}</p></div>
            </div>
            <div className="rounded-xl border border-line bg-cream-soft p-3 text-[10.5px] leading-relaxed text-muted">
              <Badge className="mr-1.5 bg-white text-[#5f574a] ring-[#a3a3a3]/25">Tip</Badge>
              Use this URL in page content, venues, destinations or journal stories. The public site serves the same file from its own domain.
            </div>
          </div>
        )}
      </Drawer>

        <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && remove(deleteTarget)} title="Delete this file?" description={deleteTarget ? `${deleteTarget.originalName}${deleteTarget.size > 0 ? ` · ${formatBytes(deleteTarget.size)}` : ""}` : ""} loading={deleting} />
    </div>
  );
}
