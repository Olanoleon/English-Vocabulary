"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GripVertical,
  ChevronRight,
  Pencil,
  BookOpen,
  Sparkles,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Section {
  id: string;
  title: string;
  titleEs: string;
  sortOrder: number;
  isActive: boolean;
  _count: { sectionVocabulary: number };
}

// ─── Sortable Section Card ───────────────────────────────────────────────────

function SortableSectionCard({
  section,
  index,
}: {
  section: Section;
  index: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-white border rounded-xl p-4 flex items-center gap-3",
        section.isActive ? "border-gray-200" : "border-gray-100 opacity-60",
        isDragging && "opacity-40 shadow-lg scale-[1.02]"
      )}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="touch-none p-1 -ml-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing rounded-md hover:bg-gray-50 transition-colors"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-5 h-5" />
      </button>

      {/* Unit Number */}
      <div className="bg-primary-100 text-primary-700 rounded-lg w-10 h-10 flex items-center justify-center text-sm font-bold flex-shrink-0">
        {String(index + 1).padStart(2, "0")}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{section.title}</p>
        <p className="text-xs text-gray-500 truncate">
          {section.titleEs} &middot; {section._count.sectionVocabulary} Terms
        </p>
      </div>

      {/* Actions */}
      <Link
        href={`/admin/sections/${section.id}`}
        className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
      >
        <Pencil className="w-4 h-4" />
      </Link>
      <Link
        href={`/admin/sections/${section.id}`}
        className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

// ─── Drag Overlay Card (floating preview while dragging) ─────────────────────

function DragOverlayCard({
  section,
  index,
}: {
  section: Section;
  index: number;
}) {
  return (
    <div className="bg-white border-2 border-primary-400 rounded-xl p-4 flex items-center gap-3 shadow-xl rotate-1 scale-[1.03]">
      <div className="p-1 -ml-1 text-primary-500">
        <GripVertical className="w-5 h-5" />
      </div>
      <div className="bg-primary-100 text-primary-700 rounded-lg w-10 h-10 flex items-center justify-center text-sm font-bold flex-shrink-0">
        {String(index + 1).padStart(2, "0")}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{section.title}</p>
        <p className="text-xs text-gray-500 truncate">
          {section.titleEs} &middot; {section._count.sectionVocabulary} Terms
        </p>
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter();
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // AI generation form
  const [topic, setTopic] = useState("");
  const [wordCount, setWordCount] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState("");
  const [genError, setGenError] = useState("");

  // Sensors with activation distance so taps/clicks still work
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 6 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  useEffect(() => {
    fetchSections();
  }, []);

  async function fetchSections() {
    const res = await fetch("/api/admin/sections");
    if (res.ok) {
      setSections(await res.json());
    }
    setLoading(false);
  }

  const persistOrder = useCallback(async (newSections: Section[]) => {
    await fetch("/api/admin/sections/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: newSections.map((s) => s.id) }),
    });
  }, []);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(sections, oldIndex, newIndex);
    setSections(reordered);
    persistOrder(reordered);
  }

  async function generateSection(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setGenError("");
    setGenProgress("Sending topic to AI...");

    try {
      setTimeout(() => {
        if (generating) setGenProgress("AI is crafting vocabulary and questions...");
      }, 2000);
      setTimeout(() => {
        if (generating) setGenProgress("Almost done — saving to database...");
      }, 8000);

      const res = await fetch("/api/admin/sections/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, wordCount }),
      });

      const data = await res.json();

      if (!res.ok) {
        setGenError(data.error || "Generation failed. Please try again.");
        setGenerating(false);
        setGenProgress("");
        return;
      }

      setTopic("");
      setWordCount(5);
      setShowCreate(false);
      setGenProgress("");
      router.push(`/admin/sections/${data.sectionId}`);
    } catch {
      setGenError("Connection error. Please try again.");
      setGenerating(false);
      setGenProgress("");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const activeSection = activeId
    ? sections.find((s) => s.id === activeId)
    : null;
  const activeIndex = activeId
    ? sections.findIndex((s) => s.id === activeId)
    : -1;

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Unit Management</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage vocabulary sections and content
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-primary-50 rounded-xl p-4">
          <p className="text-xs font-medium text-primary-600 uppercase">
            Active Units
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {sections.filter((s) => s.isActive).length}
          </p>
        </div>
        <div className="bg-primary-50 rounded-xl p-4">
          <p className="text-xs font-medium text-primary-600 uppercase">
            Total Terms
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {sections.reduce((sum, s) => sum + s._count.sectionVocabulary, 0)}
          </p>
        </div>
      </div>

      {/* Sections List */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Curriculum Units</h3>
        {sections.length > 1 && (
          <span className="text-[10px] text-gray-400 uppercase tracking-wider">
            Drag to reorder
          </span>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sections.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {sections.map((section, index) => (
              <SortableSectionCard
                key={section.id}
                section={section}
                index={index}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={null}>
          {activeSection ? (
            <DragOverlayCard section={activeSection} index={activeIndex} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* AI Generate Section */}
      {showCreate ? (
        <form
          onSubmit={generateSection}
          className="mt-4 border border-purple-200 rounded-xl p-4 bg-gradient-to-br from-purple-50 to-primary-50 animate-scale-in"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h4 className="font-semibold text-gray-900">
              Generate New Unit with AI
            </h4>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Enter a topic and the number of words. AI will generate vocabulary,
            a reading passage, practice questions, and a full test — all ready
            for you to review and edit.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Topic
              </label>
              <input
                type="text"
                placeholder='e.g. "At the Airport", "Job Interview", "Cooking"'
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                required
                disabled={generating}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Number of vocabulary words
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={3}
                  max={15}
                  value={wordCount}
                  onChange={(e) => setWordCount(Number(e.target.value))}
                  className="flex-1 accent-purple-600"
                  disabled={generating}
                />
                <span className="text-lg font-bold text-purple-600 w-8 text-center">
                  {wordCount}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">
                This will generate ~{wordCount * 2} practice questions and ~
                {Math.ceil(wordCount * 1.5)} test questions (including phonetics)
              </p>
            </div>

            {genError && (
              <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-xs animate-scale-in">
                {genError}
              </div>
            )}

            {generating && genProgress && (
              <div className="bg-purple-100 text-purple-700 px-3 py-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in">
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                <span>{genProgress}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={generating}
                className="flex-1 bg-purple-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate with AI
                  </>
                )}
              </button>
              {!generating && (
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setGenError("");
                  }}
                  className="px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="mt-4 w-full bg-gradient-to-r from-purple-600 to-primary-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:from-purple-700 hover:to-primary-700 transition-all"
        >
          <Sparkles className="w-5 h-5" />
          Generate New Unit with AI
        </button>
      )}

      {sections.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No units yet. Generate your first one!</p>
        </div>
      )}
    </div>
  );
}
