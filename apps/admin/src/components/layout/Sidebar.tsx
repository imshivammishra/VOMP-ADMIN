"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, ShieldCheck, X } from "lucide-react";
import { NAVIGATION, type NavigationBadge } from "@/config/navigation";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui";
import { Wordmark } from "./Wordmark";

export function Sidebar({
  open,
  collapsed,
  onClose,
  counts,
  user,
  onLogout,
  connected,
}: {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  counts: Record<NavigationBadge, number>;
  user: User | null;
  onLogout: () => void;
  connected: boolean;
}) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-ink/35 backdrop-blur-[2px] lg:hidden"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-brand-line bg-brand-panel text-ink transition-[width,transform] duration-300 lg:translate-x-0",
          collapsed ? "lg:w-[82px]" : "lg:w-[264px]",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div
          className={cn(
            "flex h-[72px] shrink-0 items-center border-b border-brand-line/80",
            collapsed ? "lg:justify-center lg:px-0" : "justify-between px-5"
          )}
        >
          <div className={cn(collapsed && "lg:hidden")}>
            <Wordmark
              tone="dark"
              size="md"
              subtitle="Operations console"
              onNavigate={onClose}
              href="/"
            />
          </div>
          {collapsed && (
            <Link
              href="/"
              onClick={onClose}
              aria-label="Venue On My Plate — overview"
              className="font-display hidden h-9 w-9 place-items-center rounded-[6px] bg-ink text-[19px] leading-none font-semibold text-white lg:grid"
            >
              V
            </Link>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="grid h-8 w-8 place-items-center rounded-md text-muted transition hover:bg-paper hover:text-ink lg:hidden"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-5">
          {NAVIGATION.map((group, groupIndex) => (
            <div key={group.label} className={cn(groupIndex > 0 && "mt-6")}>
              <p
                className={cn(
                  "mb-2 px-3 text-[9px] font-semibold tracking-[0.16em] text-brand-faint uppercase",
                  collapsed && "lg:hidden"
                )}
              >
                {group.label}
              </p>
              {collapsed && groupIndex > 0 && (
                <div className="mx-auto mb-2 hidden h-px w-6 bg-brand-line lg:block" aria-hidden="true" />
              )}
              <div className="space-y-[3px]">
                {group.items.map((item) => {
                  const active =
                    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  const count = item.badge ? counts[item.badge] : 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex h-[42px] items-center gap-3 rounded-[7px] text-[12.5px] font-medium transition-colors",
                        collapsed ? "lg:justify-center lg:px-0" : "px-3",
                        active
                          ? "bg-ink text-white shadow-[0_10px_20px_-18px_rgba(23,19,14,0.9)]"
                          : "text-brand-muted hover:bg-white/70 hover:text-ink"
                      )}
                    >
                      <item.icon
                        size={17}
                        strokeWidth={active ? 2.05 : 1.7}
                        className={cn(
                          "shrink-0",
                          active ? "text-white" : "text-brand-faint group-hover:text-ink"
                        )}
                      />
                      <span className={cn("min-w-0 flex-1 truncate", collapsed && "lg:hidden")}>
                        {item.label}
                      </span>
                      {count > 0 && (
                        <>
                          <span
                            className={cn(
                              "grid h-[19px] min-w-[19px] place-items-center rounded-[5px] px-1 text-[9px] font-bold tabular-nums",
                              active ? "bg-white/15 text-white" : "bg-paper text-brand-muted",
                              collapsed && "lg:hidden"
                            )}
                          >
                            {count > 99 ? "99+" : count}
                          </span>
                          <span
                            className={cn(
                              "absolute top-2 right-2 hidden h-1.5 w-1.5 rounded-full",
                              active ? "bg-white" : "bg-ink",
                              collapsed && "lg:block"
                            )}
                            aria-hidden="true"
                          />
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className={cn("border-t border-brand-line p-3", collapsed && "lg:px-2")}>
          <div
            className={cn(
              "mb-2.5 flex items-center gap-1.5 px-2 text-[9px] font-semibold tracking-[0.08em] text-brand-faint uppercase",
              collapsed && "lg:hidden"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                connected ? "bg-ink live-dot" : "bg-brand-line-strong"
              )}
            />
            {connected ? "Live updates" : "Reconnecting"}
          </div>
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-[7px] p-1.5",
              collapsed ? "lg:justify-center lg:p-0" : "bg-white/45"
            )}
            title={collapsed ? user?.name || "Account" : undefined}
          >
            <Avatar name={user?.name || "VO"} size="sm" />
            <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
              <p className="truncate text-[11.5px] font-semibold text-ink">
                {user?.name || "Workspace"}
              </p>
              <p className="flex items-center gap-1 truncate text-[9px] tracking-[0.05em] text-brand-faint uppercase">
                <ShieldCheck size={9} /> {user?.role || "member"}
              </p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              aria-label="Sign out"
              title="Sign out"
              className={cn(
                "grid h-8 w-8 place-items-center rounded-md text-brand-faint transition hover:bg-paper hover:text-ink",
                collapsed && "lg:hidden"
              )}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
