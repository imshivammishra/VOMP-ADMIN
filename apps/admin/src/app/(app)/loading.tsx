import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1560px] px-4 py-6 md:px-6 md:py-7 lg:px-7">
      <div className="border-t border-ink/20 pt-4">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="mt-3 h-9 w-64" />
        <Skeleton className="mt-3 h-3 w-96 max-w-full" />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-[172px] " />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Skeleton className="h-[330px] " />
        <Skeleton className="h-[330px] " />
      </div>
    </div>
  );
}
