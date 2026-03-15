"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, BookOpen, Flame } from "lucide-react";
import { LogoBadge } from "@/components/logo-badge";

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

  const fetchData = async () => {
    const [areasRes, meRes] = await Promise.all([
      fetch("/api/learn/areas"),
      fetch("/api/auth/me"),
    ]);

    if (areasRes.ok) {
      setAreas(await areasRes.json());
    }
    if (meRes.ok) {
      const me = await meRes.json();
      setDisplayName(me.displayName || "");
    }
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-6">
      {/* Header */}
      <div>
        <h1 className="text-[28px] font-bold leading-none text-gray-900">
          Areas of Knowledge
        </h1>
        <p className="mt-1 text-xs text-gray-400">Áreas de Conocimiento</p>
        <p className="mt-2 text-sm text-gray-500">
          {displayName
            ? `Welcome back, ${displayName}`
            : "Choose an area to start learning"}
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
                : "border-gray-100 hover:border-primary-300 hover:shadow-md"
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
            <div className="flex items-center gap-4">
              {/* Area Logo */}
              <LogoBadge
                logo={area.imageUrl}
                size="lg"
                tone={area.isHot ? "orange" : "primary"}
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="truncate text-[20px] font-bold leading-tight text-gray-900">{area.name}</h3>
                <p className="text-xs text-gray-400">{area.nameEs}</p>
                {area.description && (
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {area.description}
                  </p>
                )}
                <p className="text-xs text-primary-600 font-medium mt-1">
                  {area.unitCount} {area.unitCount === 1 ? "unit" : "units"}
                </p>
              </div>

              <div className="rounded-xl bg-gray-100 p-2">
                <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
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
