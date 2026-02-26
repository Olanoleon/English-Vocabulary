"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Loader2,
  BookOpen,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoBadge } from "@/components/logo-badge";
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
  _count: { sections: number };
}

// ─── Sortable Area Card ────────────────────────────────────────────────────────

function SortableAreaCard({
  area,
}: {
  area: Area;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: area.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-white border rounded-2xl p-4 transition-all",
        area.isActive ? "border-gray-100 shadow-sm" : "border-gray-100 opacity-60",
        isDragging && "opacity-40 shadow-xl scale-[1.02]"
      )}
    >
      <div className="flex items-center gap-3">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="touch-none p-1 -ml-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing rounded-md hover:bg-gray-50 transition-colors"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Area Logo */}
        <LogoBadge logo={area.imageUrl} size="md" tone="primary" />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{area.name}</p>
          {area.description && (
            <p className="text-xs text-gray-500 truncate">{area.description}</p>
          )}
          <p className="text-xs text-primary-700 truncate mt-0.5">
            {area.nameEs} · {area._count.sections}{" "}
            {area._count.sections === 1 ? "unit" : "units"}
          </p>
        </div>

        <Link
          href={`/admin/areas/${area.id}`}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-semibold transition-colors",
            area.isActive
              ? "bg-primary-600 text-white hover:bg-primary-700"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          )}
        >
          Manage
        </Link>
      </div>
    </div>
  );
}

// ─── Drag Overlay Card ─────────────────────────────────────────────────────────

function AreaDragOverlayCard({ area }: { area: Area }) {
  return (
    <div className="bg-white border-2 border-primary-300 rounded-2xl p-4 shadow-xl rotate-1 scale-[1.03]">
      <div className="flex items-center gap-3">
        <div className="p-1 -ml-1 text-primary-500">
          <GripVertical className="w-4 h-4" />
        </div>
        <LogoBadge logo={area.imageUrl} size="md" tone="primary" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{area.name}</p>
          <p className="text-xs text-primary-700 truncate">
            {area.nameEs} · {area._count.sections}{" "}
            {area._count.sections === 1 ? "unit" : "units"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminAreasPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createProgress, setCreateProgress] = useState("");
  const [createError, setCreateError] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  // Create form
  const [name, setName] = useState("");

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 6 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

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

  async function fetchAreas() {
    setApiError("");
    try {
      const res = await fetch("/api/admin/areas");
      if (res.ok) {
        setAreas(await res.json());
      } else {
        setAreas([]);
        setApiError(
          await readApiError(
            res,
            res.status === 403
              ? "You do not have access to areas."
              : "Failed to load areas."
          )
        );
      }
    } catch {
      setAreas([]);
      setApiError("Connection error. Please try again.");
    }
    setLoading(false);
  }

  async function persistOrder(newAreas: Area[]) {
    setApiError("");
    const res = await fetch("/api/admin/areas/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: newAreas.map((a) => a.id) }),
    });
    if (!res.ok) {
      setApiError(await readApiError(res, "Failed to save area order."));
      await fetchAreas();
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchAreas();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = areas.findIndex((a) => a.id === active.id);
    const newIndex = areas.findIndex((a) => a.id === over.id);
    const reordered = arrayMove(areas, oldIndex, newIndex);
    setAreas(reordered);
    persistOrder(reordered);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    setApiError("");
    setCreateProgress("Creating area...");

    try {
      const res = await fetch("/api/admin/areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const data = await res.json();
        setCreateError(data.error || "Failed to create area");
        setCreating(false);
        setCreateProgress("");
        return;
      }

      setName("");
      setShowCreate(false);
      setCreateProgress("");
      setCreating(false);
      fetchAreas();
    } catch {
      setCreateError("Connection error. Please try again.");
      setCreating(false);
      setCreateProgress("");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900">
          Areas of Knowledge
        </h2>
        <div className="mt-2 inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
          {areas.length} {areas.length === 1 ? "Area" : "Areas"} Total
        </div>
      </div>
      {apiError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {apiError}
        </div>
      )}

      {/* Area Cards Header */}
      {areas.length > 1 && (
        <div className="mb-2 mt-4 flex items-center justify-end">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider">
            Drag to reorder
          </span>
        </div>
      )}

      {/* Area Cards (sortable) */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={areas.map((a) => a.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3 mb-4">
            {areas.map((area) => (
              <SortableAreaCard
                key={area.id}
                area={area}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={null}>
          {activeId ? (
            <AreaDragOverlayCard
              area={areas.find((a) => a.id === activeId)!}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {areas.length === 0 && !showCreate && (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            No areas yet. Create your first one!
          </p>
        </div>
      )}

      {/* Create Form */}
      {showCreate ? (
        <form
          onSubmit={handleCreate}
          className="mt-4 border border-purple-200 rounded-xl p-4 bg-gradient-to-br from-purple-50 to-primary-50 animate-scale-in"
        >
          <div className="flex items-center gap-2 mb-3">
            <Plus className="w-5 h-5 text-purple-600" />
            <h4 className="font-semibold text-gray-900">
              Create New Area of Knowledge
            </h4>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Just enter the name — the Spanish translation, description, and
            icon are generated automatically.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Area Name
              </label>
              <input
                type="text"
                placeholder='e.g. "Engineering", "Healthcare", "Business"'
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                required
                disabled={creating}
              />
            </div>

            {createError && (
              <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-xs animate-scale-in">
                {createError}
              </div>
            )}

            {creating && createProgress && (
              <div className="bg-purple-100 text-purple-700 px-3 py-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in">
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                <span>{createProgress}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="flex-1 bg-purple-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Area
                  </>
                )}
              </button>
              {!creating && (
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setCreateError("");
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
          className="mt-4 w-full bg-gradient-to-r from-purple-600 to-primary-600 text-white py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:from-purple-700 hover:to-primary-700 transition-all"
        >
          <Plus className="w-5 h-5" />
          Create New Area
        </button>
      )}

    </div>
  );
}
