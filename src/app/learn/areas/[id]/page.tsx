"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Lock,
  CheckCircle2,
  PlayCircle,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_IMAGE_FALLBACK } from "@/lib/image-fallback";

const IMAGE_FALLBACK_SRC = APP_IMAGE_FALLBACK;
const LEGACY_IMAGE_PATH_MAP: Record<string, string> = {
  "/images/library/humanbody_face.png": "/images/library/humanbody_femaleface.png",
  "/icons/app-fallback.svg": IMAGE_FALLBACK_SRC,
  "/file.svg": IMAGE_FALLBACK_SRC,
};

interface SectionProgress {
  introCompleted: boolean;
  practiceCompleted: boolean;
  testScore: number | null;
  testPassed: boolean;
  unlocked: boolean;
}

interface Section {
  id: string;
  title: string;
  titleEs: string;
  sortOrder: number;
  imageUrl: string | null;
  wordCount: number;
  progress: SectionProgress | null;
}

interface AreaInfo {
  id: string;
  name: string;
  nameEs: string;
  description: string | null;
  imageUrl: string | null;
  unitCount: number;
}

export default function AreaLearningPathPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: areaId } = use(params);
  const router = useRouter();
  const [area, setArea] = useState<AreaInfo | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId]);

  async function fetchData() {
    const [sectionsRes, areasRes, meRes] = await Promise.all([
      fetch(`/api/learn/sections?areaId=${areaId}`),
      fetch("/api/learn/areas"),
      fetch("/api/auth/me"),
    ]);

    if (sectionsRes.ok) {
      setSections(await sectionsRes.json());
    }
    if (areasRes.ok) {
      const areas: AreaInfo[] = await areasRes.json();
      setArea(areas.find((a) => a.id === areaId) || null);
    }
    if (meRes.ok) {
      const me = await meRes.json();
      setDisplayName(me.displayName || "");
    }
    setLoading(false);
  }

  function getSectionStatus(section: Section, index: number) {
    if (index === 0 && !section.progress) return "active";
    if (!section.progress?.unlocked && index > 0) return "locked";
    if (section.progress?.testPassed) return "completed";
    return "active";
  }

  function getCompletionPercent(progress: SectionProgress | null): number {
    if (!progress) return 0;
    let total = 0;
    if (progress.introCompleted) total += 33;
    if (progress.practiceCompleted) total += 33;
    if (progress.testPassed) total += 34;
    return total;
  }

  function normalizeImageSrc(value: string | null | undefined): string {
    if (!value) return IMAGE_FALLBACK_SRC;
    const trimmed = value.trim();
    const normalizedWithLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    if (LEGACY_IMAGE_PATH_MAP[normalizedWithLeadingSlash]) {
      return LEGACY_IMAGE_PATH_MAP[normalizedWithLeadingSlash];
    }
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    if (trimmed.startsWith("/")) {
      return trimmed;
    }
    if (trimmed.startsWith("public/")) {
      return `/${trimmed.replace(/^public\//, "")}`;
    }
    return `/${trimmed}`;
  }

  function resolveAreaImageSrc(areaInfo: AreaInfo | null): string {
    if (!areaInfo) return IMAGE_FALLBACK_SRC;
    const normalized = normalizeImageSrc(areaInfo.imageUrl);
    if (
      areaInfo.name.toLowerCase().includes("human body") &&
      (normalized.includes("humanbody_femaleface") || normalized.includes("humanbody_male"))
    ) {
      return "/images/library/humanbody_torso.png";
    }
    return normalized;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const totalSections = sections.length;
  const completedSections = sections.filter(
    (s) => s.progress?.testPassed
  ).length;
  const overallPercent =
    totalSections > 0
      ? Math.round((completedSections / totalSections) * 100)
      : 0;

  return (
    <div className="space-y-4 px-4 py-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push("/learn")}
          className="mb-2 flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="w-4 h-4" />
          All Areas
        </button>
        {area ? (
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-gray-50 ring-1 ring-gray-100">
              <img
                src={resolveAreaImageSrc(area)}
                alt={area.name}
                className="h-full w-full object-cover object-center"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = IMAGE_FALLBACK_SRC;
                }}
              />
            </div>
            <div>
              <h1 className="text-[28px] font-bold leading-none text-gray-900">{area.name}</h1>
              <p className="text-xs text-gray-400">{area.nameEs}</p>
            </div>
          </div>
        ) : (
          <h1 className="text-[28px] font-bold leading-none text-gray-900">Learning Path</h1>
        )}
        <p className="mt-2 text-sm text-gray-500">
          {displayName ? `Welcome back, ${displayName}` : "Vocabulario ESL"}
        </p>
      </div>

      {/* Overall Progress */}
      <div className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">
            Path Completion
          </span>
          <span className="text-sm font-bold text-primary-600">
            {overallPercent}%
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-600 rounded-full transition-all duration-500"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
          {sections.map((section, index) => {
            const status = getSectionStatus(section, index);
            const completion = getCompletionPercent(section.progress);

            return (
              <div key={section.id} className="animate-fade-in">
                {status === "locked" ? (
                  <div className="rounded-[28px] border border-gray-100 bg-gray-50 p-4 opacity-70">
                    <div className="mb-3 flex justify-end">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        <Lock className="h-3.5 w-3.5" />
                        Locked
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-100">
                        <img
                          src={normalizeImageSrc(section.imageUrl)}
                          alt={section.title}
                          className="h-full w-full object-cover object-center"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = IMAGE_FALLBACK_SRC;
                          }}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-medium">
                          Unit {String(index + 1).padStart(2, "0")}
                        </p>
                        <h3 className="font-bold text-gray-900 mt-0.5">
                          {section.title}
                        </h3>
                        <p className="text-xs text-gray-400">
                          {section.titleEs}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link
                    href={`/learn/sections/${section.id}`}
                    className={cn(
                      "block rounded-[28px] p-4 shadow-sm transition-all",
                      status === "active"
                        ? "bg-white border-2 border-primary-500 shadow-sm"
                        : "bg-white border border-gray-200"
                    )}
                  >
                    <div className="mb-3 flex justify-end">
                      {status === "active" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-700">
                          <PlayCircle className="h-3.5 w-3.5" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF3] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#166534]">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Completed
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-gray-50 ring-1 ring-gray-100">
                          <img
                            src={normalizeImageSrc(section.imageUrl)}
                            alt={section.title}
                            className="h-full w-full object-cover object-center"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = IMAGE_FALLBACK_SRC;
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary-600">
                            Unit {String(index + 1).padStart(2, "0")}
                          </p>
                          <h3 className="mt-1 truncate text-3xl leading-none font-bold text-gray-900">
                            {section.title}
                          </h3>
                          <p className="mt-1 text-sm text-gray-400">
                            {section.titleEs}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-xl bg-gray-100 p-2">
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-500">
                          {section.wordCount} words
                        </span>
                        <span className="text-xs font-medium text-primary-600">
                          {completion}%
                        </span>
                      </div>
                      {status === "active" ? (
                        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-primary-600 transition-all"
                            style={{ width: `${completion}%` }}
                          />
                        </div>
                      ) : (
                        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-success-500" />
                        </div>
                      )}
                    </div>
                  </Link>
                )}
              </div>
            );
          })}
      </div>

      {sections.length === 0 && (
        <div className="text-center py-16">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            No sections available in this area yet. Please check back later!
          </p>
        </div>
      )}
    </div>
  );
}
