"use client";

import { cn } from "@/lib/utils";

type ReadingDifficulty = "easy" | "medium" | "advanced";

interface ReadingDifficultyBadgeProps {
  difficulty?: string | null;
  className?: string;
}

const LABELS: Record<ReadingDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  advanced: "Advanced",
};

const STYLES: Record<ReadingDifficulty, string> = {
  easy: "bg-[#ECFDF3] text-[#166534] border-[#BBF7D0]",
  medium: "bg-[#FFFBEB] text-[#9A3412] border-[#FDE68A]",
  advanced: "bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]",
};

function normalizeDifficulty(value?: string | null): ReadingDifficulty {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "easy" || normalized === "advanced") return normalized;
  return "medium";
}

export function ReadingDifficultyBadge({
  difficulty,
  className,
}: ReadingDifficultyBadgeProps) {
  const normalized = normalizeDifficulty(difficulty);

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-semibold",
        STYLES[normalized],
        className
      )}
      title={`Reading difficulty: ${LABELS[normalized]}`}
    >
      {LABELS[normalized]}
    </span>
  );
}
