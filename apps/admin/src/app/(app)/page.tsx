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
  new: "#17130e",
  contacted: "#5b5245",
  qualified: "#8c7f6c",
  won: "#3d372f",
  lost: "#b1a48f",
  closed: "#e1d7c7",
};

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) {
    return <span className="text-[11px] text-[#948771]">No change</span>;
  }
  const change = previous === 0 ? 100 : Math.round(((current - previous) / previous) * 100);
  const up = change >= 0;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px]", up ? "text-muted" : "text-[#948771]")}>
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
      className="group rounded-[12px] border border-line bg-paper p-5 transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_20px_44px_-36px_rgba(23,19,14,0.55)]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-[9px] bg-cream-soft text-brand-muted ring-1 ring-line/80">
          <Icon size={17} strokeWidth={1.8} />
        </span>
        <span className="grid h-7 w-7 place-items-center rounded-full text-brand-faint transition group-hover:bg-cream-soft group-hover:text-ink">
          <ArrowUpRight size={14} />
        </span>
      </div>
      <p className="mt-5 text-[9.5px] font-semibold tracking-[0.13em] text-brand-faint uppercase">
        {label}
      </p>
      <p className="mt-1.5 text-[32px] leading-none font-semibold tracking-[-0.045em] text-ink tabular-nums">
        {value}
      </p>
      <p className="mt-2.5 truncate text-[11px] leading-relaxed text-muted">{detail}</p>
      {delta && <div className="mt-2.5 border-t border-brand-hairline pt-2.5">{delta}</div>}
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
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-[168px] rounded-xl" />
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Skeleton className="h-[330px] rounded-xl" />
          <Skeleton className="h-[330px] rounded-xl" />
        </div>
        {error && <p className="mt-4 text-[12px] text-[#5f574a]">The dashboard could not load. Check the API connection.</p>}
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

      <section className="fade-up relative mb-4 overflow-hidden rounded-[12px] bg-ink px-5 py-5 text-white md:px-6">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full border border-white/10"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -bottom-28 h-64 w-64 rounded-full border border-white/[0.07]"
        />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-[9px] font-semibold tracking-[0.16em] text-white/55 uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-white live-dot" />
              Today&apos;s focus
            </p>
            <h2 className="font-display mt-2 text-[30px] leading-[1.02] font-semibold tracking-[-0.02em] md:text-[36px]">
              {stats.newEnquiries > 0 || stats.unreadMessages > 0
                ? "Keep every conversation moving."
                : "Everything is clear for now."}
            </h2>
            <p className="mt-2 max-w-xl text-[11.5px] leading-relaxed text-white/60">
              {stats.newEnquiries > 0 || stats.unreadMessages > 0
                ? `${formatNumber(stats.newEnquiries)} new enquir${stats.newEnquiries === 1 ? "y" : "ies"} and ${formatNumber(stats.unreadMessages)} unread message${stats.unreadMessages === 1 ? "" : "s"} are waiting for your team.`
                : "No enquiries need a first response and the inbox is clear. A good moment to refine the website or add a venue."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/enquiries?status=new">
                <Button variant="secondary" size="sm" className="border-white/20 bg-white text-ink hover:border-white hover:bg-cream-soft">
                  Review enquiries
                  <ArrowRight size={13} />
                </Button>
              </Link>
              <Link href="/inbox">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                  Open inbox
                </Button>
              </Link>
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-2 divide-x divide-white/15 rounded-[9px] border border-white/15 bg-white/[0.055] px-2 py-3 md:min-w-[260px]">
            <div className="px-4">
              <p className="text-[8.5px] font-semibold tracking-[0.14em] text-white/45 uppercase">New leads</p>
              <p className="mt-1.5 text-[26px] leading-none font-semibold tracking-[-0.04em] tabular-nums">
                {formatNumber(stats.newEnquiries)}
              </p>
            </div>
            <div className="px-4">
              <p className="text-[8.5px] font-semibold tracking-[0.14em] text-white/45 uppercase">Unread</p>
              <p className="mt-1.5 text-[26px] leading-none font-semibold tracking-[-0.04em] tabular-nums">
                {formatNumber(stats.unreadMessages)}
              </p>
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
            <span className="inline-flex items-center gap-1 text-[11px] text-[#817665]">
              <span className="h-1.5 w-1.5 rounded-full bg-ink live-dot" /> Realtime inbox
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
            <span className="inline-flex items-center gap-1 text-[11px] text-[#817665]">
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
            <span className="inline-flex items-center gap-1 text-[11px] text-[#817665]">
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
              <p className="mt-0.5 text-[11px] text-[#817665]">Last 14 days</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-[#817665]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-ink" /> Enquiries
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
              <p className="mt-0.5 text-[11px] text-[#817665]">Current pipeline</p>
            </div>
            <Link href="/enquiries" className="text-[11px] text-[#817665] hover:text-ink hover:underline">
              View all
            </Link>
          </div>
          <StatusDonut
            data={data.statuses.map((row) => ({ name: ENQUIRY_STATUS[row.status]?.label || row.status, value: row.count }))}
            centerLabel="enquiries"
            centerValue={stats.totalEnquiries}
            colors={data.statuses.map((row) => STATUS_COLORS[row.status] || "#e5e5e5")}
          />
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[#f0e9dd] pt-3">
            {data.statuses.slice(0, 4).map((row) => (
              <div key={row.status} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] text-[#817665]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLORS[row.status] }} />
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
            <Link href="/enquiries" className="flex items-center gap-1 text-[11px] text-[#817665] hover:text-ink hover:underline">
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
                      <p className="text-[11.5px] text-[#5f574a]">{enquiry.eventType || "Celebration"}</p>
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
                        className="grid h-7 w-7 place-items-center rounded-full text-[#a79b88] transition group-hover:bg-cream-soft group-hover:text-[#5f574a]"
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
              <p className="mt-0.5 text-[11px] text-[#817665]">Where enquiries come from</p>
            </div>
            <div className="mt-4">
              <SourceBars data={sourceData} />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="text-[13px] font-semibold text-ink">Recent activity</h2>
              <Link href="/activity" className="text-[11px] text-[#817665] hover:text-ink hover:underline">
                View all
              </Link>
            </div>
            <div className="divide-y divide-[#f0e9dd]">
              {data.recentActivity.slice(0, 5).map((item) => {
                const Icon = activityIcon(item.action);
                return (
                  <div key={item.id} className="flex items-start gap-3 px-5 py-3">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cream-soft text-[#6f6556] ring-1 ring-line/70">
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
