"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Command,
  ExternalLink,
  Home,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { routeMeta } from "@/config/navigation";
import { cn, timeAgo } from "@/lib/utils";
import type { ActivityItem, User } from "@/lib/types";
import { Avatar, Kbd } from "@/components/ui";

export function Topbar({
  onMenu,
  onSearch,
  onToggleSidebar,
  collapsed,
  connected,
  user,
  onLogout,
  activity,
}: {
  onMenu: () => void;
  onSearch: () => void;
  onToggleSidebar: () => void;
  collapsed: boolean;
  connected: boolean;
  user: User | null;
  onLogout: () => void;
  activity: ActivityItem[];
}) {
  const pathname = usePathname();
  const meta = routeMeta(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) setBellOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setBellOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white">
      <div className="flex h-[68px] items-center gap-2 px-4 md:px-6 lg:px-8">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open navigation"
          className="grid h-9 w-9 shrink-0 place-items-center border border-line bg-white text-muted transition-colors hover:border-ink hover:text-ink lg:hidden"
        >
          <Menu size={17} />
        </button>

        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
          className="hidden h-9 w-9 shrink-0 place-items-center text-brand-faint transition-colors hover:bg-[#f5f5f5] hover:text-ink lg:grid"
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>

        <div className="min-w-0 flex-1">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[8.5px] font-bold tracking-[0.14em] text-brand-faint uppercase">
            <Link href="/" className="flex items-center gap-1 transition-colors hover:text-ink">
              <Home size={10} />
              Home
            </Link>
            <ChevronRight size={10} />
            <span className="hidden sm:inline">{meta.group}</span>
            <ChevronRight size={10} className="hidden sm:block" />
            <span className="truncate text-ink">{meta.title}</span>
          </nav>
        </div>

        <button
          type="button"
          onClick={onSearch}
          className="hidden h-10 w-[280px] items-center gap-2 border border-line bg-white px-3 text-left text-[11px] text-muted transition-colors hover:border-ink xl:flex"
        >
          <Search size={14} className="text-brand-faint" />
          <span className="flex-1">Search workspace</span>
          <span className="flex items-center gap-0.5">
            <Kbd><Command size={9} className="inline" /></Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        <button
          type="button"
          onClick={onSearch}
          aria-label="Search workspace"
          className="grid h-9 w-9 place-items-center text-muted transition-colors hover:bg-[#f5f5f5] hover:text-ink xl:hidden"
        >
          <Search size={17} />
        </button>

        <span
          className={cn(
            "hidden items-center gap-1.5 border px-2.5 py-1.5 text-[8px] font-bold tracking-[0.12em] uppercase sm:flex",
            connected ? "border-ink bg-ink text-white" : "border-line bg-white text-brand-faint"
          )}
          title={connected ? "Realtime stream connected" : "Reconnecting to the realtime stream"}
        >
          <span className={cn("h-1.5 w-1.5 ", connected ? "bg-ink live-dot" : "bg-brand-line-strong")} />
          {connected ? "Live" : "Syncing"}
        </span>

        <Link
          href={process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100"}
          target="_blank"
          rel="noreferrer"
          title="Open the public website"
          className="hidden h-9 w-9 place-items-center text-brand-faint transition-colors hover:bg-[#f5f5f5] hover:text-ink xl:grid"
        >
          <ExternalLink size={16} />
        </Link>

        <div className="relative" ref={bellRef}>
          <button
            type="button"
            onClick={() => {
              setBellOpen((value) => !value);
              setMenuOpen(false);
            }}
            aria-label="Recent activity"
            className="relative grid h-9 w-9 place-items-center text-muted transition-colors hover:bg-[#f5f5f5] hover:text-ink"
          >
            <Bell size={17} />
            {activity.length > 0 && (
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5  bg-ink ring-2 ring-canvas" />
            )}
          </button>
          {bellOpen && (
            <div className="modal-in absolute top-11 right-0 w-[340px] overflow-hidden border border-ink bg-white">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <p className="text-[11.5px] font-semibold text-ink">Workspace activity</p>
                <Link
                  href="/activity"
                  onClick={() => setBellOpen(false)}
                  className="text-[10px] font-semibold text-muted hover:text-ink hover:underline"
                >
                  View all
                </Link>
              </div>
              <div className="max-h-[330px] overflow-y-auto">
                {activity.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex gap-2.5 border-b border-brand-hairline px-4 py-3 last:border-0">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0  bg-ink" />
                    <div className="min-w-0">
                      <p className="truncate text-[11.5px] font-medium text-ink">{item.detail || item.action}</p>
                      <p className="mt-0.5 text-[10px] text-muted">
                        {item.actor} · {timeAgo(item.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
                {activity.length === 0 && (
                  <p className="px-4 py-8 text-center text-[12px] text-muted">No activity yet.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => {
              setMenuOpen((value) => !value);
              setBellOpen(false);
            }}
            className="flex h-10 items-center gap-2 border border-line bg-white py-1 pr-2 pl-1 transition-colors hover:border-ink"
            aria-label="Account menu"
          >
            <Avatar name={user?.name || "VO"} size="sm" />
            <span className="hidden min-w-0 text-left lg:block">
              <span className="block max-w-[116px] truncate text-[11px] leading-tight font-semibold text-ink">
                {user?.name || "Account"}
              </span>
              <span className="block text-[8.5px] tracking-[0.06em] text-brand-faint uppercase">
                {user?.role || "member"}
              </span>
            </span>
            <ChevronDown size={13} className="text-brand-faint" />
          </button>
          {menuOpen && (
            <div className="modal-in absolute top-12 right-0 w-[264px] overflow-hidden border border-ink bg-white">
              <div className="border-b border-line px-4 py-3.5">
                <p className="truncate text-[12.5px] font-semibold text-ink">{user?.name}</p>
                <p className="truncate text-[11px] text-muted">{user?.email}</p>
                <span className="mt-2 inline-flex items-center gap-1 bg-[#f5f5f5] px-2 py-0.5 text-[8px] font-bold tracking-[0.12em] text-muted uppercase">
                  <ShieldCheck size={10} /> {user?.role || "member"}
                </span>
              </div>
              <div className="p-1.5">
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-[12px] font-medium text-muted transition-colors hover:bg-[#f5f5f5] hover:text-ink"
                >
                  <Settings size={14} /> Workspace settings
                </Link>
                <Link
                  href="/team"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-[12px] font-medium text-muted transition-colors hover:bg-[#f5f5f5] hover:text-ink"
                >
                  <CircleUserRound size={14} /> Team & access
                </Link>
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] font-medium text-muted transition-colors hover:bg-[#f5f5f5] hover:text-ink"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
