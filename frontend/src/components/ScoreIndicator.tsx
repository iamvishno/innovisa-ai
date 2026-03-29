import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type ScoreIndicatorSize = "sm" | "md" | "lg";

export interface ScoreIndicatorProps {
  score: number;
  size?: ScoreIndicatorSize;
  label?: string;
  animate?: boolean;
}

const SIZE_PX: Record<ScoreIndicatorSize, number> = {
  sm: 60,
  md: 80,
  lg: 120,
};

const STROKE: Record<ScoreIndicatorSize, number> = {
  sm: 4,
  md: 5,
  lg: 6,
};

const FONT: Record<ScoreIndicatorSize, string> = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
};

function strokeClass(score: number): string {
  if (score >= 70) return "stroke-green-500";
  if (score >= 40) return "stroke-yellow-500";
  return "stroke-red-500";
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function ScoreIndicator({
  score,
  size = "md",
  label,
  animate: shouldAnimate = true,
}: ScoreIndicatorProps) {
  const px = SIZE_PX[size];
  const strokeWidth = STROKE[size];
  const clamped = clampScore(score);

  const r = useMemo(
    () => Math.max(1, (px - strokeWidth) / 2 - strokeWidth * 0.25),
    [px, strokeWidth]
  );
  const c = 2 * Math.PI * r;
  const targetOffset = c * (1 - clamped / 100);

  const countMv = useMotionValue(shouldAnimate ? 0 : clamped);
  const displayMv = useTransform(countMv, (v) => Math.round(v));
  const strokeDashoffset = useMotionValue(shouldAnimate ? c : targetOffset);
  const [displayScore, setDisplayScore] = useState(
    shouldAnimate ? 0 : Math.round(clamped)
  );

  useMotionValueEvent(displayMv, "change", (v) => {
    setDisplayScore(v);
  });

  useEffect(() => {
    if (!shouldAnimate) {
      countMv.set(clamped);
      strokeDashoffset.set(targetOffset);
      setDisplayScore(Math.round(clamped));
      return;
    }
    countMv.set(0);
    setDisplayScore(0);
    strokeDashoffset.set(c);
    const numCtrl = animate(countMv, clamped, {
      duration: 1,
      ease: "easeOut",
    });
    const ringCtrl = animate(strokeDashoffset, targetOffset, {
      duration: 1,
      ease: "easeOut",
    });
    return () => {
      numCtrl.stop();
      ringCtrl.stop();
    };
  }, [clamped, shouldAnimate, countMv, c, targetOffset, strokeDashoffset]);

  const cx = px / 2;
  const cy = px / 2;

  return (
    <div
      className={cn("inline-flex flex-col items-center gap-1")}
      role="img"
      aria-label={`Score ${Math.round(clamped)} out of 100`}
    >
      <div className="relative" style={{ width: px, height: px }}>
        <svg
          width={px}
          height={px}
          viewBox={`0 0 ${px} ${px}`}
          className="block -rotate-90"
          aria-hidden
        >
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            className="stroke-gray-200 dark:stroke-gray-700"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            className={cn(strokeClass(clamped))}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={c}
            style={{ strokeDashoffset }}
          />
        </svg>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center font-bold tabular-nums text-gray-900 dark:text-gray-100",
            FONT[size]
          )}
        >
          {displayScore}
        </span>
      </div>
      {label != null && label !== "" ? (
        <span className="max-w-[12rem] text-center text-xs text-gray-600 dark:text-gray-400">
          {label}
        </span>
      ) : null}
    </div>
  );
}

export default ScoreIndicator;
