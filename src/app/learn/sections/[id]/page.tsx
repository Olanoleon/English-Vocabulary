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

interface SectionData {
  id: string;
  title: string;
  titleEs: string;
  modules: {
    id: string;
    type: string;
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
  const introModule = section.modules.find((m) => m.type === "introduction");
  const practiceModule = section.modules.find((m) => m.type === "practice");
  const testModule = section.modules.find((m) => m.type === "test");

  const totalPercent =
    (progress.introCompleted ? 33 : 0) +
    (progress.practiceCompleted ? 33 : 0) +
    (progress.testPassed ? 34 : 0);

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
      color: "primary" as const,
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
      color: "primary" as const,
      extra: practiceModule
        ? `${practiceModule._count.questions} Tasks`
        : undefined,
    },
    {
      module: testModule,
      label: "Unit Test",
      description: `Final assessment to prove your mastery of "${section.title}" vocabulary.`,
      icon: ClipboardCheck,
      completed: progress.testPassed,
      href: `/learn/sections/${id}/test`,
      btnLabel: progress.testPassed ? "Retake Test" : "Start Test",
      color: "success" as const,
      extra: progress.testScore
        ? `Best: ${Math.round(progress.testScore)}%`
        : "Available",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <button
          onClick={() => router.push("/learn")}
          className="p-1 -ml-1 text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-gray-900 truncate">{section.title}</h1>
        <button className="ml-auto p-1 text-gray-400">
          <Info className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 py-6">
        {/* Progress */}
        <div className="mb-6">
          <p className="text-xs text-primary-600 uppercase font-medium">
            Unit Progress
          </p>
          <div className="flex items-center justify-between mt-1">
            <h2 className="text-xl font-bold text-gray-900">{section.title}</h2>
            <span className="text-xl font-bold text-primary-600">
              {totalPercent}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
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
                "bg-white rounded-xl border p-4 transition-all",
                !mod.completed &&
                  mod.label !== "Unit Test" &&
                  "border-primary-200 shadow-sm"
              )}
              style={{
                borderColor: mod.completed ? "#e5e7eb" : undefined,
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                    mod.completed ? "bg-success-500" : "bg-primary-100"
                  )}
                >
                  {mod.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  ) : (
                    <mod.icon className="w-5 h-5 text-primary-600" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-900">{mod.label}</h3>
                    {mod.extra && (
                      <span className="text-xs text-gray-400">{mod.extra}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {mod.description}
                  </p>
                  <button
                    onClick={() => router.push(mod.href)}
                    className={cn(
                      "mt-3 w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1 transition-colors",
                      mod.completed
                        ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        : "bg-primary-600 text-white hover:bg-primary-700"
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
