"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  BookOpen,
  Dumbbell,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

interface Module {
  id: string;
  type: string;
  content: { readingTitle?: string; readingText?: string } | null;
  questions: Question[];
  _count: { questions: number };
}

interface SectionDetail {
  id: string;
  title: string;
  titleEs: string;
  description: string;
  isActive: boolean;
  modules: Module[];
  sectionVocabulary: { id: string; vocabulary: Vocabulary }[];
}

export default function SectionEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  useEffect(() => {
    fetchSection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchSection() {
    const res = await fetch(`/api/admin/sections/${id}`);
    if (res.ok) {
      const data: SectionDetail = await res.json();
      setSection(data);
      setTitle(data.title);
      setTitleEs(data.titleEs);
      setDescription(data.description || "");
      const introModule = data.modules.find((m) => m.type === "introduction");
      if (introModule?.content) {
        const content = introModule.content as { readingTitle?: string; readingText?: string };
        setReadingTitle(content.readingTitle || "");
        setReadingText(content.readingText || "");
      }
    }
    setLoading(false);
  }

  async function saveSection() {
    setSaving(true);
    await fetch(`/api/admin/sections/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, titleEs, description }),
    });
    setSaving(false);
  }

  async function saveIntroContent() {
    const introModule = section?.modules.find((m) => m.type === "introduction");
    if (!introModule) return;
    setSaving(true);
    await fetch(`/api/admin/modules/${introModule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { readingTitle, readingText },
      }),
    });
    setSaving(false);
  }

  async function addVocab(e: React.FormEvent) {
    e.preventDefault();
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
    }
  }

  async function deleteVocab(vocabId: string) {
    if (!confirm("Delete this vocabulary word?")) return;
    await fetch(`/api/admin/vocabulary/${vocabId}`, { method: "DELETE" });
    fetchSection();
  }

  async function addQuestion(e: React.FormEvent) {
    e.preventDefault();
    const moduleObj = section?.modules.find((m) => m.type === qModuleType);
    if (!moduleObj) return;

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
    }
  }

  async function deleteQuestion(questionId: string) {
    if (!confirm("Delete this question?")) return;
    await fetch(`/api/admin/questions/${questionId}`, { method: "DELETE" });
    fetchSection();
  }

  async function deleteSection() {
    if (!confirm("Delete this entire unit and all its content? This cannot be undone.")) return;
    await fetch(`/api/admin/sections/${id}`, { method: "DELETE" });
    router.push("/admin");
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
    <div className="px-4 py-4">
      {/* Back + Title */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => router.push("/admin")}
          className="p-2 -ml-2 text-gray-400 hover:text-gray-600 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900">{section.title}</h2>
          <p className="text-xs text-gray-500">{section.titleEs}</p>
        </div>
      </div>

      {/* Section Details */}
      <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
          placeholder="Title (English)"
        />
        <input
          type="text"
          value={titleEs}
          onChange={(e) => setTitleEs(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
          placeholder="Título (Spanish)"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
          placeholder="Description"
          rows={2}
        />
        <div className="flex gap-2">
          <button
            onClick={saveSection}
            disabled={saving}
            className="flex items-center gap-1 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={deleteSection}
            className="flex items-center gap-1 bg-white text-danger-500 border border-danger-500 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete Unit
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.key
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-gray-400 hover:text-gray-600"
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
                            {q.correctAnswer && (
                              <p className="text-xs text-success-500 mt-1">
                                Answer: {q.correctAnswer}
                              </p>
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
    </div>
  );
}
