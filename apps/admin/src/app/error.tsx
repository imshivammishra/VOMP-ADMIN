"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-6">
      <div className="w-full max-w-md rounded-[12px] border border-line bg-paper p-7 text-center shadow-[0_30px_80px_-60px_rgba(23,19,14,0.5)]">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-cream-soft text-brand-muted ring-1 ring-line">
          <TriangleAlert size={20} />
        </span>
        <p className="mt-5 text-[9px] font-semibold tracking-[0.16em] text-brand-faint uppercase">
          Workspace error
        </p>
        <h1 className="font-display mt-1 text-[34px] leading-none font-semibold tracking-[-0.025em] text-ink">
          This view could not load.
        </h1>
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
          The console hit an unexpected problem. Your records are safe. Try the view again; if it persists, check the
          API logs.
        </p>
        {error.digest && (
          <p className="mt-3 rounded-md bg-cream-soft px-3 py-2 font-mono text-[10px] text-brand-faint">
            Reference: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-[12px] font-semibold text-white transition hover:bg-[#2b251d]"
        >
          <RefreshCw size={14} />
          Try again
        </button>
      </div>
    </div>
  );
}
