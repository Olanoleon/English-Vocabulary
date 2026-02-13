"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
/* eslint-disable @next/next/no-img-element */
import { FolderOpen, ChevronRight, BookOpen } from "lucide-react";

interface Area {
  id: string;
  name: string;
  nameEs: string;
  description: string | null;
  imageUrl: string | null;
  unitCount: number;
}

export default function LearningAreasPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
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
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Areas of Knowledge
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">Áreas de Conocimiento</p>
        <p className="text-sm text-gray-500 mt-1">
          {displayName
            ? `Welcome back, ${displayName}`
            : "Choose an area to start learning"}
        </p>
      </div>

      {/* Area Cards */}
      <div className="space-y-3">
        {areas.map((area) => (
          <Link
            key={area.id}
            href={`/learn/areas/${area.id}`}
            className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-primary-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-4">
              {/* Logo */}
              <div className="w-14 h-14 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {area.imageUrl ? (
                  <img
                    src={area.imageUrl}
                    alt={area.name}
                    className="w-14 h-14 object-cover rounded-xl"
                  />
                ) : (
                  <FolderOpen className="w-7 h-7 text-primary-400" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900">{area.name}</h3>
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

              <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
            </div>
          </Link>
        ))}
      </div>

      {areas.length === 0 && (
        <div className="text-center py-16">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            No areas available yet. Please check back later!
          </p>
        </div>
      )}
    </div>
  );
}
