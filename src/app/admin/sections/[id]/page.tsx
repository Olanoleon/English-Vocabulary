"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Sparkles,
  BookOpen,
  Dumbbell,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoBadge } from "@/components/logo-badge";
import { ReadingDifficultyBadge } from "@/components/reading-difficulty-badge";
import { AppModal, modalActionButtonClass } from "@/components/app-modal";

interface Vocabulary {
  id: string;
  word: string;
  partOfSpeech: string;
  definitionEs: string;
  exampleSentence: string;
  phoneticIpa: string | null;
  stressedSyllable: string | null;
}

interface QuestionOption {
  id: string;
  optionText: string;
  isCorrect: boolean;
  sortOrder: number;
}

interface Question {
  id: string;
  type: string;
  prompt: string;
  correctAnswer: string | null;
  vocabularyId: string | null;
  options: QuestionOption[];
}

interface MatchingPairPreview {
  word: string;
  definition: string;
  spanish?: string;
}

const MATCHING_PREVIEW_COLOR_CLASSES = [
  {
    word: "border-blue-400 bg-blue-100 text-blue-900",
    definition: "border-blue-400 bg-blue-100 text-slate-800",
    spanish: "text-blue-700/70",
  },
  {
    word: "border-purple-400 bg-purple-100 text-purple-900",
    definition: "border-purple-400 bg-purple-100 text-slate-800",
    spanish: "text-purple-700/70",
  },
  {
    word: "border-amber-400 bg-amber-100 text-amber-900",
    definition: "border-amber-400 bg-amber-100 text-slate-800",
    spanish: "text-amber-700/70",
  },
  {
    word: "border-teal-400 bg-teal-100 text-teal-900",
    definition: "border-teal-400 bg-teal-100 text-slate-800",
    spanish: "text-teal-700/70",
  },
  {
    word: "border-rose-400 bg-rose-100 text-rose-900",
    definition: "border-rose-400 bg-rose-100 text-slate-800",
    spanish: "text-rose-700/70",
  },
];

interface Module {
  id: string;
  type: string;
  content: {
    readingTitle?: string;
    readingText?: string;
    readingDifficulty?: string;
  } | null;
  questions: Question[];
  _count: { questions: number };
}

interface SectionDetail {
  id: string;
  title: string;
  titleEs: string;
  imageUrl: string | null;
  description: string;
  isActive: boolean;
  areaId: string;
  modules: Module[];
  sectionVocabulary: { id: string; vocabulary: Vocabulary }[];
}

export default function SectionEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  function parseMatchingPairs(correctAnswer: string | null): MatchingPairPreview[] {
    if (!correctAnswer) return [];
    try {
      const parsed = JSON.parse(correctAnswer) as unknown;
      if (!Array.isArray(parsed)) return [];
      const pairs: MatchingPairPreview[] = [];
      for (const row of parsed) {
        if (!row || typeof row !== "object") continue;
        const candidate = row as Record<string, unknown>;
        const word =
          typeof candidate.word === "string" ? candidate.word.trim() : "";
        const definition =
          typeof candidate.definition === "string"
            ? candidate.definition.trim()
            : "";
        const spanish =
          typeof candidate.spanish === "string"
            ? candidate.spanish.trim()
            : "";
        if (!word || !definition) continue;
        pairs.push({ word, definition, spanish: spanish || undefined });
      }
      return pairs;
    } catch {
      return [];
    }
  }

  function renderSolvedMatchingPreview(questionId: string, pairs: MatchingPairPreview[]) {
    if (pairs.length === 0) {
      return (
        <p className="text-xs text-gray-500">
          Could not preview matching pairs.
        </p>
      );
    }

    return (
      <div className="space-y-2.5">
        <p className="text-xs text-gray-500">
          Tap a word, then tap its definition to pair them
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Words
            </p>
            {pairs.map((pair, idx) => {
              const palette =
                MATCHING_PREVIEW_COLOR_CLASSES[idx % MATCHING_PREVIEW_COLOR_CLASSES.length];
              return (
                <div
                  key={`${questionId}-word-${idx}`}
                  className={cn(
                    "rounded-2xl border-2 px-3 py-2 text-sm font-semibold",
                    palette.word
                  )}
                >
                  {pair.word} <span className="text-xs align-middle">✓</span>
                </div>
              );
            })}
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Definitions
            </p>
            {pairs.map((pair, idx) => {
              const palette =
                MATCHING_PREVIEW_COLOR_CLASSES[idx % MATCHING_PREVIEW_COLOR_CLASSES.length];
              return (
                <div
                  key={`${questionId}-def-${idx}`}
                  className={cn(
                    "rounded-2xl border-2 px-3 py-2 text-sm",
                    palette.definition
                  )}
                >
                  <p>{pair.definition}</p>
                  {pair.spanish ? (
                    <p className={cn("mt-1 italic text-xs", palette.spanish)}>
                      {pair.spanish}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const { id } = use(params);
  const router = useRouter();
  const [section, setSection] = useState<SectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"vocab" | "intro" | "questions">("vocab");
  const [saving, setSaving] = useState(false);

  // Section edit fields
  const [title, setTitle] = useState("");
  const [titleEs, setTitleEs] = useState("");
  const [description, setDescription] = useState("");

  // Intro content
  const [readingTitle, setReadingTitle] = useState("");
  const [readingText, setReadingText] = useState("");

  // New vocab form
  const [showVocabForm, setShowVocabForm] = useState(false);
  const [vocabWord, setVocabWord] = useState("");
  const [vocabPos, setVocabPos] = useState("noun");
  const [vocabDef, setVocabDef] = useState("");
  const [vocabExample, setVocabExample] = useState("");
  const [vocabIpa, setVocabIpa] = useState("");
  const [vocabStress, setVocabStress] = useState("");

  // New question form
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [qModuleType, setQModuleType] = useState("practice");
  const [qType, setQType] = useState("multiple_choice");
  const [qPrompt, setQPrompt] = useState("");
  const [qCorrectAnswer, setQCorrectAnswer] = useState("");
  const [qVocabId, setQVocabId] = useState("");
  const [qOptions, setQOptions] = useState([
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
  ]);

  // Expanded question sections
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  const [showRecreateModal, setShowRecreateModal] = useState(false);
  const [recreating, setRecreating] = useState(false);
  const [recreateError, setRecreateError] = useState("");
  const [recreateIntroDifficulty, setRecreateIntroDifficulty] = useState<
    "easy" | "medium" | "advanced"
  >("medium");
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    fetchSection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchSection() {
    setApiError("");
    try {
      const res = await fetch(`/api/admin/sections/${id}`);
      if (res.ok) {
        const data: SectionDetail = await res.json();
        setSection(data);
        setTitle(data.title);
        setTitleEs(data.titleEs);
        setDescription(data.description || "");
        const introModule = data.modules.find((m) => m.type === "introduction");
        if (introModule?.content) {
          const content = introModule.content as {
            readingTitle?: string;
            readingText?: string;
            readingDifficulty?: string;
          };
          setReadingTitle(content.readingTitle || "");
          setReadingText(content.readingText || "");
          const difficulty = String(content.readingDifficulty || "").toLowerCase();
          setRecreateIntroDifficulty(
            difficulty === "easy" || difficulty === "advanced"
              ? difficulty
              : "medium"
          );
        }
      } else {
        const message = await readApiError(
          res,
          res.status === 403 ? "You do not have access to this unit." : "Failed to load unit."
        );
        setApiError(message);
        setSection(null);
      }
    } catch {
      setApiError("Connection error. Please try again.");
      setSection(null);
    }
    setLoading(false);
  }

  async function readApiError(res: Response, fallback: string) {
    try {
      const data = (await res.json()) as { error?: unknown };
      if (typeof data.error === "string" && data.error.trim()) {
        return data.error;
      }
    } catch {
      // Ignore parse errors and use fallback.
    }
    return fallback;
  }

  async function saveSection() {
    setApiError("");
    setSaving(true);
    const res = await fetch(`/api/admin/sections/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, titleEs, description }),
    });
    if (!res.ok) {
      setApiError(await readApiError(res, "Failed to save unit."));
    }
    setSaving(false);
  }

  async function regenerateLogo() {
    setApiError("");
    setSaving(true);
    const res = await fetch(`/api/admin/sections/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, titleEs, description, regenerateImage: true }),
    });
    if (res.ok) {
      fetchSection();
    } else {
      setApiError(await readApiError(res, "Failed to regenerate logo."));
    }
    setSaving(false);
  }

  async function recreateUnit() {
    setRecreating(true);
    setRecreateError("");
    try {
      const res = await fetch(`/api/admin/sections/${id}/recreate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ introDifficulty: recreateIntroDifficulty }),
      });
      if (res.ok) {
        setShowRecreateModal(false);
        await fetchSection();
      } else {
        const data = (await res.json()) as { error?: string };
        setRecreateError(data.error || "Failed to recreate unit");
      }
    } catch {
      setRecreateError("Connection error. Please try again.");
    }
    setRecreating(false);
  }

  async function saveIntroContent() {
    const introModule = section?.modules.find((m) => m.type === "introduction");
    if (!introModule) return;
    setApiError("");
    setSaving(true);
    const res = await fetch(`/api/admin/modules/${introModule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { readingTitle, readingText },
      }),
    });
    if (!res.ok) {
      setApiError(await readApiError(res, "Failed to save introduction."));
    }
    setSaving(false);
  }

  async function addVocab(e: React.FormEvent) {
    e.preventDefault();
    setApiError("");
    const res = await fetch("/api/admin/vocabulary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sectionId: id,
        word: vocabWord,
        partOfSpeech: vocabPos,
        definitionEs: vocabDef,
        exampleSentence: vocabExample,
        phoneticIpa: vocabIpa,
        stressedSyllable: vocabStress,
      }),
    });
    if (res.ok) {
      setVocabWord("");
      setVocabDef("");
      setVocabExample("");
      setVocabIpa("");
      setVocabStress("");
      setShowVocabForm(false);
      fetchSection();
    } else {
      setApiError(await readApiError(res, "Failed to add vocabulary word."));
    }
  }

  async function deleteVocab(vocabId: string) {
    if (!confirm("Delete this vocabulary word?")) return;
    setApiError("");
    const res = await fetch(`/api/admin/vocabulary/${vocabId}`, { method: "DELETE" });
    if (res.ok) {
      fetchSection();
    } else {
      setApiError(await readApiError(res, "Failed to delete vocabulary word."));
    }
  }

  async function addQuestion(e: React.FormEvent) {
    e.preventDefault();
    const moduleObj = section?.modules.find((m) => m.type === qModuleType);
    if (!moduleObj) return;
    setApiError("");

    const body: Record<string, unknown> = {
      moduleId: moduleObj.id,
      type: qType,
      prompt: qPrompt,
      vocabularyId: qVocabId || null,
    };

    if (qType === "fill_blank") {
      body.correctAnswer = qCorrectAnswer;
    } else {
      body.options = qOptions.filter((o) => o.optionText.trim());
    }

    const res = await fetch("/api/admin/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setQPrompt("");
      setQCorrectAnswer("");
      setQVocabId("");
      setQOptions([
        { optionText: "", isCorrect: false },
        { optionText: "", isCorrect: false },
        { optionText: "", isCorrect: false },
        { optionText: "", isCorrect: false },
      ]);
      setShowQuestionForm(false);
      fetchSection();
    } else {
      setApiError(await readApiError(res, "Failed to add question."));
    }
  }

  async function deleteQuestion(questionId: string) {
    if (!confirm("Delete this question?")) return;
    setApiError("");
    const res = await fetch(`/api/admin/questions/${questionId}`, { method: "DELETE" });
    if (res.ok) {
      fetchSection();
    } else {
      setApiError(await readApiError(res, "Failed to delete question."));
    }
  }

  async function deleteSection() {
    if (!confirm("Delete this entire unit and all its content? This cannot be undone.")) return;
    setApiError("");
    const res = await fetch(`/api/admin/sections/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push(`/admin/areas/${section?.areaId}`);
    } else {
      setApiError(await readApiError(res, "Failed to delete unit."));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!section) {
    return <div className="p-4 text-center text-gray-500">Section not found</div>;
  }

  const tabs = [
    { key: "vocab" as const, label: "Vocabulary", icon: BookOpen },
    { key: "intro" as const, label: "Introduction", icon: BookOpen },
    { key: "questions" as const, label: "Questions", icon: ClipboardCheck },
  ];

  return (
    <div className="mx-auto max-w-md px-4 py-4 pb-32">
      <header className="mb-5 flex items-center gap-3">
        <button
          onClick={() => router.push(`/admin/areas/${section?.areaId}`)}
          className="rounded-xl p-2 text-slate-700 hover:bg-slate-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-3xl font-bold leading-tight tracking-tight text-slate-900">Edit Unit</h2>
      </header>

      <section className="mb-5 rounded-[28px] border border-slate-100 bg-white p-6 text-center shadow-sm">
        <div className="relative mx-auto w-fit">
          <div className="h-32 w-32 overflow-hidden rounded-2xl bg-primary-50 shadow-sm">
            {section.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={section.imageUrl}
                alt={section.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <LogoBadge
                  logo={null}
                  fallback={section.title.slice(0, 2)}
                  size="lg"
                  tone="primary"
                />
              </div>
            )}
          </div>
          <button
            onClick={regenerateLogo}
            disabled={saving}
            className="absolute -bottom-2 -right-2 rounded-full bg-primary-600 p-2.5 text-white shadow-md disabled:opacity-50"
            title="Regenerate image"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <h3 className="mt-4 text-2xl font-bold leading-tight text-slate-900">{section.title}</h3>
        <p className="text-base font-medium leading-tight text-primary-600">{section.titleEs}</p>
        <p className="text-sm text-slate-500">VocabPath Unit • {section.sectionVocabulary.length} Items</p>
      </section>

      <div className="mb-4 space-y-3">
        {apiError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {apiError}
          </div>
        )}
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-600">Unit Title</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Title (English)"
        />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-600">Subtitle</span>
        <input
          type="text"
          value={titleEs}
          onChange={(e) => setTitleEs(e.target.value)}
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Título (Spanish)"
        />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-600">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Description"
          rows={4}
        />
        </label>
      </div>

      <div className="mb-5 flex border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 border-b-[3px] py-3 text-[14px] font-bold transition-colors",
              activeTab === tab.key
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Vocabulary Tab */}
      {activeTab === "vocab" && (
        <div>
          <div className="space-y-3">
            {section.sectionVocabulary.map((sv) => (
              <div
                key={sv.id}
                className="bg-white border border-gray-200 rounded-xl p-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary-600">
                        {sv.vocabulary.word}
                      </span>
                      <span className="text-xs text-gray-400 italic">
                        {sv.vocabulary.partOfSpeech}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {sv.vocabulary.definitionEs}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 italic">
                      &ldquo;{sv.vocabulary.exampleSentence}&rdquo;
                    </p>
                    {sv.vocabulary.phoneticIpa && (
                      <p className="text-xs text-gray-400 mt-1">
                        IPA: {sv.vocabulary.phoneticIpa}
                        {sv.vocabulary.stressedSyllable &&
                          ` | Stress: ${sv.vocabulary.stressedSyllable}`}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteVocab(sv.vocabulary.id)}
                    className="p-1 text-gray-300 hover:text-danger-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {showVocabForm ? (
            <form
              onSubmit={addVocab}
              className="mt-4 bg-primary-50 border border-primary-200 rounded-xl p-4 space-y-3 animate-scale-in"
            >
              <h4 className="font-semibold text-sm">Add Vocabulary Word</h4>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Word"
                  value={vocabWord}
                  onChange={(e) => setVocabWord(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  required
                />
                <select
                  value={vocabPos}
                  onChange={(e) => setVocabPos(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="noun">noun</option>
                  <option value="verb">verb</option>
                  <option value="adjective">adjective</option>
                  <option value="adverb">adverb</option>
                  <option value="preposition">preposition</option>
                  <option value="conjunction">conjunction</option>
                </select>
              </div>
              <input
                type="text"
                placeholder="Definición en español"
                value={vocabDef}
                onChange={(e) => setVocabDef(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                required
              />
              <input
                type="text"
                placeholder="Example sentence"
                value={vocabExample}
                onChange={(e) => setVocabExample(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="IPA (e.g. /ɪmˈbɑːrk/)"
                  value={vocabIpa}
                  onChange={(e) => setVocabIpa(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Stressed syllable"
                  value={vocabStress}
                  onChange={(e) => setVocabStress(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700"
                >
                  Add Word
                </button>
                <button
                  type="button"
                  onClick={() => setShowVocabForm(false)}
                  className="px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowVocabForm(true)}
              className="mt-4 w-full bg-primary-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Vocabulary Word
            </button>
          )}
        </div>
      )}

      {/* Introduction Tab */}
      {activeTab === "intro" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Reading difficulty:</span>
            <ReadingDifficultyBadge
              difficulty={
                (
                  section.modules.find((m) => m.type === "introduction")
                    ?.content as { readingDifficulty?: string } | null
                )?.readingDifficulty
              }
            />
          </div>
          <p className="text-sm text-gray-500">
            Write the reading context that introduces vocabulary words in
            natural sentences. Bold vocabulary words by wrapping them in
            **double asterisks**.
          </p>
          <input
            type="text"
            value={readingTitle}
            onChange={(e) => setReadingTitle(e.target.value)}
            placeholder="Reading title (e.g. 'New Beginnings')"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
          <textarea
            value={readingText}
            onChange={(e) => setReadingText(e.target.value)}
            placeholder="Reading passage text... Use **word** to highlight vocabulary."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none min-h-[200px]"
            rows={8}
          />
          <button
            onClick={saveIntroContent}
            disabled={saving}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Introduction"}
          </button>
        </div>
      )}

      {/* Questions Tab */}
      {activeTab === "questions" && (
        <div>
          {["practice", "test"].map((moduleType) => {
            const mod = section.modules.find((m) => m.type === moduleType);
            if (!mod) return null;
            const isExpanded = expandedModule === moduleType;

            return (
              <div key={moduleType} className="mb-4">
                <button
                  onClick={() =>
                    setExpandedModule(isExpanded ? null : moduleType)
                  }
                  className="w-full flex items-center justify-between bg-gray-50 rounded-xl p-3 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {moduleType === "practice" ? (
                      <Dumbbell className="w-4 h-4 text-primary-600" />
                    ) : (
                      <ClipboardCheck className="w-4 h-4 text-success-500" />
                    )}
                    <span className="font-medium text-sm capitalize">
                      {moduleType}
                    </span>
                    <span className="text-xs text-gray-400">
                      ({mod.questions.length} questions)
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="mt-2 space-y-2 animate-fade-in">
                    {mod.questions.map((q) => (
                      <div
                        key={q.id}
                        className="bg-white border border-gray-200 rounded-lg p-3 text-sm"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded mb-1">
                              {q.type.replace("_", " ")}
                            </span>
                            <p className="font-medium text-gray-900">
                              {q.prompt}
                            </p>
                            {q.type !== "matching" && q.correctAnswer && (
                              <p className="text-xs text-success-500 mt-1">
                                Answer: {q.correctAnswer}
                              </p>
                            )}
                            {q.type === "matching" && (
                              <div className="mt-2 rounded-lg border border-primary-100 bg-primary-50/40 p-2">
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary-700">
                                  Matching Pairs (Solved Preview)
                                </p>
                                {renderSolvedMatchingPreview(
                                  q.id,
                                  parseMatchingPairs(q.correctAnswer)
                                )}
                              </div>
                            )}
                            {q.options.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {q.options.map((opt) => (
                                  <p
                                    key={opt.id}
                                    className={cn(
                                      "text-xs",
                                      opt.isCorrect
                                        ? "text-success-500 font-medium"
                                        : "text-gray-400"
                                    )}
                                  >
                                    {opt.isCorrect ? "✓" : "○"}{" "}
                                    {opt.optionText}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => deleteQuestion(q.id)}
                            className="p-1 text-gray-300 hover:text-danger-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add Question Form */}
          {showQuestionForm ? (
            <form
              onSubmit={addQuestion}
              className="bg-primary-50 border border-primary-200 rounded-xl p-4 space-y-3 animate-scale-in"
            >
              <h4 className="font-semibold text-sm">Add Question</h4>

              <div className="grid grid-cols-2 gap-3">
                <select
                  value={qModuleType}
                  onChange={(e) => setQModuleType(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="practice">Practice</option>
                  <option value="test">Test</option>
                </select>
                <select
                  value={qType}
                  onChange={(e) => setQType(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="fill_blank">Fill in the Blank</option>
                  <option value="phonetics">Phonetics</option>
                </select>
              </div>

              <select
                value={qVocabId}
                onChange={(e) => setQVocabId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
              >
                <option value="">Link to vocabulary (optional)</option>
                {section.sectionVocabulary.map((sv) => (
                  <option key={sv.vocabulary.id} value={sv.vocabulary.id}>
                    {sv.vocabulary.word}
                  </option>
                ))}
              </select>

              <textarea
                value={qPrompt}
                onChange={(e) => setQPrompt(e.target.value)}
                placeholder="Question prompt"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                rows={2}
                required
              />

              {qType === "fill_blank" ? (
                <input
                  type="text"
                  value={qCorrectAnswer}
                  onChange={(e) => setQCorrectAnswer(e.target.value)}
                  placeholder="Correct answer"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  required
                />
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">
                    Options (check the correct one):
                  </p>
                  {qOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correct-option"
                        checked={opt.isCorrect}
                        onChange={() => {
                          setQOptions(
                            qOptions.map((o, i) => ({
                              ...o,
                              isCorrect: i === idx,
                            }))
                          );
                        }}
                        className="accent-primary-600"
                      />
                      <input
                        type="text"
                        value={opt.optionText}
                        onChange={(e) => {
                          const newOpts = [...qOptions];
                          newOpts[idx].optionText = e.target.value;
                          setQOptions(newOpts);
                        }}
                        placeholder={`Option ${idx + 1}`}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700"
                >
                  Add Question
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuestionForm(false)}
                  className="px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowQuestionForm(true)}
              className="w-full bg-primary-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Question
            </button>
          )}
        </div>
      )}

      <div className="relative mt-6 overflow-hidden rounded-3xl bg-gradient-to-r from-primary-600 to-primary-700 p-5 text-white shadow-lg">
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-100">AI Assistant</p>
            <h4 className="mt-1 text-[30px] font-bold leading-tight tracking-tight">Smart Regenerate</h4>
            <p className="mt-1 text-[15px] text-primary-100">
              Use AI to refresh your modules with new context and examples.
            </p>
          </div>
          <button
            onClick={() => setShowRecreateModal(true)}
            className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-primary-700 shadow-sm"
          >
            <Sparkles className="h-4 w-4" />
            Start
          </button>
        </div>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-8 -top-12 h-28 w-32 rotate-12 rounded-3xl bg-white/10" />
          <div className="absolute right-6 top-2 h-16 w-20 rotate-12 rounded-2xl bg-white/5" />
          <span className="absolute right-5 top-4 text-sm font-bold text-white/70">✦</span>
          <span className="absolute right-12 top-10 text-xs font-bold text-white/55">✦</span>
          <span className="absolute right-8 bottom-7 text-[10px] font-bold text-white/45">✦</span>
          <div className="absolute -right-8 -bottom-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -left-6 -top-6 h-16 w-16 rounded-full bg-white/10 blur-xl" />
        </div>
      </div>

      <button
        onClick={deleteSection}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-red-200 py-4 text-base font-bold text-red-500 transition-colors hover:bg-red-50"
        title="Delete this unit"
      >
        <Trash2 className="h-4 w-4" />
        Delete Unit
      </button>

      <div className="fixed bottom-[88px] left-1/2 z-20 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 gap-3 rounded-2xl border border-slate-200 bg-white/90 p-3 backdrop-blur">
        <button
          onClick={saveSection}
          disabled={saving}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Draft"}
        </button>
        <button
          onClick={() => {
            setActiveTab("questions");
            setShowQuestionForm(true);
          }}
          className="flex h-12 flex-[1.3] items-center justify-center gap-2 rounded-xl bg-primary-600 text-sm font-bold text-white shadow-lg shadow-primary-300/40 transition hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Add Question
        </button>
      </div>

      {/* Recreate Unit Confirmation Modal */}
      {showRecreateModal && (
        <AppModal
          open={showRecreateModal}
          onClose={() => {
            if (recreating) return;
            setShowRecreateModal(false);
            setRecreateError("");
          }}
          maxWidthClassName="max-w-sm"
          showCloseButton={!recreating}
          closeLabel="Close smart regenerate modal"
        >
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-bold text-gray-900">Recreate Entire Unit?</h3>
            </div>

            <p className="text-sm text-gray-600 mb-1">
              This will regenerate the full unit with current AI logic: vocabulary, intro reading, practice questions, and test questions.
            </p>
            <p className="text-xs text-red-600 mb-4">
              Existing learner attempts/progress for this unit will be reset. This action is intended for content migrations and cannot be undone.
            </p>

            <label className="mb-4 block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Intro text difficulty
              </span>
              <select
                value={recreateIntroDifficulty}
                onChange={(e) =>
                  setRecreateIntroDifficulty(
                    e.target.value as "easy" | "medium" | "advanced"
                  )
                }
                disabled={recreating}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>

            {recreateError && (
              <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-xs mb-3">
                {recreateError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={recreateUnit}
                disabled={recreating}
                className={cn(
                  modalActionButtonClass.danger,
                  "flex flex-1 items-center justify-center gap-2"
                )}
              >
                {recreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Recreating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Recreate Unit
                  </>
                )}
              </button>
              {!recreating && (
                <button
                  onClick={() => {
                    setShowRecreateModal(false);
                    setRecreateError("");
                  }}
                  className={modalActionButtonClass.secondary}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </AppModal>
      )}
    </div>
  );
}
