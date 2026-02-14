"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  X,
  BookOpen,
  RefreshCw,
  GripVertical,
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
  _count: { sections: number };
}

// ─── Sortable Area Card ────────────────────────────────────────────────────────

function SortableAreaCard({
  area,
  onToggleVisibility,
  onEdit,
  onDelete,
}: {
  area: Area;
  onToggleVisibility: (area: Area) => void;
  onEdit: (area: Area) => void;
  onDelete: (area: Area) => void;
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
        "bg-white border rounded-xl p-4 transition-all",
        area.isActive ? "border-gray-200" : "border-gray-100 opacity-60",
        isDragging && "opacity-40 shadow-lg scale-[1.02]"
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
          <GripVertical className="w-5 h-5" />
        </button>

        {/* Emoji Icon */}
        <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0 text-2xl">
          {area.imageUrl || "📘"}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{area.name}</p>
          <p className="text-xs text-gray-500 truncate">
            {area.nameEs} &middot; {area._count.sections}{" "}
            {area._count.sections === 1 ? "unit" : "units"}
          </p>
        </div>

        {/* Actions */}
        <button
          onClick={() => onToggleVisibility(area)}
          className={cn(
            "p-2 rounded-lg transition-colors",
            area.isActive
              ? "text-green-500 hover:text-green-700 hover:bg-green-50"
              : "text-gray-300 hover:text-gray-500 hover:bg-gray-100"
          )}
          title={area.isActive ? "Visible to learners — click to hide" : "Hidden from learners — click to show"}
        >
          {area.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
        <button
          onClick={() => onEdit(area)}
          className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
          title="Edit"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(area)}
          className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <Link
          href={`/admin/areas/${area.id}`}
          className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-xs font-semibold hover:bg-primary-100 transition-colors flex items-center gap-1"
        >
          <Eye className="w-3.5 h-3.5" />
          See Area
        </Link>
      </div>

      {area.description && (
        <p className="text-xs text-gray-400 mt-2 ml-15 truncate">
          {area.description}
        </p>
      )}
    </div>
  );
}

// ─── Drag Overlay Card ─────────────────────────────────────────────────────────

function AreaDragOverlayCard({ area }: { area: Area }) {
  return (
    <div className="bg-white border-2 border-primary-400 rounded-xl p-4 shadow-xl rotate-1 scale-[1.03]">
      <div className="flex items-center gap-3">
        <div className="p-1 -ml-1 text-primary-500">
          <GripVertical className="w-5 h-5" />
        </div>
        <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0 text-2xl">
          {area.imageUrl || "📘"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{area.name}</p>
          <p className="text-xs text-gray-500 truncate">
            {area.nameEs} &middot; {area._count.sections}{" "}
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
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createProgress, setCreateProgress] = useState("");
  const [createError, setCreateError] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  // Create form
  const [name, setName] = useState("");

  // Delete confirmation
  const [deleteArea, setDeleteArea] = useState<Area | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit modal
  const [editArea, setEditArea] = useState<Area | null>(null);
  const [editName, setEditName] = useState("");
  const [editNameEs, setEditNameEs] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 6 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  useEffect(() => {
    fetchAreas();
  }, []);

  async function fetchAreas() {
    const res = await fetch("/api/admin/areas");
    if (res.ok) {
      setAreas(await res.json());
    }
    setLoading(false);
  }

  const persistOrder = useCallback(async (newAreas: Area[]) => {
    await fetch("/api/admin/areas/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: newAreas.map((a) => a.id) }),
    });
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

  function openEdit(area: Area) {
    setEditArea(area);
    setEditName(area.name);
    setEditNameEs(area.nameEs);
    setEditDesc(area.description || "");
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editArea) return;
    setSaving(true);

    const res = await fetch(`/api/admin/areas/${editArea.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        nameEs: editNameEs,
        description: editDesc || null,
        isActive: editArea.isActive,
      }),
    });

    if (res.ok) {
      setEditArea(null);
      fetchAreas();
    }
    setSaving(false);
  }

  async function regenerateAreaLogo() {
    if (!editArea) return;
    setSaving(true);
    const res = await fetch(`/api/admin/areas/${editArea.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        nameEs: editNameEs,
        description: editDesc || null,
        isActive: editArea.isActive,
        regenerateImage: true,
      }),
    });
    if (res.ok) {
      setEditArea(null);
      fetchAreas();
    }
    setSaving(false);
  }

  async function toggleVisibility(area: Area) {
    await fetch(`/api/admin/areas/${area.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: area.name,
        nameEs: area.nameEs,
        description: area.description,
        isActive: !area.isActive,
      }),
    });
    fetchAreas();
  }

  async function handleDelete() {
    if (!deleteArea) return;
    setDeleting(true);
    await fetch(`/api/admin/areas/${deleteArea.id}`, { method: "DELETE" });
    setDeleteArea(null);
    setDeleting(false);
    fetchAreas();
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
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Areas of Knowledge
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Organize vocabulary units by subject area
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-primary-50 rounded-xl p-4">
          <p className="text-xs font-medium text-primary-600 uppercase">
            Active Areas
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {areas.filter((a) => a.isActive).length}
          </p>
        </div>
        <div className="bg-primary-50 rounded-xl p-4">
          <p className="text-xs font-medium text-primary-600 uppercase">
            Total Units
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {areas.reduce((sum, a) => sum + a._count.sections, 0)}
          </p>
        </div>
      </div>

      {/* Area Cards Header */}
      {areas.length > 1 && (
        <div className="mb-2 flex items-center justify-end">
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
                onToggleVisibility={toggleVisibility}
                onEdit={openEdit}
                onDelete={setDeleteArea}
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
          className="mt-4 w-full bg-gradient-to-r from-purple-600 to-primary-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:from-purple-700 hover:to-primary-700 transition-all"
        >
          <Plus className="w-5 h-5" />
          Create New Area
        </button>
      )}

      {/* Edit Modal */}
      {editArea && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleEdit}
            className="bg-white rounded-2xl p-6 w-full max-w-sm animate-scale-in"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Edit Area</h3>
              <button
                type="button"
                onClick={() => setEditArea(null)}
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
                disabled={saving}
                className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={regenerateAreaLogo}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-2 text-gray-600 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                title="Regenerate logo based on current name"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setEditArea(null)}
                className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteArea && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-bold text-gray-900">Delete Area</h3>
            </div>

            <p className="text-sm text-gray-600 mb-1">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{deleteArea.name}</span>?
            </p>
            <p className="text-xs text-red-500 mb-4">
              This will permanently delete the area and all{" "}
              {deleteArea._count.sections}{" "}
              {deleteArea._count.sections === 1 ? "unit" : "units"} inside it.
              This action cannot be undone.
            </p>

            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Deleting..." : "Delete Area"}
              </button>
              <button
                onClick={() => setDeleteArea(null)}
                disabled={deleting}
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
