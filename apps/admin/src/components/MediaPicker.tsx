"use client";

import { useState } from "react";
import useSWR from "swr";
import { FileVideo, Image as ImageIcon } from "lucide-react";
import { apiWithMeta } from "@/lib/api";
import type { MediaItem } from "@/lib/types";
import { formatBytes } from "@/lib/utils";
import { EmptyState, Modal, SearchInput, Skeleton } from "@/components/ui";

export function MediaPicker({
  open,
  onClose,
  onSelect,
  kind = "image",
  title = "Choose an image",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string, item: MediaItem) => void;
  kind?: "image" | "video";
  title?: string;
}) {
  const [query, setQuery] = useState("");
  const { data, isLoading } = useSWR<{ data: MediaItem[] }>(
    open ? `/api/admin/media?limit=100&kind=${kind}${query ? `&q=${encodeURIComponent(query)}` : ""}` : null,
    (url: string) => apiWithMeta<MediaItem[]>(url),
    { keepPreviousData: true }
  );
  const items = data?.data || [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={kind === "video" ? "Pick a video from the media library." : "Pick an image from the media library."}
      size="lg"
    >
      <div className="space-y-4">
        <SearchInput value={query} onChange={setQuery} placeholder="Search by filename or alt text…" />
        {isLoading && !data && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="aspect-[4/3] rounded-lg" />
            ))}
          </div>
        )}
        {!isLoading && items.length === 0 && (
          <EmptyState
            icon={kind === "video" ? FileVideo : ImageIcon}
            title={query ? "Nothing matches" : `No ${kind}s yet`}
            description={query ? "Try a different search." : "Upload files in the media library first, then return here."}
          />
        )}
        {items.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelect(item.url, item);
                  onClose();
                }}
                className="group overflow-hidden rounded-lg border border-line bg-white text-left transition hover:border-ink"
              >
                <span className="relative grid aspect-[4/3] place-items-center overflow-hidden bg-cream-soft">
                  {item.kind === "video" ? (
                    <>
                      <video src={item.url} className="h-full w-full object-cover" muted preload="metadata" />
                      <span className="absolute inset-0 grid place-items-center bg-ink/25 text-white">
                        <FileVideo size={22} />
                      </span>
                    </>
                  ) : (
                    <img src={item.url} alt={item.alt || item.originalName} className="h-full w-full object-cover" loading="lazy" />
                  )}
                </span>
                <span className="block px-2.5 py-2">
                  <span className="block truncate text-[10.5px] font-semibold text-ink">{item.originalName}</span>
                  <span className="mt-0.5 block text-[9.5px] text-[#948771]">
                    {item.kind === "video" ? "Video" : "Image"}
                    {item.size > 0 ? ` · ${formatBytes(item.size)}` : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
