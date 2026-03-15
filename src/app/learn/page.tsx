"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, BookOpen, Flame } from "lucide-react";
import { LogoBadge } from "@/components/logo-badge";
import { APP_IMAGE_FALLBACK } from "@/lib/image-fallback";
import { getCachedAreas, loadAreasWithCache } from "@/lib/learn-client-cache";

interface Area {
  id: string;
  name: string;
  nameEs: string;
  description: string | null;
  imageUrl: string | null;
  unitCount: number;
  isHot: boolean;
}

export default function LearningAreasPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [showWelcomeToast, setShowWelcomeToast] = useState(false);

  async function fetchAreas() {
    return loadAreasWithCache<Area[]>(async () => {
      const res = await fetch("/api/learn/areas");
      if (!res.ok) {
        throw new Error("Failed to load learning areas");
      }
      return (await res.json()) as Area[];
    });
  }

  const fetchData = async () => {
    const cachedAreas = getCachedAreas<Area[]>();
    if (cachedAreas) {
      setAreas(cachedAreas);
      setLoading(false);
    }

    const [areasResult, meResult] = await Promise.allSettled([
      fetchAreas(),
      fetch("/api/auth/me"),
    ]);

    if (areasResult.status === "fulfilled") {
      setAreas(areasResult.value);
    }

    if (meResult.status === "fulfilled" && meResult.value.ok) {
      const me = await meResult.value.json();
      setDisplayName(me.displayName || "");
      if (me.displayName) {
        setShowWelcomeToast(true);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showWelcomeToast) return;
    const timer = window.setTimeout(() => {
      setShowWelcomeToast(false);
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [showWelcomeToast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-6">
      {showWelcomeToast && displayName && (
        <div className="fixed right-4 top-4 z-40 w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-primary-100 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-md">
          {`Welcome back, ${displayName}`}
        </div>
      )}
      {/* Header */}
      <div>
        <h1 className="text-[28px] font-bold leading-none text-gray-900">
          Areas of Knowledge
        </h1>
        <p className="mt-1 text-xs text-gray-400">Áreas de Conocimiento</p>
        <p className="mt-2 text-sm text-gray-500">
          Explore each area to learn themed vocabulary through smaller, focused units.
        </p>
        <div className="mt-2 inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
          {areas.length} {areas.length === 1 ? "Area" : "Areas"} Available
        </div>
      </div>

      {/* Area Cards */}
      <div className="space-y-3">
        {areas.map((area) => (
          <Link
            key={area.id}
            href={`/learn/areas/${area.id}`}
            className={`block rounded-[28px] border bg-white p-4 shadow-sm transition-all ${
              area.isHot
                ? "border-orange-300 ring-1 ring-orange-200 hover:border-orange-400 hover:shadow-md"
                : "border-slate-100 hover:border-primary-200 hover:shadow-md"
            }`}
          >
            {area.isHot && (
              <div className="flex items-center gap-1 mb-2">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-xs font-semibold text-orange-600">
                  Hot Topic
                </span>
                <span className="text-xs text-orange-400">
                  — Trending this week
                </span>
              </div>
            )}
            <div className="flex min-w-0 items-stretch justify-between gap-4">
              <div className="flex min-w-0 flex-[2_2_0px] flex-col justify-between py-1">
                <div>
                  <h3 className="overflow-hidden text-ellipsis whitespace-nowrap text-[20px] font-bold leading-[1.2] tracking-tight text-slate-900">
                    {area.name}
                  </h3>
                  <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] text-slate-500">
                    {area.unitCount} {area.unitCount === 1 ? "unit" : "units"} available
                  </p>
                  <p className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-primary-700">
                    {area.nameEs}
                  </p>
                </div>
                <span className="mt-4 inline-flex h-11 w-fit shrink-0 items-center justify-center rounded-full bg-primary-50 px-5 text-base font-bold text-primary-600 transition-colors group-hover:bg-primary-100">
                  Open Area
                </span>
              </div>
              <div className="relative h-32 w-36 shrink-0 overflow-hidden rounded-3xl bg-primary-50">
                {area.imageUrl ? (
                  <img
                    src={area.imageUrl}
                    alt={area.name}
                    className="h-full w-full object-cover object-center"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = APP_IMAGE_FALLBACK;
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <LogoBadge
                      logo={null}
                      fallback={area.name.slice(0, 1)}
                      size="md"
                      tone="primary"
                    />
                  </div>
                )}
                <div className="absolute bottom-2 right-2 rounded-full bg-primary-600 p-2 text-white shadow-md">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {areas.length === 0 && (
        <div className="rounded-[28px] border border-dashed border-gray-200 py-16 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            No areas available yet. Please check back later!
          </p>
        </div>
      )}
    </div>
  );
}
