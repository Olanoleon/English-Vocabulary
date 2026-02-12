"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Lock,
  CheckCircle2,
  PlayCircle,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  wordCount: number;
  progress: SectionProgress | null;
}

export default function LearningPathPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [sectionsRes, meRes] = await Promise.all([
      fetch("/api/learn/sections"),
      fetch("/api/auth/me"),
    ]);

    if (sectionsRes.ok) {
      setSections(await sectionsRes.json());
    }
    if (meRes.ok) {
      const me = await meRes.json();
      setDisplayName(me.displayName || "");
    }
    setLoading(false);
  }

  function getSectionStatus(section: Section, index: number) {
    // First section is always unlocked
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  // Calculate overall progress
  const totalSections = sections.length;
  const completedSections = sections.filter(
    (s) => s.progress?.testPassed
  ).length;
  const overallPercent =
    totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Learning Path</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {displayName ? `Welcome back, ${displayName}` : "Vocabulario ESL"}
        </p>
      </div>

      {/* Overall Progress */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
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

      {/* Section Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />

        <div className="space-y-4">
          {sections.map((section, index) => {
            const status = getSectionStatus(section, index);
            const completion = getCompletionPercent(section.progress);

            return (
              <div key={section.id} className="relative flex gap-4 animate-fade-in">
                {/* Timeline dot */}
                <div className="relative z-10 flex-shrink-0">
                  {status === "completed" ? (
                    <div className="w-10 h-10 rounded-full bg-success-500 flex items-center justify-center shadow-sm">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                  ) : status === "active" ? (
                    <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center shadow-md ring-4 ring-primary-100">
                      <PlayCircle className="w-5 h-5 text-white" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <Lock className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Card */}
                {status === "locked" ? (
                  <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl p-4 opacity-60">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-medium">
                          Unit {String(index + 1).padStart(2, "0")}
                        </p>
                        <h3 className="font-bold text-gray-900 mt-0.5">
                          {section.title}
                        </h3>
                        <p className="text-xs text-gray-500">{section.titleEs}</p>
                      </div>
                      <Lock className="w-4 h-4 text-gray-300" />
                    </div>
                  </div>
                ) : (
                  <Link
                    href={`/learn/sections/${section.id}`}
                    className={cn(
                      "flex-1 rounded-xl p-4 transition-all",
                      status === "active"
                        ? "bg-white border-2 border-primary-500 shadow-sm"
                        : "bg-white border border-gray-200"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-primary-600 uppercase font-medium">
                            Unit {String(index + 1).padStart(2, "0")}
                            {status === "active" && " · Active"}
                          </p>
                          {status === "completed" && section.progress?.testScore && (
                            <span className="text-xs bg-success-500 text-white px-2 py-0.5 rounded-full font-medium">
                              {Math.round(section.progress.testScore)}% Score
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-gray-900 mt-0.5">
                          {section.title}
                        </h3>
                        <p className="text-xs text-gray-500">{section.titleEs}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>

                    {status === "active" && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400">
                            {section.wordCount} words
                          </span>
                          <span className="text-xs text-primary-600 font-medium">
                            {completion}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-600 rounded-full transition-all"
                            style={{ width: `${completion}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {sections.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-500">
            No sections available yet. Please check back later!
          </p>
        </div>
      )}
    </div>
  );
}
