import Link from "next/link";
import { cn } from "@/lib/utils";

export function Wordmark({
  tone = "light",
  subtitle = "Operations",
  size = "md",
  href = "/",
  className,
  onNavigate,
}: {
  tone?: "light" | "dark";
  subtitle?: string | null;
  size?: "sm" | "md" | "lg";
  href?: string;
  className?: string;
  onNavigate?: () => void;
}) {
  const light = tone === "light";
  const marks = {
    sm: "h-7 w-7 text-[15px] rounded-[4px]",
    md: "h-9 w-9 text-[19px] rounded-[5px]",
    lg: "h-12 w-12 text-[25px] rounded-md",
  };
  const names = {
    sm: "text-[11.5px]",
    md: "text-[12.5px]",
    lg: "text-[15px]",
  };

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-label="Venue On My Plate — operations console"
      className={cn("group inline-flex items-center gap-2.5", className)}
    >
      <span
        className={cn(
          "font-display grid shrink-0 place-items-center leading-none font-semibold",
          marks[size],
          light ? "bg-white text-ink" : "bg-ink text-[#fffdf8]"
        )}
      >
        V
      </span>
      <span className="min-w-0 leading-none">
        <span
          className={cn(
            "block font-semibold tracking-[-0.025em] whitespace-nowrap",
            names[size],
            light ? "text-white" : "text-ink"
          )}
        >
          Venue On My Plate
        </span>
        {subtitle ? (
          <span
            className={cn(
              "mt-1.5 block text-[8px] font-semibold tracking-[0.13em] uppercase",
              light ? "text-white/40" : "text-[#948771]"
            )}
          >
            {subtitle}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
