"use client";

import { useEffect, useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReviewedOption {
  id: string;
  optionText: string;
  isCorrect: boolean;
}

interface ReviewedQuestion {
  answerId: string;
  isCorrect: boolean;
  question: {
    id: string;
    type: string;
    prompt: string;
    correctAnswer: string | null;
    options: ReviewedOption[];
  };
  learnerAnswer: {
    selectedOptionId: string | null;
    selectedOptionText: string | null;
    answerText: string | null;
  };
  expected: {
    optionText: string | null;
    answerText: string | null;
  };
}

interface AttemptPayload {
  attempt: {
    id: string;
    score: number | null;
    passed: boolean | null;
    completedAt: string | null;
    reviewedQuestions: ReviewedQuestion[];
  } | null;
}

type MatchingPair = { word: string; definition: string; spanish?: string };

function parsePairs(value: string | null): MatchingPair[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as MatchingPair[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseLearnerMap(value: string | null): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export default function TestReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [attempt, setAttempt] = useState<AttemptPayload["attempt"]>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchAttempt();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchAttempt() {
    setApiError("");
    const res = await fetch(`/api/learn/attempts?sectionId=${encodeURIComponent(id)}`);
    if (res.ok) {
      const data = (await res.json()) as AttemptPayload;
      setAttempt(data.attempt);
    } else {
      setApiError("Failed to load last attempt.");
    }
    setLoading(false);
  }

  const wrongCount = useMemo(() => {
    if (!attempt) return 0;
    return attempt.reviewedQuestions.filter((q) => !q.isCorrect).length;
  }, [attempt]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <button
          onClick={() => router.push(`/learn/sections/${id}/test`)}
          className="p-1 -ml-1 text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-sm">Last Test Review</h1>
          <p className="text-xs text-gray-400">Mistakes and correct answers</p>
        </div>
      </div>

      <div className="px-4 py-6 space-y-4">
        {apiError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {apiError}
          </div>
        )}

        {!apiError && !attempt && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
            No completed test attempt found yet.
          </div>
        )}

        {attempt && (
          <>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">
                Score: <span className="font-semibold text-gray-900">{Math.round(attempt.score || 0)}%</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Mistakes: <span className="font-semibold text-gray-900">{wrongCount}</span>
              </p>
            </div>

            <div className="space-y-3">
              {attempt.reviewedQuestions.map((item, idx) => {
                const q = item.question;
                const correctPairs = q.type === "matching" ? parsePairs(q.correctAnswer) : [];
                const learnerPairs =
                  q.type === "matching" ? parseLearnerMap(item.learnerAnswer.answerText) : {};

                return (
                  <div
                    key={item.answerId}
                    className={cn(
                      "rounded-xl border p-4 bg-white",
                      item.isCorrect ? "border-green-200" : "border-red-200"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-400">Q{idx + 1}</p>
                      {item.isCorrect ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mb-3">{q.prompt}</p>

                    {(q.type === "multiple_choice" || q.type === "phonetics") && (
                      <div className="space-y-2">
                        {q.options.map((opt) => (
                          <div
                            key={opt.id}
                            className={cn(
                              "px-3 py-2 rounded-lg border text-xs",
                              opt.isCorrect
                                ? "border-green-300 bg-green-50"
                                : opt.id === item.learnerAnswer.selectedOptionId
                                ? "border-red-300 bg-red-50"
                                : "border-gray-200 bg-white"
                            )}
                          >
                            {opt.optionText}
                          </div>
                        ))}
                      </div>
                    )}

                    {q.type === "fill_blank" && (
                      <div className="space-y-1 text-xs">
                        <p className="text-gray-500">
                          Your answer:{" "}
                          <span className={cn("font-semibold", item.isCorrect ? "text-green-600" : "text-red-600")}>
                            {item.learnerAnswer.answerText || "—"}
                          </span>
                        </p>
                        {!item.isCorrect && (
                          <p className="text-gray-500">
                            Correct answer:{" "}
                            <span className="font-semibold text-green-600">
                              {item.expected.answerText || "—"}
                            </span>
                          </p>
                        )}
                      </div>
                    )}

                    {q.type === "matching" && (
                      <div className="space-y-1 text-xs">
                        {correctPairs.map((pair, pairIdx) => {
                          const learnerDefinition = learnerPairs[pair.word];
                          const pairCorrect = learnerDefinition === pair.definition;
                          return (
                            <p key={`${pair.word}-${pairIdx}`} className="text-gray-600">
                              <span className="font-semibold">{pair.word}</span>:{" "}
                              <span className={pairCorrect ? "text-green-600" : "text-red-600"}>
                                {learnerDefinition || "—"}
                              </span>
                              {!pairCorrect && (
                                <>
                                  {" "}→ <span className="text-green-600">{pair.definition}</span>
                                </>
                              )}
                            </p>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
