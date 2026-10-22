import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-white px-6">
      <div className="w-full max-w-md  border border-line bg-white p-7 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center  bg-[#f7f7f7] text-brand-muted ring-1 ring-line">
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
          className="mt-5 inline-flex h-10 items-center gap-2  bg-ink px-4 text-[12px] font-semibold text-white transition-colors hover:bg-[#262626]"
        >
          <ArrowLeft size={14} />
          Back to overview
        </Link>
      </div>
    </div>
  );
}
