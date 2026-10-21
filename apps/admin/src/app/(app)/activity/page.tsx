"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  Activity,
  BookOpen,
  Building2,
  Image as ImageIcon,
  Inbox,
  MessageSquareText,
  RefreshCw,
  Settings,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import { api, queryString } from "@/lib/api";
import { useDebounced } from "@/lib/hooks";
import { useRealtime } from "@/lib/realtime";
import type { ActivityItem } from "@/lib/types";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, SearchInput, Skeleton } from "@/components/ui";

const ENTITIES = [
  { value: "all", label: "Everything" },
  { value: "enquiry", label: "Enquiries" },
  { value: "thread", label: "Conversations" },
  { value: "partner", label: "Partners" },
  { value: "venue", label: "Venues" },
  { value: "post", label: "Journal" },
  { value: "media", label: "Media" },
  { value: "user", label: "Team" },
  { value: "settings", label: "Settings" },
];

const ENTITY_STYLE: Record<string, { icon: typeof Activity; className: string }> = {
  enquiry: { icon: MessageSquareText, className: "bg-cream-soft text-[#5f574a]" },
  thread: { icon: Inbox, className: "bg-cream-soft text-[#5f574a]" },
  partner: { icon: Star, className: "bg-cream-soft text-[#5f574a]" },
  venue: { icon: Building2, className: "bg-cream-soft text-ink" },
  post: { icon: BookOpen, className: "bg-ink text-white" },
  media: { icon: ImageIcon, className: "bg-cream-soft text-[#5f574a]" },
  user: { icon: Users, className: "bg-cream-soft text-[#5f574a]" },
  settings: { icon: Settings, className: "bg-cream-soft text-muted" },
  session: { icon: ShieldCheck, className: "bg-cream-soft text-[#5f574a]" },
};

function actionLabel(action: string) {
  return action
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ActivityPage() {
  const { seq } = useRealtime();
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 280);
  const [entity, setEntity] = useState("all");

  const url = `/api/admin/overview/activity${queryString({ q: debounced, entity, limit: 100 })}`;
  const { data, mutate, isValidating } = useSWR<ActivityItem[]>(url, (path: string) => api<ActivityItem[]>(path));

  useEffect(() => { if (seq > 0) mutate(); }, [seq, mutate]);

  const rows = useMemo(() => data ?? [], [data]);
  const grouped = useMemo(() => {
    const groups: { day: string; items: ActivityItem[] }[] = [];
    for (const item of rows) {
      const day = new Date(item.createdAt).toDateString();
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(item);
      else groups.push({ day, items: [item] });
    }
    return groups;
  }, [rows]);

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Activity log"
        description="A permanent trail of every change in the workspace — who did what, when, and to which record."
        actions={<Button variant="secondary" icon={RefreshCw} onClick={() => mutate()} loading={isValidating}>Refresh</Button>}
      />

      <Card className="mb-4 p-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search actor, action or detail…" className="w-full" />
        <div className="no-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto">
          {ENTITIES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setEntity(item.value)}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1.5 text-[10.5px] font-semibold transition",
                entity === item.value ? "bg-ink text-white" : "bg-white text-[#5f574a] ring-1 ring-ink/8 hover:text-ink"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Card>

      {!data && <div className="space-y-3">{[0, 1, 2, 3, 4, 5].map((row) => <Skeleton key={row} className="h-16 rounded-xl" />)}</div>}

      {data && rows.length === 0 && (
        <Card><EmptyState icon={Activity} title="No activity found" description="Try clearing the search or choosing another area." /></Card>
      )}

      <div className="space-y-5">
        {grouped.map((group) => (
          <div key={group.day}>
            <div className="mb-2 flex items-center gap-3">
              <p className="text-[9px] font-bold tracking-[0.18em] text-[#a79b88] uppercase">
                {group.day === new Date().toDateString()
                  ? "Today"
                  : new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(group.day))}
              </p>
              <span className="h-px flex-1 bg-ink/6" />
              <span className="text-[9px] text-[#a79b88]">{group.items.length} events</span>
            </div>
            <Card className="overflow-hidden">
              <div className="divide-y divide-black/4">
                {group.items.map((item) => {
                  const style = ENTITY_STYLE[item.entity] || { icon: Activity, className: "bg-cream-soft text-[#5f574a]" };
                  const Icon = style.icon;
                  return (
                    <div key={item.id} className="flex items-start gap-3 px-4 py-3.5 transition hover:bg-cream-soft">
                      <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full", style.className)}>
                        <Icon size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[11.5px] font-semibold text-ink">{actionLabel(item.action)}</p>
                          <Badge className="bg-cream-soft text-muted ring-ink/6">{item.entity}</Badge>
                        </div>
                        <p className="mt-0.5 text-[11.5px] leading-relaxed text-[#5f574a]">{item.detail}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-[9.5px] text-[#a79b88]">
                          <Avatar name={item.actor} size="xs" className="h-4 w-4 text-[7px]" />
                          {item.actor} · {formatDateTime(item.createdAt)} · {timeAgo(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
