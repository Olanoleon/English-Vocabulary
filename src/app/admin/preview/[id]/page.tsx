"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Volume2,
  BookOpen,
  Dumbbell,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Eye,
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

interface Module {
  id: string;
  type: string;
  content: { readingTitle?: string; readingText?: string } | null;
  questions: Question[];
}

interface VocabWord {
  id: string;
  word: string;
  partOfSpeech: string;
  definitionEs: string;
  exampleSentence: string;
  phoneticIpa: string | null;
}

interface SectionData {
  id: string;
  title: string;
  titleEs: string;
  description: string | null;
  areaId: string;
  modules: Module[];
  sectionVocabulary: { vocabulary: VocabWord }[];
}

type Tab = "intro" | "practice" | "test";

// ─── Practice Question Preview (interactive) ──────────────────────────────────

function PracticeQuestion({
  question,
  index,
}: {
  question: Question;
  index: number;
}) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [fillAnswer, setFillAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  function checkAnswer() {
    let correct = false;
    if (question.type === "fill_blank") {
      correct =
        fillAnswer.toLowerCase().trim() ===
        question.correctAnswer?.toLowerCase().trim();
    } else {
      const selected = question.options.find((o) => o.id === selectedOption);
      correct = selected?.isCorrect || false;
    }
    setIsCorrect(correct);
    setRevealed(true);
  }

  function reset() {
    setSelectedOption(null);
    setFillAnswer("");
    setRevealed(false);
    setIsCorrect(null);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="bg-primary-50 text-primary-600 text-xs font-medium px-2 py-0.5 rounded-full">
          Q{index + 1}
        </span>
        <span className="text-[10px] text-gray-400 uppercase">
          {question.type.replace("_", " ")}
        </span>
      </div>

      <p className="text-sm font-semibold text-gray-900 mb-3">
        {question.prompt}
      </p>

      {/* Multiple Choice / Phonetics */}
      {question.type !== "fill_blank" && (
        <div className="space-y-2">
          {question.options.map((option) => {
            let style = "border-gray-200 bg-white";
            if (revealed) {
              if (option.isCorrect) style = "border-green-400 bg-green-50";
              else if (option.id === selectedOption && !option.isCorrect)
                style = "border-red-400 bg-red-50";
              else style = "border-gray-100 bg-gray-50 opacity-50";
            } else if (option.id === selectedOption) {
              style = "border-primary-400 bg-primary-50";
            }

            return (
              <button
                key={option.id}
                onClick={() => !revealed && setSelectedOption(option.id)}
                disabled={revealed}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg border text-xs font-medium transition-all",
                  style
                )}
              >
                <div className="flex items-center justify-between">
                  <span>{option.optionText}</span>
                  {revealed && option.isCorrect && (
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  )}
                  {revealed &&
                    option.id === selectedOption &&
                    !option.isCorrect && (
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Fill Blank */}
      {question.type === "fill_blank" && (
        <div>
          <input
            type="text"
            value={fillAnswer}
            onChange={(e) => setFillAnswer(e.target.value)}
            disabled={revealed}
            placeholder="Type your answer..."
            className={cn(
              "w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none transition-colors",
              revealed
                ? isCorrect
                  ? "border-green-400 bg-green-50"
                  : "border-red-400 bg-red-50"
                : "border-gray-200 focus:border-primary-500"
            )}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !revealed && fillAnswer.trim()) {
                checkAnswer();
              }
            }}
          />
          {revealed && !isCorrect && (
            <p className="mt-1.5 text-xs text-green-600 font-medium">
              Correct answer: {question.correctAnswer}
            </p>
          )}
        </div>
      )}

      {/* Feedback */}
      {revealed && (
        <div
          className={cn(
            "mt-3 px-3 py-2 rounded-lg text-xs font-medium animate-scale-in",
            isCorrect ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
          )}
        >
          {isCorrect ? "Correct!" : "Incorrect"}
        </div>
      )}

      {/* Actions */}
      <div className="mt-3">
        {!revealed ? (
          <button
            onClick={checkAnswer}
            disabled={
              question.type === "fill_blank"
                ? !fillAnswer.trim()
                : !selectedOption
            }
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-semibold hover:bg-primary-700 disabled:opacity-40 transition-colors"
          >
            Check
          </button>
        ) : (
          <button
            onClick={reset}
            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Preview Page ────────────────────────────────────────────────────────

export default function UnitPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [section, setSection] = useState<SectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("intro");

  useEffect(() => {
    fetchSection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function readApiError(res: Response, fallback: string) {
    try {
      const data = (await res.json()) as { error?: unknown };
      if (typeof data.error === "string" && data.error.trim()) {
        return data.error;
      }
    } catch {
      // Ignore parse errors and return fallback.
    }
    return fallback;
  }

  async function fetchSection() {
    setApiError("");
    try {
      const res = await fetch(`/api/admin/sections/${id}`);
      if (res.ok) {
        setSection(await res.json());
      } else {
        setSection(null);
        setApiError(
          await readApiError(
            res,
            res.status === 403
              ? "You do not have access to this unit."
              : "Failed to load unit preview."
          )
        );
      }
    } catch {
      setSection(null);
      setApiError("Connection error. Please try again.");
    }
    setLoading(false);
  }

  function speak(text: string) {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
  }

  function renderReadingText(text: string) {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return (
          <button
            key={i}
            onClick={() => speak(part)}
            className="font-bold text-primary-600 underline decoration-primary-300 decoration-2 underline-offset-2 hover:bg-primary-50 rounded px-0.5 transition-colors"
          >
            {part}
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!section) {
    return (
      <div className="p-4 text-center text-gray-500">Section not found.</div>
    );
  }

  const introModule = section.modules.find((m) => m.type === "introduction");
  const practiceModule = section.modules.find((m) => m.type === "practice");
  const testModule = section.modules.find((m) => m.type === "test");
  const content = introModule?.content as {
    readingTitle?: string;
    readingText?: string;
  } | null;
  const vocabulary = section.sectionVocabulary.map((sv) => sv.vocabulary);

  const tabs: { key: Tab; label: string; icon: typeof BookOpen; count?: number }[] = [
    { key: "intro", label: "Intro", icon: BookOpen },
    {
      key: "practice",
      label: "Practice",
      icon: Dumbbell,
      count: practiceModule?.questions.length || 0,
    },
    {
      key: "test",
      label: "Test",
      icon: ClipboardCheck,
      count: testModule?.questions.length || 0,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <button
          onClick={() => router.push(`/admin/areas/${section.areaId}`)}
          className="p-1 -ml-1 text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-purple-500 flex-shrink-0" />
            <h1 className="font-bold text-gray-900 text-sm truncate">
              {section.title}
            </h1>
          </div>
          <p className="text-xs text-purple-500">Learner Preview</p>
        </div>
        <button
          onClick={() => router.push(`/admin/sections/${id}`)}
          className="text-xs text-primary-600 font-semibold hover:text-primary-700 transition-colors"
        >
          Edit
        </button>
      </div>
      {apiError && (
        <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {apiError}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all",
                activeTab === tab.key
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full",
                    activeTab === tab.key
                      ? "bg-primary-100 text-primary-600"
                      : "bg-gray-100 text-gray-400"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        {/* ── Intro Tab ─────────────────────────────────────────────────── */}
        {activeTab === "intro" && (
          <div className="animate-fade-in">
            {/* Reading */}
            {content?.readingText && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Reading Context
                  </h2>
                  <button
                    onClick={() => speak(content.readingText || "")}
                    className="flex items-center gap-1 text-xs text-primary-600 font-medium"
                  >
                    <Volume2 className="w-4 h-4" />
                    Listen
                  </button>
                </div>
                {content.readingTitle && (
                  <h3 className="text-lg font-bold text-gray-900 mb-3">
                    {content.readingTitle}
                  </h3>
                )}
                <div className="bg-white rounded-xl p-4 text-sm leading-relaxed text-gray-700 border border-gray-200">
                  {renderReadingText(content.readingText)}
                </div>
              </div>
            )}

            {/* Vocabulary */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Key Vocabulary
                </h2>
                <span className="text-xs text-gray-400">
                  {vocabulary.length} words
                </span>
              </div>

              <div className="space-y-3">
                {vocabulary.map((word) => (
                  <div
                    key={word.id}
                    className="bg-white border border-gray-200 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-primary-600 text-lg">
                          {word.word}
                        </h4>
                        <span className="text-xs text-gray-400 italic">
                          {word.partOfSpeech}
                        </span>
                      </div>
                      <button
                        onClick={() => speak(word.word)}
                        className="p-2 text-gray-300 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>

                    {word.phoneticIpa && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {word.phoneticIpa}
                      </p>
                    )}

                    <p className="text-xs text-gray-400 uppercase mt-2 font-medium">
                      Definicion
                    </p>
                    <p className="text-sm text-gray-700">{word.definitionEs}</p>

                    <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500 italic">
                        &ldquo;{word.exampleSentence}&rdquo;
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Practice Tab ──────────────────────────────────────────────── */}
        {activeTab === "practice" && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Practice Questions
              </h2>
              <span className="text-xs text-gray-400">
                {practiceModule?.questions.length || 0} questions
              </span>
            </div>

            {practiceModule && practiceModule.questions.length > 0 ? (
              <div className="space-y-4">
                {practiceModule.questions.map((q, i) => (
                  <PracticeQuestion key={q.id} question={q} index={i} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Dumbbell className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">
                  No practice questions yet.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Test Tab ──────────────────────────────────────────────────── */}
        {activeTab === "test" && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Test Questions
              </h2>
              <span className="text-xs text-gray-400">
                {testModule?.questions.length || 0} questions
              </span>
            </div>

            {testModule && testModule.questions.length > 0 ? (
              <div className="space-y-4">
                {testModule.questions.map((q, i) => (
                  <PracticeQuestion key={q.id} question={q} index={i} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <ClipboardCheck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">
                  No test questions yet.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom action */}
      <div className="px-4 pb-6">
        <button
          onClick={() => router.push(`/admin/sections/${id}`)}
          className="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors"
        >
          Edit This Unit
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
