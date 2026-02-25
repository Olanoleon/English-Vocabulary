"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Volume2, ChevronRight } from "lucide-react";
import { LogoBadge } from "@/components/logo-badge";

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
  imageUrl: string | null;
  modules: {
    id: string;
    type: string;
    content: { readingTitle?: string; readingText?: string } | null;
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

  useEffect(() => {
    fetchSection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchSection() {
    const res = await fetch(`/api/learn/sections/${id}`);
    if (res.ok) {
      setSection(await res.json());
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
    // Replace **word** with highlighted spans
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        // This is a highlighted word
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

  async function markCompleted() {
    setMarking(true);
    await fetch("/api/learn/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId: id, type: "intro" }),
    });
    router.push(`/learn/sections/${id}`);
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
  } | null;
  const vocabulary = section.sectionVocabulary.map((sv) => sv.vocabulary);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <button
          onClick={() => router.push(`/learn/sections/${id}`)}
          className="p-1 -ml-1 text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <LogoBadge logo={section.imageUrl} size="sm" tone="primary" />
        <div className="flex-1">
          <h1 className="font-bold text-gray-900 text-sm">{section.title}</h1>
          <p className="text-xs text-gray-400">{section.titleEs} · Introduction</p>
        </div>
      </div>

      <div className="px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <span className="bg-primary-600 text-white px-3 py-1 rounded-full text-xs font-medium">
            Introduction
          </span>
          <span className="bg-gray-100 text-gray-400 px-3 py-1 rounded-full text-xs font-medium">
            Practice
          </span>
          <span className="bg-gray-100 text-gray-400 px-3 py-1 rounded-full text-xs font-medium">
            Test
          </span>
        </div>

        {/* Reading Context */}
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
            <div className="bg-gray-50 rounded-xl p-4 text-sm leading-relaxed text-gray-700">
              {renderReadingText(content.readingText)}
            </div>
          </div>
        )}

        {/* Key Vocabulary */}
        <div className="mb-8">
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
                className="bg-white border border-gray-200 rounded-xl p-4 animate-fade-in"
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

                <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2">
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
          className="w-full bg-primary-600 text-white py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {marking ? "Saving..." : "Continue to Unit Practice"}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
