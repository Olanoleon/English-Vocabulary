"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  GripVertical,
  Pencil,
  Eye,
  EyeOff,
  BookOpen,
  Sparkles,
  Loader2,
  RefreshCw,
  Trash2,
  X,
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

interface Area {
  id: string;
  name: string;
  nameEs: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
}

interface Section {
  id: string;
  title: string;
  titleEs: string;
  sortOrder: number;
  isActive: boolean;
  imageUrl: string | null;
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

      {/* Unit Emoji or Number */}
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary-100 text-xl">
        {section.imageUrl || String(index + 1).padStart(2, "0")}
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
        title="Edit"
      >
        <Pencil className="w-4 h-4" />
      </Link>
      <Link
        href={`/admin/preview/${section.id}`}
        className="p-1.5 text-gray-400 hover:text-purple-600 rounded-lg hover:bg-purple-50 transition-colors flex items-center gap-1"
        title="Preview"
      >
        <Eye className="w-4 h-4" />
      </Link>
    </div>
  );
}

// ─── Drag Overlay Card ─────────────────────────────────────────────────────────

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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AreaUnitsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: areaId } = use(params);
  const router = useRouter();
  const [area, setArea] = useState<Area | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [apiError, setApiError] = useState("");
  const [editName, setEditName] = useState("");
  const [editNameEs, setEditNameEs] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [showEditAreaModal, setShowEditAreaModal] = useState(false);
  const [savingArea, setSavingArea] = useState(false);
  const [showDeleteAreaModal, setShowDeleteAreaModal] = useState(false);
  const [deletingArea, setDeletingArea] = useState(false);

  // AI generation form
  const [topic, setTopic] = useState("");
  const [wordCount, setWordCount] = useState("5");
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState("");
  const [genError, setGenError] = useState("");

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 6 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId]);

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

  async function fetchData() {
    setApiError("");
    const [areaRes, sectionsRes] = await Promise.all([
      fetch(`/api/admin/areas/${areaId}`),
      fetch(`/api/admin/sections?areaId=${areaId}`),
    ]);

    if (areaRes.ok) {
      const areaData = (await areaRes.json()) as Area;
      setArea(areaData);
      setEditName(areaData.name);
      setEditNameEs(areaData.nameEs);
      setEditDesc(areaData.description || "");
    } else {
      setArea(null);
      setApiError(
        await readApiError(
          areaRes,
          areaRes.status === 403
            ? "You do not have access to this area."
            : "Failed to load area."
        )
      );
    }

    if (sectionsRes.ok) {
      setSections(await sectionsRes.json());
    } else {
      setSections([]);
      setApiError(await readApiError(sectionsRes, "Failed to load area units."));
    }
    setLoading(false);
  }

  async function persistOrder(newSections: Section[]) {
    setApiError("");
    const res = await fetch("/api/admin/sections/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: newSections.map((s) => s.id) }),
    });
    if (!res.ok) {
      setApiError(await readApiError(res, "Failed to save unit order."));
      await fetchData();
    }
  }

  async function saveAreaEdits(e: React.FormEvent) {
    e.preventDefault();
    if (!area) return;
    setSavingArea(true);
    setApiError("");
    const res = await fetch(`/api/admin/areas/${area.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        nameEs: editNameEs,
        description: editDesc || null,
        isActive: area.isActive,
      }),
    });

    if (res.ok) {
      setShowEditAreaModal(false);
      await fetchData();
    } else {
      setApiError(await readApiError(res, "Failed to update area."));
    }
    setSavingArea(false);
  }

  async function regenerateAreaLogo() {
    if (!area) return;
    setSavingArea(true);
    setApiError("");
    const res = await fetch(`/api/admin/areas/${area.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        nameEs: editNameEs,
        description: editDesc || null,
        isActive: area.isActive,
        regenerateImage: true,
      }),
    });

    if (res.ok) {
      setShowEditAreaModal(false);
      await fetchData();
    } else {
      setApiError(await readApiError(res, "Failed to regenerate area logo."));
    }
    setSavingArea(false);
  }

  async function toggleAreaVisibility() {
    if (!area) return;
    setApiError("");
    const res = await fetch(`/api/admin/areas/${area.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: area.name,
        nameEs: area.nameEs,
        description: area.description,
        isActive: !area.isActive,
      }),
    });
    if (res.ok) {
      await fetchData();
    } else {
      setApiError(await readApiError(res, "Failed to update area visibility."));
    }
  }

  async function deleteArea() {
    if (!area) return;
    setDeletingArea(true);
    setApiError("");
    const res = await fetch(`/api/admin/areas/${area.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin");
    } else {
      setApiError(await readApiError(res, "Failed to delete area."));
    }
    setDeletingArea(false);
  }

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
    setApiError("");
    setGenProgress("Sending topic to AI...");

    try {
      setTimeout(() => {
        if (generating)
          setGenProgress("AI is crafting vocabulary and questions...");
      }, 2000);
      setTimeout(() => {
        if (generating)
          setGenProgress("Almost done — saving to database...");
      }, 8000);

      const res = await fetch("/api/admin/sections/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          wordCount: parseInt(wordCount, 10) || 5,
          areaId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setGenError(data.error || "Generation failed. Please try again.");
        setGenerating(false);
        setGenProgress("");
        return;
      }

      setTopic("");
      setWordCount("5");
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

  if (!area) {
    return (
      <div className="p-4 text-center text-gray-500">Area not found.</div>
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
        <button
          onClick={() => router.push("/admin")}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          All Areas
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0 text-2xl">
            {area.imageUrl || "📘"}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{area.name}</h2>
            <p className="text-sm text-gray-500">{area.nameEs}</p>
          </div>
        </div>
      </div>
      {apiError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {apiError}
        </div>
      )}

      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Area Settings
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleAreaVisibility}
            className={cn(
              "inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold border",
              area.isActive
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-gray-50 border-gray-200 text-gray-600"
            )}
          >
            {area.isActive ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                Visible
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                Hidden
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowEditAreaModal(true)}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteAreaModal(true)}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
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
            a reading passage, practice questions, a full test, and a logo — all
            ready for you to review and edit.
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
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={wordCount}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setWordCount(raw);
                }}
                onBlur={() => {
                  let v = parseInt(wordCount, 10);
                  if (isNaN(v) || v < 1) v = 1;
                  if (v > 20) v = 20;
                  setWordCount(String(v));
                }}
                className="w-16 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white [appearance:textfield]"
                disabled={generating}
              />
              <p className="text-[10px] text-gray-400 mt-1">
                This will generate{" "}
                {Math.min((parseInt(wordCount, 10) || 0) * 2, 20)} practice
                and{" "}
                {Math.min(
                  20,
                  Math.max(
                    10,
                    Math.round(
                      10 +
                        (((parseInt(wordCount, 10) || 0) - 5) / 15) * 10
                    )
                  )
                )}{" "}
                test questions
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

      {showEditAreaModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={saveAreaEdits}
            className="bg-white rounded-2xl p-6 w-full max-w-sm animate-scale-in"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Edit Area</h3>
              <button
                type="button"
                onClick={() => setShowEditAreaModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Name (English)
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Name (Spanish)
                </label>
                <input
                  type="text"
                  value={editNameEs}
                  onChange={(e) => setEditNameEs(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="submit"
                disabled={savingArea}
                className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
              >
                {savingArea ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={regenerateAreaLogo}
                disabled={savingArea}
                className="flex items-center gap-1 px-3 py-2 text-gray-600 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                title="Regenerate logo based on current name"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowEditAreaModal(false)}
                className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showDeleteAreaModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-scale-in">
            <h3 className="font-bold text-gray-900 mb-2">Delete Area</h3>
            <p className="text-sm text-gray-600 mb-1">
              Are you sure you want to delete <span className="font-semibold">{area.name}</span>?
            </p>
            <p className="text-xs text-red-500 mb-4">
              This will permanently delete this area and all units inside it.
            </p>
            <div className="flex gap-2">
              <button
                onClick={deleteArea}
                disabled={deletingArea}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {deletingArea ? "Deleting..." : "Delete Area"}
              </button>
              <button
                onClick={() => setShowDeleteAreaModal(false)}
                disabled={deletingArea}
                className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
