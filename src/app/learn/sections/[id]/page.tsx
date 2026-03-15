"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Dumbbell,
  ClipboardCheck,
  CheckCircle2,
  ChevronRight,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ReadingDifficultyBadge } from "@/components/reading-difficulty-badge";
import { APP_IMAGE_FALLBACK } from "@/lib/image-fallback";

interface SectionData {
  id: string;
  areaId: string;
  title: string;
  titleEs: string;
  imageUrl: string | null;
  modules: {
    id: string;
    type: string;
    content?: { readingDifficulty?: string } | null;
    _count: { questions: number };
  }[];
  sectionVocabulary: { vocabulary: { word: string } }[];
  progress: {
    introCompleted: boolean;
    practiceCompleted: boolean;
    testScore: number | null;
    testPassed: boolean;
  };
}

const LEGACY_IMAGE_PATH_MAP: Record<string, string> = {
  "/images/library/humanbody_face.png": "/images/library/humanbody_femaleface.png",
  "/icons/app-fallback.svg": APP_IMAGE_FALLBACK,
  "/file.svg": APP_IMAGE_FALLBACK,
};

export default function SectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [section, setSection] = useState<SectionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchSection() {
    const res = await fetch(`/api/learn/sections/${id}`);
    if (res.ok) {
      setSection(await res.json());
    } else if (res.status === 403) {
      router.push("/learn");
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!section) {
    return (
      <div className="p-4 text-center text-gray-500">
        Section not found or locked.
      </div>
    );
  }

  const progress = section.progress;
  const backHref = `/learn/areas/${section.areaId}`;
  const introModule = section.modules.find((m) => m.type === "introduction");
  const practiceModule = section.modules.find((m) => m.type === "practice");
  const testModule = section.modules.find((m) => m.type === "test");

  const totalPercent =
    (progress.introCompleted ? 33 : 0) +
    (progress.practiceCompleted ? 33 : 0) +
    (progress.testPassed ? 34 : 0);

  const testStatus =
    progress.testPassed ? "pass" : progress.testScore !== null ? "failed" : "pending";

  const modules = [
    {
      module: introModule,
      label: "Introduction",
      description:
        "Reading and listening in context with Spanish definitions. Understand words naturally.",
      icon: BookOpen,
      completed: progress.introCompleted,
      href: `/learn/sections/${id}/intro`,
      btnLabel: progress.introCompleted ? "Review Intro" : "Start Intro",
      accentStrip: "bg-primary-500",
      cardTint: "bg-primary-50/40 border-primary-200",
      iconIdleBg: "bg-primary-100",
      iconIdleText: "text-primary-600",
      statusIdle: "bg-primary-50 text-primary-700",
      actionIdle: "bg-primary-600 text-white hover:bg-primary-700",
      statusLabel: progress.introCompleted ? "Completed" : "Pending",
    },
    {
      module: practiceModule,
      label: "Practice",
      description:
        "Interactive exercises: matching, spelling, and fill-in-the-blanks.",
      icon: Dumbbell,
      completed: progress.practiceCompleted,
      href: `/learn/sections/${id}/practice`,
      btnLabel: progress.practiceCompleted
        ? "Practice Again"
        : "Continue Practice",
      extra: practiceModule
        ? `${practiceModule._count.questions} Tasks`
        : undefined,
      extraPill: "bg-primary-50 text-primary-700 border-primary-200",
      accentStrip: "bg-primary-300",
      cardTint: "bg-primary-50/20 border-primary-100",
      iconIdleBg: "bg-primary-50",
      iconIdleText: "text-primary-500",
      statusIdle: "bg-primary-50 text-primary-700",
      actionIdle: "bg-primary-500 text-white hover:bg-primary-600",
      statusLabel: progress.practiceCompleted ? "Completed" : "Pending",
    },
    {
      module: testModule,
      label: "Unit Test",
      description: `Final assessment to prove your mastery of "${section.title}" vocabulary.`,
      icon: ClipboardCheck,
      completed: progress.testPassed,
      href: `/learn/sections/${id}/test`,
      btnLabel: progress.testPassed ? "Retake Test" : "Start Test",
      extra: progress.testScore
        ? `Best: ${Math.round(progress.testScore)}%`
        : "Available",
      extraPill:
        testStatus === "pass"
          ? "bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]"
          : testStatus === "failed"
            ? "bg-red-50 text-red-700 border-red-200"
            : "bg-yellow-50 text-yellow-700 border-yellow-200",
      accentStrip:
        testStatus === "pass"
          ? "bg-success-400"
          : testStatus === "failed"
            ? "bg-red-300"
            : "bg-yellow-300",
      cardTint:
        testStatus === "pass"
          ? "bg-[#ECFDF3] border-[#BBF7D0]"
          : testStatus === "failed"
            ? "bg-red-50/70 border-red-200"
            : "bg-yellow-50/80 border-yellow-200",
      iconIdleBg:
        testStatus === "failed"
          ? "bg-red-100"
          : testStatus === "pending"
            ? "bg-yellow-100"
            : "bg-success-100",
      iconIdleText:
        testStatus === "failed"
          ? "text-red-700"
          : testStatus === "pending"
            ? "text-yellow-700"
            : "text-success-700",
      statusIdle:
        testStatus === "pass"
          ? "bg-[#DCFCE7] text-[#166534]"
          : testStatus === "failed"
            ? "bg-red-100 text-red-800"
            : "bg-yellow-100 text-yellow-800",
      actionIdle:
        testStatus === "failed"
          ? "bg-red-300 text-red-950 hover:bg-red-400"
          : testStatus === "pending"
            ? "bg-yellow-200 text-yellow-900 hover:bg-yellow-300"
            : "bg-success-500 text-white hover:bg-success-600",
      statusLabel:
        testStatus === "pass"
          ? "Passed"
          : testStatus === "failed"
            ? "Failed"
            : "Pending",
      keepAccentWhenCompleted: true,
      completedIconBg: "bg-[#DCFCE7]",
      completedIconText: "text-[#15803D]",
      completedAction: "bg-success-500 text-white hover:bg-success-600",
      completedStatus: "bg-[#DCFCE7] text-[#166534]",
    },
  ];

  function normalizeImageSrc(value: string | null | undefined): string {
    if (!value) return APP_IMAGE_FALLBACK;
    const trimmed = value.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    if (LEGACY_IMAGE_PATH_MAP[withLeadingSlash]) {
      return LEGACY_IMAGE_PATH_MAP[withLeadingSlash];
    }
    if (withLeadingSlash.startsWith("/public/")) {
      return withLeadingSlash.replace(/^\/public/, "");
    }
    return withLeadingSlash;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-md">
        <button
          onClick={() => router.push(backHref)}
          className="p-1 -ml-1 text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-2xl bg-gray-50 ring-1 ring-gray-100">
          <img
            src={normalizeImageSrc(section.imageUrl)}
            alt={section.title}
            className="h-full w-full object-cover object-center"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = APP_IMAGE_FALLBACK;
            }}
          />
        </div>
        <div className="truncate">
          <h1 className="truncate text-lg font-bold text-gray-900">{section.title}</h1>
          <p className="truncate text-xs text-gray-400">{section.titleEs}</p>
        </div>
        <button className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100">
          <Info className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4 px-4 py-6">
        {/* Progress */}
        <div className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
            Unit Progress
          </p>
          <div className="mt-1 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">{section.title}</h2>
            <span className="text-2xl font-bold text-primary-600">
              {totalPercent}%
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full bg-primary-600 rounded-full transition-all duration-500"
              style={{ width: `${totalPercent}%` }}
            />
          </div>
        </div>

        {/* Module Cards */}
        <div className="space-y-4">
          {modules.map((mod) => (
            <div
              key={mod.label}
              className={cn(
                "rounded-[28px] border p-5 shadow-sm transition-all",
                mod.completed && !mod.keepAccentWhenCompleted
                  ? "border-gray-100 bg-white"
                  : mod.cardTint
              )}
            >
              <div
                className={cn("mb-4 h-1.5 w-16 rounded-full", mod.accentStrip)}
              />
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                    mod.completed
                      ? (mod.completedIconBg ?? "bg-success-500")
                      : mod.iconIdleBg
                  )}
                >
                  {mod.completed ? (
                    <CheckCircle2
                      className={cn(
                        "w-5 h-5",
                        mod.completedIconText ?? "text-white"
                      )}
                    />
                  ) : (
                    <mod.icon className={cn("w-5 h-5", mod.iconIdleText)} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-bold text-gray-900">{mod.label}</h3>
                    <div className="flex items-center gap-2">
                      {mod.label === "Introduction" && introModule?.content && (
                        <ReadingDifficultyBadge
                          difficulty={introModule.content.readingDifficulty}
                        />
                      )}
                      {mod.extra && (
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                            mod.extraPill ?? "bg-gray-100 text-gray-500 border-gray-200"
                          )}
                        >
                          {mod.extra}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {mod.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                        mod.completed
                          ? (mod.completedStatus ?? "bg-success-50 text-success-700")
                          : mod.statusIdle
                      )}
                    >
                      {mod.completed
                        ? mod.statusLabel === "Passed"
                          ? "Passed"
                          : "Completed"
                        : mod.statusLabel ?? "Pending"}
                    </span>
                  </div>
                  <button
                    onClick={() => router.push(mod.href)}
                    className={cn(
                      "mt-3 flex h-12 w-full items-center justify-center gap-1 rounded-2xl text-sm font-semibold transition-colors",
                      mod.completed
                        ? (mod.completedAction ??
                            "bg-gray-100 text-gray-600 hover:bg-gray-200")
                        : mod.actionIdle
                    )}
                  >
                    {mod.btnLabel}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
