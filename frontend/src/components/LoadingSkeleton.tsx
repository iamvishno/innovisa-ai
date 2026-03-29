import { cn } from "@/lib/utils";

export type LoadingSkeletonVariant = "card" | "table" | "text" | "chart";

export interface LoadingSkeletonProps {
  variant: LoadingSkeletonVariant;
  count?: number;
}

const pulse =
  "rounded bg-gray-200 dark:bg-gray-700 animate-pulse";

function LoadingSkeleton({ variant, count = 1 }: LoadingSkeletonProps) {
  const n = Math.max(1, Math.floor(count));

  if (variant === "card") {
    return (
      <div
        className={cn(
          "grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
        )}
        role="status"
        aria-label="Loading"
      >
        {Array.from({ length: n }, (_, i) => (
          <div
            key={i}
            className={cn("h-48 rounded-lg", pulse)}
            aria-hidden
          />
        ))}
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className={cn("flex flex-col gap-3")} role="status" aria-label="Loading">
        {Array.from({ length: n }, (_, i) => (
          <div key={i} className={cn("h-12", pulse)} aria-hidden />
        ))}
      </div>
    );
  }

  if (variant === "text") {
    const widths = ["w-3/4", "w-full", "w-5/6"] as const;
    return (
      <div className={cn("flex flex-col gap-3")} role="status" aria-label="Loading">
        {Array.from({ length: n }, (_, i) => (
          <div
            key={i}
            className={cn("h-4", widths[i % widths.length], pulse)}
            aria-hidden
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6")} role="status" aria-label="Loading">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={cn("h-64 rounded-lg", pulse)} aria-hidden />
      ))}
    </div>
  );
}

export default LoadingSkeleton;
