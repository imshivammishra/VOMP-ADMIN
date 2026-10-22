"use client";

import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn, initials, avatarTone } from "@/lib/utils";

// ── Buttons ──────────────────────────────────────────────────────────────
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "strong";
type ButtonSize = "sm" | "md" | "lg";

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  loading,
  icon: Icon,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
}) {
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-ink text-white hover:bg-[#262626] disabled:bg-ink/50",
    secondary: "bg-white text-ink border border-line-strong hover:border-ink hover:bg-[#f7f7f7]",
    ghost: "bg-transparent text-ink hover:bg-ink/[0.06]",
    danger: "bg-ink text-white hover:bg-[#262626]",
    strong: "bg-[#171717] text-white hover:bg-ink",
  };
  const sizes: Record<ButtonSize, string> = {
    sm: "h-8 px-3 text-[11.5px] gap-1.5",
    md: "h-10 px-4 text-[12.5px] gap-2",
    lg: "h-11 px-5 text-[13px] gap-2",
  };
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold tracking-[0.005em] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : Icon ? <Icon size={15} strokeWidth={2} /> : null}
      {children}
    </button>
  );
}

export function IconButton({
  icon: Icon,
  label,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center text-muted transition-colors hover:bg-[#f5f5f5] hover:text-ink disabled:opacity-40",
        className
      )}
    >
      <Icon size={16} />
    </button>
  );
}

// ── Surfaces ─────────────────────────────────────────────────────────────
export function Card({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
  return (
    <div className={cn("surface", className)} {...props}>
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="fade-up mb-7 border-t-2 border-ink pt-4">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-2 flex items-center gap-2 text-[8.5px] font-bold tracking-[0.22em] text-brand-faint uppercase">
              <span className="h-px w-6 bg-ink" />
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-[38px] leading-[0.9] font-semibold tracking-[-0.03em] text-ink md:text-[46px]">
            {title}
          </h1>
          {description && (
            <p className="mt-2.5 max-w-2xl text-[12px] leading-relaxed text-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

// ── Badges ───────────────────────────────────────────────────────────────
export function Badge({
  children,
  className,
  dot,
}: {
  children: React.ReactNode;
  className?: string;
  dot?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 text-[8.5px] font-bold tracking-[0.12em] whitespace-nowrap uppercase ring-1 ring-inset",
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 ", dot)} />}
      {children}
    </span>
  );
}

export function StatusPill({
  value,
  map,
}: {
  value: string;
  map: Record<string, { label: string; className: string; dot?: string }>;
}) {
  const item = map[value] || { label: value, className: "bg-[#f7f7f7] text-muted ring-line" };
  return (
    <Badge className={item.className} dot={item.dot}>
      {item.label}
    </Badge>
  );
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    xs: "h-6 w-6 text-[9px]",
    sm: "h-8 w-8 text-[10px]",
    md: "h-10 w-10 text-[12px]",
    lg: "h-12 w-12 text-[14px]",
  };
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center  font-bold tracking-wide",
        sizes[size],
        avatarTone(name || "?"),
        className
      )}
      aria-hidden="true"
    >
      {initials(name || "?")}
    </span>
  );
}

// ── Form controls ────────────────────────────────────────────────────────
const controlBase =
  "w-full border border-line bg-white px-3.5 py-2.5 text-[13px] text-ink transition-colors duration-150 placeholder:text-[#a3a3a3] hover:border-line-strong focus:border-ink focus:ring-1 focus:ring-ink focus:outline-none disabled:bg-[#f7f7f7] disabled:text-muted";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlBase, className)} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(controlBase, "resize-y leading-relaxed", className)} />;
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select {...props} className={cn(controlBase, "cursor-pointer appearance-none bg-[right_12px_center] pr-9", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23766c5c' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
      }}
    >
      {children}
    </select>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 flex items-center gap-1 text-[9px] font-bold tracking-[0.14em] text-muted uppercase"
      >
        {label}
        {required && <span className="text-ink">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-[11px] font-semibold text-ink">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[10.5px] leading-relaxed text-[#8a8a8a]">{hint}</p>
      ) : null}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-ink">{label}</p>
        {description && <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 border transition-colors duration-150 disabled:opacity-50",
          checked ? "border-ink bg-ink" : "border-[#c9c9c9] bg-[#ececec]"
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] left-[3px] h-4 w-4 bg-white transition-transform duration-150",
            checked && "translate-x-6"
          )}
        />
      </button>
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search size={15} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[#8a8a8a]" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(controlBase, "h-10 py-0 pr-9 pl-9")}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-2.5 grid h-6 w-6 -translate-y-1/2 place-items-center text-muted hover:bg-[#f0f0f0]"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────
export function Tabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("no-scrollbar flex gap-1 overflow-x-auto", className)}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 px-3 py-2 text-[11px] font-bold tracking-[0.04em] uppercase transition-colors",
              active
                ? "bg-ink text-white"
                : "bg-transparent text-muted hover:bg-[#f5f5f5] hover:text-ink"
            )}
          >
            {tab.label}
            {typeof tab.count === "number" && (
              <span
                className={cn(
                  "px-1.5 py-0.5 text-[8.5px] font-bold",
                  active ? "bg-white/15 text-white" : "bg-[#f0f0f0] text-muted"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Overlays ─────────────────────────────────────────────────────────────
function useOverlay(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", listener);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", listener);
    };
  }, [open, onClose]);
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useOverlay(open, onClose);
  if (!open || typeof document === "undefined") return null;
  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" };
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close dialog" onClick={onClose} className="absolute inset-0 cursor-default bg-ink/40" />
      <div className={cn("modal-in relative flex max-h-[92vh] w-full flex-col overflow-hidden border border-ink bg-white", widths[size])}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-[26px] leading-none font-semibold tracking-[-0.02em] text-ink">{title}</h2>
            {description && <p className="mt-1.5 text-[12px] text-muted">{description}</p>}
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-[#f7f7f7] px-5 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg";
}) {
  useOverlay(open, onClose);
  if (!open || typeof document === "undefined") return null;
  const widths = { md: "sm:max-w-xl", lg: "sm:max-w-2xl" };
  return createPortal(
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close panel" onClick={onClose} className="absolute inset-0 cursor-default bg-ink/35" />
      <div className={cn("slide-in-right absolute inset-y-0 right-0 flex w-full flex-col border-l border-ink bg-white", widths[size])}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate font-display text-[27px] leading-none font-semibold tracking-[-0.02em] text-ink">{title}</h2>
            {subtitle && <p className="mt-1.5 text-[12px] text-muted">{subtitle}</p>}
          </div>
          <IconButton icon={X} label="Close panel" onClick={onClose} />
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-line bg-[#f7f7f7] px-5 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-muted">
        This action is immediate. Make sure you no longer need this record — the workspace audit log will keep a note of
        the removal.
      </p>
    </Modal>
  );
}

// ── States ───────────────────────────────────────────────────────────────
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center bg-[#f7f7f7] text-muted ring-1 ring-line">
        <Icon size={22} strokeWidth={1.6} />
      </span>
      <p className="font-display mt-4 text-[28px] leading-none font-semibold tracking-[-0.02em] text-ink">{title}</p>
      <p className="mt-2 max-w-sm text-[12.5px] leading-relaxed text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-black/5">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex items-center gap-4 px-4 py-4">
          <Skeleton className="h-9 w-9" />
          {Array.from({ length: cols }).map((__, col) => (
            <Skeleton key={col} className={cn("h-3.5", col === 0 ? "w-32" : "w-20")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Pagination({
  page,
  pages,
  total,
  limit,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
}) {
  if (total === 0) return null;
  const start = (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="text-[11.5px] text-muted">
        Showing <span className="font-semibold text-ink">{start}–{end}</span> of{" "}
        <span className="font-semibold text-ink">{total}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft size={13} /> Prev
        </Button>
        <span className="px-2 text-[11.5px] font-semibold text-muted">
          {page} / {pages}
        </span>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next <ChevronRight size={13} />
        </Button>
      </div>
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted">
      <Loader2 size={18} className="animate-spin text-[#a3a3a3]" />
      <span className="text-[12px] font-medium">{label}…</span>
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="border border-line bg-white px-1.5 py-0.5 text-[9px] font-bold text-muted">
      {children}
    </kbd>
  );
}

// Re-export for convenience in forms.
export function useFieldId(prefix: string) {
  const id = useId();
  return `${prefix}-${id}`;
}
