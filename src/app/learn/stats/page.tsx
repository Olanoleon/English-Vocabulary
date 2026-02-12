"use client";

import { useEffect, useState } from "react";
import { Trophy, BookOpen, Target, TrendingUp } from "lucide-react";

interface Section {
  id: string;
  title: string;
  titleEs: string;
  wordCount: number;
  progress: {
    introCompleted: boolean;
    practiceCompleted: boolean;
    testScore: number | null;
    testPassed: boolean;
    unlocked: boolean;
  } | null;
}

export default function StatsPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch_data() {
      const res = await fetch("/api/learn/sections");
      if (res.ok) {
        setSections(await res.json());
      }
      setLoading(false);
    }
    fetch_data();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const completedSections = sections.filter((s) => s.progress?.testPassed);
  const totalWords = sections.reduce((sum, s) => sum + s.wordCount, 0);
  const learnedWords = completedSections.reduce(
    (sum, s) => sum + s.wordCount,
    0
  );
  const avgScore =
    completedSections.length > 0
      ? Math.round(
          completedSections.reduce(
            (sum, s) => sum + (s.progress?.testScore || 0),
            0
          ) / completedSections.length
        )
      : 0;

  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Statistics</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-primary-50 rounded-xl p-4">
          <Trophy className="w-5 h-5 text-primary-600 mb-2" />
          <p className="text-2xl font-bold text-gray-900">
            {completedSections.length}
          </p>
          <p className="text-xs text-gray-500">Sections Completed</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <BookOpen className="w-5 h-5 text-success-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{learnedWords}</p>
          <p className="text-xs text-gray-500">Words Learned</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4">
          <Target className="w-5 h-5 text-warning-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{avgScore}%</p>
          <p className="text-xs text-gray-500">Average Score</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4">
          <TrendingUp className="w-5 h-5 text-purple-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">
            {sections.length > 0
              ? Math.round(
                  (completedSections.length / sections.length) * 100
                )
              : 0}
            %
          </p>
          <p className="text-xs text-gray-500">Path Progress</p>
        </div>
      </div>

      {/* Section Breakdown */}
      <h2 className="font-semibold text-gray-900 mb-3">Section Breakdown</h2>
      <div className="space-y-3">
        {sections.map((section, idx) => (
          <div
            key={section.id}
            className="bg-white border border-gray-200 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs text-gray-400">Unit {idx + 1}</p>
                <p className="font-semibold text-gray-900 text-sm">
                  {section.title}
                </p>
              </div>
              {section.progress?.testPassed ? (
                <span className="text-xs bg-success-500 text-white px-2 py-0.5 rounded-full">
                  {Math.round(section.progress.testScore || 0)}%
                </span>
              ) : section.progress?.unlocked ? (
                <span className="text-xs bg-primary-100 text-primary-600 px-2 py-0.5 rounded-full">
                  In Progress
                </span>
              ) : (
                <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                  Locked
                </span>
              )}
            </div>
            <div className="flex gap-1">
              <div
                className={`h-1.5 flex-1 rounded-full ${
                  section.progress?.introCompleted
                    ? "bg-success-500"
                    : "bg-gray-200"
                }`}
              />
              <div
                className={`h-1.5 flex-1 rounded-full ${
                  section.progress?.practiceCompleted
                    ? "bg-success-500"
                    : "bg-gray-200"
                }`}
              />
              <div
                className={`h-1.5 flex-1 rounded-full ${
                  section.progress?.testPassed
                    ? "bg-success-500"
                    : "bg-gray-200"
                }`}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-gray-400">Intro</span>
              <span className="text-[10px] text-gray-400">Practice</span>
              <span className="text-[10px] text-gray-400">Test</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
