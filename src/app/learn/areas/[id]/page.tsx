"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Lock,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_IMAGE_FALLBACK } from "@/lib/image-fallback";
import {
  getCachedAreas,
  getCachedAreaSections,
  loadAreasWithCache,
  loadAreaSectionsWithCache,
} from "@/lib/learn-client-cache";

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
  description: string | null;
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
  const searchParams = useSearchParams();
  const focusSectionId = searchParams.get("focusSectionId");
  const [area, setArea] = useState<AreaInfo | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId, focusSectionId]);

  useEffect(() => {
    if (!focusSectionId || sections.length === 0) return;
    const target = document.getElementById(`section-card-${focusSectionId}`);
    if (!target) return;
    const raf = window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [focusSectionId, sections]);

  async function fetchAreas() {
    return loadAreasWithCache<AreaInfo[]>(async () => {
      const res = await fetch("/api/learn/areas");
      if (!res.ok) {
        throw new Error("Failed to load areas");
      }
      return (await res.json()) as AreaInfo[];
    });
  }

  async function fetchSections(forceFresh = false) {
    const fetcher = async () => {
      const res = await fetch(`/api/learn/sections?areaId=${areaId}`);
      if (!res.ok) {
        throw new Error("Failed to load area sections");
      }
      return (await res.json()) as Section[];
    };
    if (forceFresh) {
      return loadAreaSectionsWithCache<Section[]>(areaId, fetcher, 0);
    }
    return loadAreaSectionsWithCache<Section[]>(areaId, fetcher);
  }

  async function fetchData() {
    const shouldForceFresh = Boolean(focusSectionId);
    const cachedSections = getCachedAreaSections<Section[]>(areaId);
    const cachedAreas = getCachedAreas<AreaInfo[]>();
    if (cachedSections && !shouldForceFresh) {
      setSections(cachedSections);
      setLoading(false);
    }
    if (cachedAreas) {
      setArea(cachedAreas.find((a) => a.id === areaId) || null);
    }

    const [sectionsResult, areasResult] = await Promise.allSettled([
      fetchSections(shouldForceFresh),
      fetchAreas(),
    ]);

    if (sectionsResult.status === "fulfilled") {
      setSections(sectionsResult.value);
    }
    if (areasResult.status === "fulfilled") {
      setArea(areasResult.value.find((a) => a.id === areaId) || null);
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
          className="mb-5 flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="w-4 h-4" />
          All Areas
        </button>
        {area ? (
          <div className="space-y-3">
            <div className="grid grid-cols-[106px_minmax(0,1fr)] grid-rows-[auto_auto] gap-x-3 gap-y-2">
              <div className="row-span-2 h-[106px] w-[106px] shrink-0 overflow-hidden rounded-2xl bg-gray-50 ring-1 ring-gray-100">
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

              <div className="min-w-0 rounded-[24px] border border-gray-100 bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">
                    Area Progress
                  </span>
                  <span className="text-sm font-bold text-primary-600">
                    {overallPercent}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-primary-600 transition-all duration-500"
                    style={{ width: `${overallPercent}%` }}
                  />
                </div>
              </div>

              <div className="min-w-0 self-start">
                <h1 className="truncate text-left text-[28px] font-bold leading-tight text-gray-900">
                  {area.name}
                </h1>
              </div>
            </div>
            {area.description ? (
              <p className="text-justify text-sm text-gray-500">
                {area.description}
              </p>
            ) : null}
          </div>
        ) : (
          <h1 className="text-[28px] font-bold leading-none text-gray-900">Learning Path</h1>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-5">
          {sections.map((section, index) => {
            const status = getSectionStatus(section, index);
            const completion = getCompletionPercent(section.progress);

            return (
              <div
                key={section.id}
                id={`section-card-${section.id}`}
                className="relative animate-fade-in"
              >
                {status === "locked" ? (
                  <div className="relative min-h-[116px] overflow-hidden rounded-[28px] border border-primary-100 bg-primary-50/15 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-primary-100">
                        <img
                          src={normalizeImageSrc(section.imageUrl)}
                          alt={section.title}
                          className="h-full w-full scale-110 object-cover object-center"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = IMAGE_FALLBACK_SRC;
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          Unit {String(index + 1).padStart(2, "0")}
                        </p>
                        <h3 className="overflow-hidden text-[20px] font-bold leading-tight text-gray-900 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                          {section.title}
                        </h3>
                        {section.description && (
                          <p className="mt-1 overflow-hidden text-xs leading-snug text-gray-500 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                            {section.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[28px] bg-white/35 backdrop-blur-[1px]">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100/90 shadow-sm">
                        <Lock className="h-5 w-5 text-gray-500" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link
                    href={`/learn/sections/${section.id}`}
                    className={cn(
                      "block min-h-[116px] rounded-[28px] p-4 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.995]",
                      status === "active"
                        ? "bg-primary-50/20 border-2 border-primary-500 shadow-sm"
                        : status === "completed"
                          ? "bg-primary-50/10 border border-primary-200 shadow-sm"
                          : "bg-primary-50/10 border border-primary-100"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-primary-100">
                          <img
                            src={normalizeImageSrc(section.imageUrl)}
                            alt={section.title}
                            className="h-full w-full scale-110 object-cover object-center"
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
                          <h3 className="overflow-hidden text-[20px] leading-tight font-bold text-gray-900 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                            {section.title}
                          </h3>
                          {section.description && (
                            <p className="mt-1 overflow-hidden text-xs leading-snug text-gray-500 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                              {section.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="rounded-xl bg-primary-50 p-2">
                        <ChevronRight className="h-4 w-4 text-primary-500" />
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-medium text-primary-700">
                          {section.wordCount} words
                        </span>
                        <span className="text-sm font-bold text-primary-600">
                          {status === "completed" ? "100%" : `${completion}%`}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-primary-600 transition-all duration-500"
                          style={{ width: `${status === "completed" ? 100 : completion}%` }}
                        />
                      </div>
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
