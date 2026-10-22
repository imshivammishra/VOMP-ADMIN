"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Inbox,
  Loader2,
  MessageSquareText,
  Search,
  Star,
  type LucideIcon,
} from "lucide-react";
import { NAVIGATION_ITEMS } from "@/config/navigation";
import { api } from "@/lib/api";
import { useDebounced } from "@/lib/hooks";
import type { SearchResults } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui";

interface Item {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  group: string;
}

const QUICK: Item[] = NAVIGATION_ITEMS.map((item) => ({
  key: `nav-${item.href}`,
  label: item.label,
  description: item.description,
  href: item.href,
  icon: item.icon,
  group: "Go to",
}));

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebounced(query.trim(), 220);

  const { data, isValidating } = useSWR<SearchResults>(
    open && debounced.length >= 2 ? `/api/admin/search?q=${encodeURIComponent(debounced)}` : null,
    (url: string) => api<SearchResults>(url),
    { keepPreviousData: true }
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [debounced]);

  const items: Item[] = useMemo(() => {
    if (!debounced || debounced.length < 2) return QUICK;
    if (!data) return [];
    const list: Item[] = [];
    for (const row of data.enquiries) {
      list.push({
        key: `e-${row.id}`,
        label: `${row.reference} · ${row.name}`,
        description: [row.phone, row.city, row.status].filter(Boolean).join(" · "),
        href: row.href,
        icon: MessageSquareText,
        group: "Enquiries",
      });
    }
    for (const row of data.threads) {
      list.push({
        key: `t-${row.id}`,
        label: row.customer_name,
        description: [row.reference, row.phone, row.city].filter(Boolean).join(" · "),
        href: row.href,
        icon: Inbox,
        group: "Conversations",
      });
    }
    for (const row of data.venues) {
      list.push({
        key: `v-${row.id}`,
        label: row.name,
        description: [row.city, row.status].filter(Boolean).join(" · "),
        href: row.href,
        icon: Building2,
        group: "Venues",
      });
    }
    for (const row of data.posts) {
      list.push({
        key: `p-${row.id}`,
        label: row.title,
        description: [row.category, row.status].filter(Boolean).join(" · "),
        href: row.href,
        icon: BookOpen,
        group: "Journal",
      });
    }
    for (const row of data.partners) {
      list.push({
        key: `pa-${row.id}`,
        label: row.venue_name,
        description: [row.contact_name, row.city, row.status].filter(Boolean).join(" · "),
        href: row.href,
        icon: Star,
        group: "Partners",
      });
    }
    return list;
  }, [debounced, data]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((value) => (items.length ? (value + 1) % items.length : 0));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((value) => (items.length ? (value - 1 + items.length) % items.length : 0));
      }
      if (event.key === "Enter" && items[active]) {
        event.preventDefault();
        router.push(items[active].href);
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items, active, router, onClose]);

  if (!open || typeof document === "undefined") return null;

  const groups = items.reduce<Record<string, Item[]>>((acc, item) => {
    acc[item.group] = acc[item.group] || [];
    acc[item.group].push(item);
    return acc;
  }, {});
  let runningIndex = -1;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[10vh]">
      <button type="button" aria-label="Close search" onClick={onClose} className="absolute inset-0 cursor-default bg-ink/35" />
      <div className="modal-in relative w-full max-w-[620px] overflow-hidden border border-ink bg-white">
        <div className="flex items-center gap-3 border-b border-line px-4">
          {isValidating && debounced.length >= 2 ? (
            <Loader2 size={17} className="animate-spin text-muted" />
          ) : (
            <Search size={17} className="text-[#a3a3a3]" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search enquiries, conversations, venues, journal…"
            className="h-[54px] flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-[#a3a3a3] focus:outline-none"
          />
          <Kbd>ESC</Kbd>
        </div>

        <div className="scrollbar-thin max-h-[52vh] min-h-[180px] overflow-y-auto p-2">
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <Search size={20} className="text-[#a3a3a3]" />
              <p className="mt-3 text-[13px] font-semibold text-ink">
                {debounced.length < 2 ? "Type at least two characters" : "No matches found"}
              </p>
              <p className="mt-1 text-[11.5px] text-muted">
                {debounced.length < 2 ? "Search across every record in the workspace." : "Try a name, phone number, reference or city."}
              </p>
            </div>
          )}
          {Object.entries(groups).map(([group, groupItems]) => (
            <div key={group} className="mb-1.5">
              <p className="px-2.5 py-1.5 text-[8.5px] font-semibold tracking-[0.18em] text-[#8a8a8a] uppercase">{group}</p>
              {groupItems.map((item) => {
                runningIndex += 1;
                const index = runningIndex;
                const isActive = index === active;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => {
                      router.push(item.href);
                      onClose();
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-2.5 py-2.5 text-left transition-colors",
                      isActive ? "bg-[#f5f5f5]" : "hover:bg-[#fafafa]"
                    )}
                  >
                    <span className={cn("grid h-8 w-8 shrink-0 place-items-center", isActive ? "bg-ink text-white" : "bg-[#f5f5f5] text-[#6b6b6b] ring-1 ring-line/70")}>
                      <item.icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold text-ink">{item.label}</span>
                      <span className="block truncate text-[11px] text-muted">{item.description}</span>
                    </span>
                    <ArrowRight size={14} className={cn("shrink-0", isActive ? "text-muted" : "text-transparent")} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-line bg-[#fafafa] px-4 py-2.5 text-[9px] text-muted">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd> open
            </span>
          </span>
          <span className="font-semibold tracking-[0.12em] text-[#6b6b6b] uppercase">VOMP command</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
