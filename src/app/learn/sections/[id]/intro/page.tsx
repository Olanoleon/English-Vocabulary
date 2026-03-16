"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Volume2, ChevronRight } from "lucide-react";
import { LogoBadge } from "@/components/logo-badge";
import { ReadingDifficultyBadge } from "@/components/reading-difficulty-badge";
import { cancelSpeech, speakSmart } from "@/lib/browser-tts";

interface VocabWord {
  id: string;
  word: string;
  wordEs: string | null;
  partOfSpeech: string;
  definitionEs: string;
  exampleSentence: string;
  phoneticIpa: string | null;
}

interface SectionData {
  id: string;
  title: string;
  titleEs: string;
  imageUrl: string | null;
  modules: {
    id: string;
    type: string;
    content: {
      readingTitle?: string;
      readingText?: string;
      readingDifficulty?: string;
    } | null;
  }[];
  sectionVocabulary: { vocabulary: VocabWord }[];
}

export default function IntroductionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [section, setSection] = useState<SectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [activeWordToast, setActiveWordToast] = useState<{
    key: number;
    translation: string;
  } | null>(null);
  const wordToastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    fetchSection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchSection() {
    const res = await fetch(`/api/learn/sections/${id}?view=intro`);
    if (res.ok) {
      setSection(await res.json());
    }
    setLoading(false);
  }

  function speak(text: string) {
    void speakSmart(text);
  }

  function normalizeLookupWord(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getWordTranslation(word: string) {
    function extractSpanishWord(value: string | null | undefined) {
      const raw = String(value || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!raw) return null;
      const firstClause = raw.split(/[.;:]/)[0].split(",")[0].trim();
      const articleStripped = firstClause
        .replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, "")
        .trim();
      const compact = (articleStripped || firstClause).split(/\s+/).slice(0, 3).join(" ");
      return compact || null;
    }

    if (!section) return null;
    const normalizedWord = normalizeLookupWord(word);
    if (!normalizedWord) return null;
    const vocabulary = section.sectionVocabulary.map((sv) => sv.vocabulary);

    const exact = vocabulary.find(
      (entry) => normalizeLookupWord(entry.word) === normalizedWord
    );
    if (exact?.wordEs && exact.wordEs.trim()) return exact.wordEs.trim();
    if (exact?.definitionEs) return extractSpanishWord(exact.definitionEs);

    const fuzzy = vocabulary.find((entry) => {
      const normalizedEntry = normalizeLookupWord(entry.word);
      return (
        normalizedWord.includes(normalizedEntry) ||
        normalizedEntry.includes(normalizedWord)
      );
    });
    if (fuzzy?.wordEs && fuzzy.wordEs.trim()) return fuzzy.wordEs.trim();
    return extractSpanishWord(fuzzy?.definitionEs);
  }

  function hideWordToast(key: number) {
    setActiveWordToast((current) => (current?.key === key ? null : current));
  }

  function showWordToast(key: number, translation: string) {
    if (wordToastTimerRef.current) {
      window.clearTimeout(wordToastTimerRef.current);
      wordToastTimerRef.current = null;
    }
    setActiveWordToast({ key, translation });
    wordToastTimerRef.current = window.setTimeout(() => {
      setActiveWordToast((current) => (current?.key === key ? null : current));
      wordToastTimerRef.current = null;
    }, 2000);
  }

  function renderReadingText(text: string) {
    // Replace **word** with highlighted spans
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        // This is a highlighted word
        const translation = getWordTranslation(part);
        return (
          <span key={i} className="relative inline-flex">
            <button
              onClick={() => {
                speak(part);
                if (translation) {
                  showWordToast(i, translation);
                }
              }}
              onBlur={() => hideWordToast(i)}
              className="font-bold text-primary-600 underline decoration-primary-300 decoration-2 underline-offset-2 hover:bg-primary-50 rounded px-0.5 transition-colors"
            >
              {part}
            </button>
            {activeWordToast?.key === i && (
              <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg">
                {activeWordToast.translation}
              </span>
            )}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }

  useEffect(() => {
    return () => {
      if (wordToastTimerRef.current) {
        window.clearTimeout(wordToastTimerRef.current);
      }
      cancelSpeech();
    };
  }, []);

  async function markCompleted() {
    setMarking(true);
    cancelSpeech();
    await fetch("/api/learn/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId: id, type: "intro" }),
    });
    router.push(`/learn/sections/${id}/practice`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!section) return null;

  const introModule = section.modules.find((m) => m.type === "introduction");
  const content = introModule?.content as {
    readingTitle?: string;
    readingText?: string;
    readingDifficulty?: string;
  } | null;
  const vocabulary = section.sectionVocabulary.map((sv) => sv.vocabulary);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-100 bg-white/95 px-4 py-4 backdrop-blur-md">
        <button
          onClick={() => {
            cancelSpeech();
            router.push(`/learn/sections/${id}`);
          }}
          className="p-1 -ml-1 text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <LogoBadge logo={section.imageUrl} size="sm" tone="primary" />
        <div className="flex-1">
          <h1 className="font-bold text-gray-900 text-sm">{section.title}</h1>
          <p className="text-xs text-gray-400">{section.titleEs} · Introduction</p>
        </div>
        <ReadingDifficultyBadge difficulty={content?.readingDifficulty} />
      </div>

      <div className="space-y-6 px-4 py-6">
        {/* Reading Context */}
        {content?.readingText && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Introduction
              </h2>
            </div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {content.readingTitle ? (
                  <h3 className="text-lg font-bold text-gray-900">
                    {content.readingTitle}
                  </h3>
                ) : null}
              </div>
              <button
                onClick={() => speak(content.readingText || "")}
                className="flex items-center gap-1 text-xs text-primary-600 font-medium"
              >
                <Volume2 className="w-4 h-4" />
                Listen
              </button>
            </div>
            <div className="rounded-[28px] border border-gray-100 bg-white p-4 text-sm leading-relaxed text-gray-700 shadow-sm">
              {renderReadingText(content.readingText)}
            </div>
          </div>
        )}

        {/* Key Vocabulary */}
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
                className="animate-fade-in rounded-[28px] border border-gray-100 bg-white p-4 shadow-sm"
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
                  Definición
                </p>
                <p className="text-sm text-gray-700">{word.definitionEs}</p>

                <div className="mt-2 rounded-2xl bg-gray-50 px-3 py-2">
                  <p className="text-xs text-gray-500 italic">
                    &ldquo;{word.exampleSentence}&rdquo;
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Continue Button */}
        <button
          onClick={markCompleted}
          disabled={marking}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary-600 font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
        >
          {marking ? "Saving..." : "Continue to Unit Practice"}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
