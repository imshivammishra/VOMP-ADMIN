"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { STORAGE_KEYS } from "@/config/app";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/lib/realtime";
import { useKeyboardShortcut } from "@/lib/hooks";
import type { Overview } from "@/lib/types";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Wordmark } from "./Wordmark";
import { CommandPalette } from "./CommandPalette";

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas">
      <Wordmark tone="dark" subtitle={null} size="md" href="/" />
      <div className="mt-8 h-px w-28 overflow-hidden bg-brand-line">
        <span className="block h-full w-1/3 animate-pulse bg-ink" />
      </div>
      <p className="mt-4 text-[8.5px] font-semibold tracking-[0.18em] text-brand-faint uppercase">
        Loading workspace
      </p>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { connected, seq } = useRealtime();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const { data, error, mutate } = useSWR<Overview>("/api/admin/overview", {
    refreshInterval: 60_000,
    revalidateOnMount: true,
  });

  useEffect(() => {
    if (seq > 0) mutate();
  }, [seq, mutate]);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEYS.sidebar) === "true");
  }, []);

  function toggleSidebar() {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem(STORAGE_KEYS.sidebar, String(next));
      return next;
    });
  }

  useKeyboardShortcut("k", () => setSearchOpen(true));

  const counts = {
    enquiries: data?.stats.newEnquiries || 0,
    messages: data?.stats.unreadMessages || 0,
    partners: data?.stats.newPartners || 0,
  };

  if (loading || !user) return <Splash />;

  return (
    <div className="min-h-screen">
      <Sidebar
        open={mobileOpen}
        collapsed={collapsed}
        onClose={() => setMobileOpen(false)}
        counts={counts}
        user={user}
        onLogout={logout}
        connected={connected}
      />

      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] duration-300",
          collapsed ? "lg:pl-[82px]" : "lg:pl-[264px]"
        )}
      >
        <Topbar
          onMenu={() => setMobileOpen(true)}
          onSearch={() => setSearchOpen(true)}
          onToggleSidebar={toggleSidebar}
          collapsed={collapsed}
          connected={connected}
          user={user}
          onLogout={logout}
          activity={data?.recentActivity || []}
        />

        {error && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-cream-soft px-4 py-2.5 text-ink md:px-6 lg:px-7">
            <p className="flex items-center gap-2 text-[12px]">
              <TriangleAlert size={14} className="text-muted" />
              The workspace API is unreachable. Your data is safe — retry in a moment.
            </p>
            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => mutate()}>
              Retry
            </Button>
          </div>
        )}

        <main className="mx-auto w-full max-w-[1560px] flex-1 px-4 py-6 md:px-6 md:py-7 lg:px-7">
          {children}
        </main>

        <footer className="mx-auto flex w-full max-w-[1560px] flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-4 text-[8.5px] font-semibold tracking-[0.14em] text-brand-faint uppercase md:px-6 lg:px-7">
          <span>© {new Date().getFullYear()} Venue On My Plate · Operations</span>
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                connected ? "bg-ink" : "bg-brand-line-strong"
              )}
            />
            {connected ? "Live updates on" : "Reconnecting"}
          </span>
        </footer>
      </div>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
