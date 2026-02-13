"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Trophy,
  AlertTriangle,
  ChevronRight,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionOption {
  id: string;
  optionText: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  type: string;
  prompt: string;
  correctAnswer: string | null;
  options: QuestionOption[];
}

interface SectionData {
  id: string;
  title: string;
  titleEs: string;
  modules: {
    id: string;
    type: string;
    questions: Question[];
  }[];
}

interface AnswerRecord {
  questionId: string;
  selectedOptionId?: string;
  answerText?: string;
}

export default function TestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [section, setSection] = useState<SectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [fillAnswer, setFillAnswer] = useState("");
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
    correctCount: number;
    totalQuestions: number;
  } | null>(null);

  useEffect(() => {
    fetchSection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchSection() {
    const res = await fetch(`/api/learn/sections/${id}`);
    if (res.ok) {
      const data = await res.json();
      // Shuffle test questions
      const testModule = data.modules.find(
        (m: { type: string }) => m.type === "test"
      );
      if (testModule) {
        testModule.questions = shuffleArray(testModule.questions);
      }
      setSection(data);
    }
    setLoading(false);
  }

  function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  const testModule = section?.modules.find((m) => m.type === "test");
  const questions = testModule?.questions || [];
  const currentQuestion = questions[currentIndex];

  function submitAnswer() {
    if (!currentQuestion) return;

    const answer: AnswerRecord = { questionId: currentQuestion.id };

    if (currentQuestion.type === "fill_blank") {
      answer.answerText = fillAnswer;
    } else {
      answer.selectedOptionId = selectedOption || undefined;
    }

    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

    if (currentIndex + 1 >= questions.length) {
      finishTest(newAnswers);
    } else {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setFillAnswer("");
    }
  }

  async function finishTest(finalAnswers: AnswerRecord[]) {
    setSubmitting(true);
    if (testModule) {
      const res = await fetch("/api/learn/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId: testModule.id,
          answers: finalAnswers,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!section || questions.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push(`/learn/sections/${id}`)}
            className="p-1 -ml-1 text-gray-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900 text-sm">Unit Test</h1>
            {section?.titleEs && <p className="text-xs text-gray-400">{section.titleEs}</p>}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-gray-500">No test questions available yet.</p>
            <button
              onClick={() => router.push(`/learn/sections/${id}`)}
              className="mt-4 bg-primary-600 text-white px-6 py-2 rounded-xl text-sm font-medium"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Result screen
  if (result) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <div className="animate-scale-in text-center w-full max-w-sm">
          <div
            className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6",
              result.passed ? "bg-success-500" : "bg-warning-500"
            )}
          >
            {result.passed ? (
              <Trophy className="w-12 h-12 text-white" />
            ) : (
              <AlertTriangle className="w-12 h-12 text-white" />
            )}
          </div>

          <h2 className="text-2xl font-bold text-gray-900">
            {result.passed ? "Test Passed!" : "Not Yet..."}
          </h2>

          <p className="text-gray-500 mt-2">
            {result.passed
              ? "Congratulations! The next section is now unlocked."
              : "You need 80% or higher to pass. Keep studying and try again!"}
          </p>

          <div className="mt-6 bg-gray-50 rounded-2xl p-6">
            <div
              className={cn(
                "text-5xl font-bold",
                result.passed ? "text-success-500" : "text-warning-500"
              )}
            >
              {Math.round(result.score)}%
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {result.correctCount} of {result.totalQuestions} correct
            </p>
            <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  result.passed ? "bg-success-500" : "bg-warning-500"
                )}
                style={{ width: `${result.score}%` }}
              />
            </div>
            <div className="flex items-center justify-center gap-1 mt-2">
              <div className="h-0.5 w-4 bg-gray-300 rounded" />
              <span className="text-xs text-gray-400">80% to pass</span>
              <div className="h-0.5 w-4 bg-gray-300 rounded" />
            </div>
          </div>

          <div className="mt-8 space-y-3">
            {result.passed ? (
              <button
                onClick={() => router.push("/learn")}
                className="w-full bg-primary-600 text-white py-3.5 rounded-xl font-semibold hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
              >
                Continue Learning
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setStarted(false);
                    setCurrentIndex(0);
                    setAnswers([]);
                    setSelectedOption(null);
                    setFillAnswer("");
                    setResult(null);
                    // Re-shuffle
                    if (testModule) {
                      testModule.questions = shuffleArray(testModule.questions);
                    }
                  }}
                  className="w-full bg-primary-600 text-white py-3.5 rounded-xl font-semibold hover:bg-primary-700 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={() => router.push(`/learn/sections/${id}`)}
                  className="w-full bg-gray-100 text-gray-700 py-3.5 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  Review Section
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Submitting screen
  if (submitting) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mb-4" />
        <p className="text-gray-500 font-medium">Calculating your score...</p>
      </div>
    );
  }

  // Start screen
  if (!started) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push(`/learn/sections/${id}`)}
            className="p-1 -ml-1 text-gray-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900 text-sm">Unit Test</h1>
            <p className="text-xs text-gray-400">{section.titleEs}</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="text-center animate-fade-in">
            <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-primary-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {section.title} Test
            </h2>
            <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
              Answer {questions.length} questions about vocabulary and
              pronunciation. You need <strong>80% or higher</strong> to pass and
              unlock the next section.
            </p>

            <div className="mt-6 bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
              <div className="flex items-center justify-between py-1">
                <span>Questions</span>
                <span className="font-bold">{questions.length}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span>Pass Score</span>
                <span className="font-bold text-primary-600">80%</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span>Retakes</span>
                <span className="font-bold">Unlimited</span>
              </div>
            </div>

            <button
              onClick={() => setStarted(true)}
              className="mt-6 w-full bg-primary-600 text-white py-3.5 rounded-xl font-semibold hover:bg-primary-700 transition-colors"
            >
              Start Test
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Test in progress
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <div className="flex-1">
          <h1 className="font-bold text-gray-900 text-sm">Unit Test</h1>
          <p className="text-xs text-gray-400">
            {section.titleEs} · Question {currentIndex + 1} of {questions.length}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-primary-600 transition-all duration-300"
          style={{
            width: `${((currentIndex + 1) / questions.length) * 100}%`,
          }}
        />
      </div>

      {/* Question */}
      <div className="flex-1 px-4 py-6" key={currentIndex}>
        <div className="animate-slide-in">
          <span className="inline-block bg-primary-50 text-primary-600 text-xs font-medium px-2.5 py-1 rounded-full mb-4 capitalize">
            {currentQuestion.type.replace("_", " ")}
          </span>

          <h2 className="text-lg font-bold text-gray-900 mb-6">
            {currentQuestion.prompt}
          </h2>

          {/* Multiple Choice / Phonetics */}
          {(currentQuestion.type === "multiple_choice" ||
            currentQuestion.type === "phonetics") && (
            <div className="space-y-3">
              {currentQuestion.options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedOption(option.id)}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border-2 transition-all text-sm font-medium",
                    option.id === selectedOption
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-200 bg-white hover:border-primary-300"
                  )}
                >
                  {option.optionText}
                </button>
              ))}
            </div>
          )}

          {/* Fill in the Blank */}
          {currentQuestion.type === "fill_blank" && (
            <input
              type="text"
              value={fillAnswer}
              onChange={(e) => setFillAnswer(e.target.value)}
              placeholder="Type your answer..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-primary-500 transition-colors"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && fillAnswer.trim()) {
                  submitAnswer();
                }
              }}
            />
          )}

          {/* Action Button */}
          <div className="mt-6">
            <button
              onClick={submitAnswer}
              disabled={
                currentQuestion.type === "fill_blank"
                  ? !fillAnswer.trim()
                  : !selectedOption
              }
              className="w-full bg-primary-600 text-white py-3.5 rounded-xl font-semibold hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
            >
              {currentIndex + 1 >= questions.length ? "Submit Test" : "Next"}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
