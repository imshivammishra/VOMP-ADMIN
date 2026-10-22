"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (title: string, options?: { description?: string; tone?: ToastTone }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (title: string, options?: { description?: string; tone?: ToastTone }) => {
      const id = seq.current++;
      setItems((current) => [
        ...current.slice(-3),
        { id, title, description: options?.description, tone: options?.tone || "success" },
      ]);
      window.setTimeout(() => dismiss(id), 4600);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2.5">
        {items.map((item) => {
          const Icon = item.tone === "success" ? CheckCircle2 : item.tone === "error" ? TriangleAlert : Info;
          return (
            <div
              key={item.id}
              role="status"
              className="toast-in pointer-events-auto flex items-start gap-3 border border-ink bg-white p-3.5"
            >
              <span
                className={cn(
                  "mt-0.5 grid h-8 w-8 shrink-0 place-items-center",
                  item.tone === "success" && "bg-neutral-900 text-white",
                  item.tone === "error" && "bg-neutral-100 text-neutral-700",
                  item.tone === "info" && "bg-neutral-100 text-neutral-700"
                )}
              >
                <Icon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[#0a0a0a]">{item.title}</p>
                {item.description && (
                  <p className="mt-0.5 text-[12px] leading-relaxed text-[#666666]">{item.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="grid h-7 w-7 shrink-0 place-items-center text-[#737373] transition-colors hover:bg-black/5 hover:text-[#0a0a0a]"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
