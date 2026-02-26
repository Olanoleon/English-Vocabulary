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
  easy: "bg-green-50 text-green-700 border-green-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  advanced: "bg-purple-50 text-purple-700 border-purple-200",
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
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
        STYLES[normalized],
        className
      )}
      title={`Reading difficulty: ${LABELS[normalized]}`}
    >
      {LABELS[normalized]}
    </span>
  );
}
