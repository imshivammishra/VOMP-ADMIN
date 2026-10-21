import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-6">
      <div className="w-full max-w-md rounded-[12px] border border-line bg-paper p-7 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-cream-soft text-brand-muted ring-1 ring-line">
          <Compass size={20} />
        </span>
        <p className="mt-5 text-[9px] font-semibold tracking-[0.16em] text-brand-faint uppercase">
          Page not found
        </p>
        <h1 className="font-display mt-1 text-[36px] leading-none font-semibold tracking-[-0.025em] text-ink">
          This page has moved.
        </h1>
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
          The address does not match a page in the operations console.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-[12px] font-semibold text-white transition hover:bg-[#2b251d]"
        >
          <ArrowLeft size={14} />
          Back to overview
        </Link>
      </div>
    </div>
  );
}
