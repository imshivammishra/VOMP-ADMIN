"use client";

import Link from "next/link";
import { useEffect } from "react";
import useSWR from "swr";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Clock3,
  Inbox,
  MessageSquareText,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/lib/realtime";
import type { Overview } from "@/lib/types";
import {
  ENQUIRY_STATUS,
  cn,
  formatNumber,
  greeting,
  sourceLabel,
  timeAgo,
} from "@/lib/utils";
import { Avatar, Button, Card, PageHeader, Skeleton, StatusPill } from "@/components/ui";
import { SourceBars, StatusDonut, TrendChart } from "@/components/charts";

const STATUS_COLORS: Record<string, string> = {
  new: "#0a0a0a",
  contacted: "#404040",
  qualified: "#737373",
  won: "#262626",
  lost: "#a3a3a3",
  closed: "#e5e5e5",
};

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) {
    return <span className="text-[11px] text-[#8a8a8a]">No change</span>;
  }
  const change = previous === 0 ? 100 : Math.round(((current - previous) / previous) * 100);
  const up = change >= 0;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px]", up ? "text-muted" : "text-[#8a8a8a]")}>
      {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {Math.abs(change)}% vs last week
    </span>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  detail,
  delta,
  href,
}: {
  icon: typeof MessageSquareText;
  label: string;
  value: string | number;
  detail: string;
  delta?: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group border border-line bg-white p-5 transition-colors duration-150 hover:border-ink"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center bg-[#f5f5f5] text-ink">
          <Icon size={17} strokeWidth={1.8} />
        </span>
        <span className="grid h-7 w-7 place-items-center text-brand-faint transition-colors group-hover:bg-ink group-hover:text-white">
          <ArrowUpRight size={14} />
        </span>
      </div>
      <p className="mt-6 text-[8.5px] font-bold tracking-[0.18em] text-brand-faint uppercase">
        {label}
      </p>
      <p className="mt-1.5 text-[36px] leading-none font-semibold tracking-[-0.05em] text-ink tabular-nums">
        {value}
      </p>
      <p className="mt-2.5 truncate text-[11px] leading-relaxed text-muted">{detail}</p>
      {delta && <div className="mt-3 border-t border-line pt-2.5">{delta}</div>}
    </Link>
  );
}

function activityIcon(action: string) {
  if (action.startsWith("enquiry")) return MessageSquareText;
  if (action.startsWith("chat") || action.startsWith("thread")) return Inbox;
  if (action.startsWith("venue")) return Building2;
  if (action.startsWith("partner")) return Star;
  if (action.startsWith("team") || action.startsWith("auth")) return Users;
  return Sparkles;
}

export default function OverviewPage() {
  const { user } = useAuth();
  const { seq } = useRealtime();
  const { data, error, mutate, isValidating } = useSWR<Overview>("/api/admin/overview", {
    refreshInterval: 45_000,
  });

  useEffect(() => {
    if (seq > 0) mutate();
  }, [seq, mutate]);

  if (!data) {
    return (
      <div>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-3 h-8 w-72" />
            <Skeleton className="mt-3 h-3 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-[168px]" />
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Skeleton className="h-[330px]" />
          <Skeleton className="h-[330px]" />
        </div>
        {error && <p className="mt-4 text-[12px] text-[#525252]">The dashboard could not load. Check the API connection.</p>}
      </div>
    );
  }

  const stats = data.stats;
  const sourceData = data.sources.map((row) => ({ ...row, label: sourceLabel(row.source) }));
  const today = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div>
      <PageHeader
        eyebrow={today}
        title={`${greeting()}, ${user?.name?.split(" ")[0] || "there"}.`}
        description="A live view of enquiries, conversations and the venue catalogue."
        actions={
          <>
            <Button variant="secondary" size="md" icon={RefreshCw} onClick={() => mutate()} loading={isValidating}>
              Refresh
            </Button>
            <Link href="/venues?new=1">
              <Button variant="primary" size="md" icon={Plus}>
                Add venue
              </Button>
            </Link>
          </>
        }
      />

      <section className="fade-up relative mb-4 overflow-hidden border-2 border-ink bg-white">
        <div className="grid lg:grid-cols-[1fr_300px]">
          <div className="relative px-6 py-7 md:px-8">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-0 right-0 h-full w-24 border-l border-line"
            />
            <p className="flex items-center gap-2 text-[8px] font-bold tracking-[0.22em] text-brand-faint uppercase">
              <span className="h-1.5 w-1.5 bg-ink live-dot" />
              Today&apos;s focus
            </p>
            <h2 className="font-display mt-3 max-w-2xl text-[34px] leading-[0.95] font-semibold tracking-[-0.03em] text-ink md:text-[42px]">
              {stats.newEnquiries > 0 || stats.unreadMessages > 0
                ? "Keep every conversation moving."
                : "Everything is clear for now."}
            </h2>
            <p className="mt-3 max-w-xl text-[11.5px] leading-relaxed text-muted">
              {stats.newEnquiries > 0 || stats.unreadMessages > 0
                ? `${formatNumber(stats.newEnquiries)} new enquir${stats.newEnquiries === 1 ? "y" : "ies"} and ${formatNumber(stats.unreadMessages)} unread message${stats.unreadMessages === 1 ? "" : "s"} are waiting for your team.`
                : "No enquiries need a first response and the inbox is clear. A good moment to refine the website or add a venue."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/enquiries?status=new">
                <Button variant="primary" size="sm">
                  Review enquiries
                  <ArrowRight size={13} />
                </Button>
              </Link>
              <Link href="/inbox">
                <Button variant="secondary" size="sm">
                  Open inbox
                </Button>
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-line border-t border-line lg:border-t-0">
            <div className="flex flex-col justify-between px-5 py-6">
              <p className="text-[8px] font-bold tracking-[0.18em] text-brand-faint uppercase">New leads</p>
              <p className="mt-6 text-[44px] leading-none font-semibold tracking-[-0.055em] tabular-nums text-ink">
                {formatNumber(stats.newEnquiries)}
              </p>
              <p className="mt-2 text-[9px] font-bold tracking-[0.12em] text-brand-faint uppercase">Awaiting reply</p>
            </div>
            <div className="flex flex-col justify-between px-5 py-6">
              <p className="text-[8px] font-bold tracking-[0.18em] text-brand-faint uppercase">Unread</p>
              <p className="mt-6 text-[44px] leading-none font-semibold tracking-[-0.055em] tabular-nums text-ink">
                {formatNumber(stats.unreadMessages)}
              </p>
              <p className="mt-2 text-[9px] font-bold tracking-[0.12em] text-brand-faint uppercase">Inbox queue</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={MessageSquareText}
          label="Today's enquiries"
          value={formatNumber(stats.todayEnquiries)}
          detail={`${stats.newEnquiries} awaiting first response`}
          delta={<Delta current={stats.weekEnquiries} previous={stats.prevWeekEnquiries} />}
          href="/enquiries"
        />
        <KpiCard
          icon={Inbox}
          label="Unread messages"
          value={formatNumber(stats.unreadMessages)}
          detail={`${stats.openThreads} open conversations`}
          delta={
            <span className="inline-flex items-center gap-1 text-[11px] text-[#6b6b6b]">
              <span className="h-1.5 w-1.5  bg-ink live-dot" /> Realtime inbox
            </span>
          }
          href="/inbox"
        />
        <KpiCard
          icon={Building2}
          label="Live venues"
          value={formatNumber(stats.liveVenues)}
          detail={`${stats.draftVenues} drafts in the catalogue`}
          delta={
            <span className="inline-flex items-center gap-1 text-[11px] text-[#6b6b6b]">
              <Users size={10} /> {stats.publishedPosts} journal stories live
            </span>
          }
          href="/venues"
        />
        <KpiCard
          icon={TrendingUp}
          label="Lead conversion"
          value={`${stats.conversionRate}%`}
          detail={`${stats.wonEnquiries} enquiries won`}
          delta={
            <span className="inline-flex items-center gap-1 text-[11px] text-[#6b6b6b]">
              <Clock3 size={10} />
              {stats.avgResponseHours !== null ? `${stats.avgResponseHours}h avg. first reply` : "No response data yet"}
            </span>
          }
          href="/enquiries?status=won"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[13px] font-semibold text-ink">Enquiry volume</h2>
              <p className="mt-0.5 text-[11px] text-[#6b6b6b]">Last 14 days</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-[#6b6b6b]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2  bg-ink" /> Enquiries
              </span>
              <span className="font-medium text-muted">{stats.weekEnquiries} this week</span>
            </div>
          </div>
          <TrendChart data={data.trend} />
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[13px] font-semibold text-ink">Lead status</h2>
              <p className="mt-0.5 text-[11px] text-[#6b6b6b]">Current pipeline</p>
            </div>
            <Link href="/enquiries" className="text-[11px] text-[#6b6b6b] hover:text-ink hover:underline">
              View all
            </Link>
          </div>
          <StatusDonut
            data={data.statuses.map((row) => ({ name: ENQUIRY_STATUS[row.status]?.label || row.status, value: row.count }))}
            centerLabel="enquiries"
            centerValue={stats.totalEnquiries}
            colors={data.statuses.map((row) => STATUS_COLORS[row.status] || "#e5e5e5")}
          />
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[#f0f0f0] pt-3">
            {data.statuses.slice(0, 4).map((row) => (
              <div key={row.status} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] text-[#6b6b6b]">
                  <span className="h-1.5 w-1.5 " style={{ background: STATUS_COLORS[row.status] }} />
                  {ENQUIRY_STATUS[row.status]?.label || row.status}
                </span>
                <span className="text-[11px] font-medium text-ink">{row.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-[13px] font-semibold text-ink">Recent enquiries</h2>
            <Link href="/enquiries" className="flex items-center gap-1 text-[11px] text-[#6b6b6b] hover:text-ink hover:underline">
              View all <ArrowRight size={11} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Enquiry</th>
                  <th>Event</th>
                  <th>Status</th>
                  <th>Received</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.recentEnquiries.map((enquiry) => (
                  <tr key={enquiry.id} className="group">
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={enquiry.name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-medium text-ink">{enquiry.name}</p>
                          <p className="truncate text-[10.5px] text-muted">
                            {enquiry.city || "City not shared"} · {enquiry.reference}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p className="text-[11.5px] text-[#525252]">{enquiry.eventType || "Celebration"}</p>
                      <p className="text-[10.5px] text-muted">
                        {enquiry.guestCount || "—"} guests · {enquiry.eventDate || "date flexible"}
                      </p>
                    </td>
                    <td>
                      <StatusPill value={enquiry.status} map={ENQUIRY_STATUS} />
                    </td>
                    <td>
                      <span className="whitespace-nowrap text-[10.5px] text-muted">{timeAgo(enquiry.createdAt)}</span>
                    </td>
                    <td>
                      <Link
                        href={`/enquiries?focus=${enquiry.id}`}
                        className="grid h-7 w-7 place-items-center text-[#a3a3a3] transition-colors group-hover:bg-[#f5f5f5] group-hover:text-[#525252]"
                        aria-label={`Open ${enquiry.reference}`}
                      >
                        <ArrowRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.recentEnquiries.length === 0 && (
            <div className="px-5 py-12 text-center">
              <p className="text-[12px] text-muted">No enquiries yet. They will appear here in realtime.</p>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div>
              <h2 className="text-[13px] font-semibold text-ink">Lead sources</h2>
              <p className="mt-0.5 text-[11px] text-[#6b6b6b]">Where enquiries come from</p>
            </div>
            <div className="mt-4">
              <SourceBars data={sourceData} />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="text-[13px] font-semibold text-ink">Recent activity</h2>
              <Link href="/activity" className="text-[11px] text-[#6b6b6b] hover:text-ink hover:underline">
                View all
              </Link>
            </div>
            <div className="divide-y divide-[#f0f0f0]">
              {data.recentActivity.slice(0, 5).map((item) => {
                const Icon = activityIcon(item.action);
                return (
                  <div key={item.id} className="flex items-start gap-3 px-5 py-3">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center bg-[#f5f5f5] text-[#5f5f5f] ring-1 ring-line/70">
                      <Icon size={12} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11.5px] text-ink">{item.detail || item.action}</p>
                      <p className="mt-0.5 text-[10px] text-muted">
                        {item.actor} · {timeAgo(item.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
              {data.recentActivity.length === 0 && (
                <p className="px-5 py-10 text-center text-[12px] text-muted">No activity yet.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
