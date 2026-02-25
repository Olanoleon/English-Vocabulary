"use client";

import { cn } from "@/lib/utils";

interface LogoBadgeProps {
  logo?: string | null;
  fallback?: string;
  size?: "sm" | "md" | "lg";
  tone?: "primary" | "orange" | "muted";
  className?: string;
}

const SIZE_STYLES = {
  sm: {
    container: "h-8 w-8 rounded-lg",
    text: "text-lg",
  },
  md: {
    container: "h-10 w-10 rounded-xl",
    text: "text-xl",
  },
  lg: {
    container: "h-14 w-14 rounded-xl",
    text: "text-3xl",
  },
} as const;

const TONE_STYLES = {
  primary: "bg-primary-50 border-primary-100",
  orange: "bg-orange-50 border-orange-100",
  muted: "bg-gray-50 border-gray-200",
} as const;

export function LogoBadge({
  logo,
  fallback = "📘",
  size = "md",
  tone = "primary",
  className,
}: LogoBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center flex-shrink-0 border ring-1 ring-black/5",
        SIZE_STYLES[size].container,
        TONE_STYLES[tone],
        className
      )}
    >
      <span className={cn("leading-none", SIZE_STYLES[size].text)}>{logo || fallback}</span>
    </div>
  );
}
