"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Eye,
  X,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Area {
  id: string;
  name: string;
  nameEs: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  _count: { sections: number };
}

export default function AdminAreasPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createProgress, setCreateProgress] = useState("");
  const [createError, setCreateError] = useState("");

  // Create form
  const [name, setName] = useState("");

  // Edit modal
  const [editArea, setEditArea] = useState<Area | null>(null);
  const [editName, setEditName] = useState("");
  const [editNameEs, setEditNameEs] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

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

  async function handleDelete(areaId: string) {
    if (!confirm("Delete this area and all its units? This cannot be undone."))
      return;

    await fetch(`/api/admin/areas/${areaId}`, { method: "DELETE" });
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

      {/* Area Cards */}
      <div className="space-y-3 mb-4">
        {areas.map((area) => (
          <div
            key={area.id}
            className={cn(
              "bg-white border rounded-xl p-4 transition-all",
              area.isActive ? "border-gray-200" : "border-gray-100 opacity-60"
            )}
          >
            <div className="flex items-center gap-3">
              {/* Emoji Icon */}
              <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0 text-2xl">
                {area.imageUrl || "📘"}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">
                  {area.name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {area.nameEs} &middot; {area._count.sections}{" "}
                  {area._count.sections === 1 ? "unit" : "units"}
                </p>
              </div>

              {/* Actions */}
              <button
                onClick={() => openEdit(area)}
                className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
                title="Edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(area.id)}
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
        ))}
      </div>

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
                onClick={() => setEditArea(null)}
                className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
