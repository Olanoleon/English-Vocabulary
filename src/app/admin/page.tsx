"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  BookOpen,
  Search,
  RefreshCw,
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
  replicationPending?: boolean;
  scopeType?: "global" | "org";
  organizationId?: string | null;
  sourceTemplateId?: string | null;
  isCustomized?: boolean;
}

interface Organization {
  id: string;
  name: string;
}

// ─── Sortable Area Card ────────────────────────────────────────────────────────

function SortableAreaCard({
  area,
  regenerating,
  onRegenerate,
  orgContextId,
  canEdit,
}: {
  area: Area;
  regenerating: boolean;
  onRegenerate: (area: Area) => void;
  orgContextId: string | null;
  canEdit: boolean;
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
  const href = orgContextId
    ? `/admin/areas/${area.id}?organizationId=${encodeURIComponent(orgContextId)}`
    : `/admin/areas/${area.id}`;
  const ownerLabel =
    area.scopeType === "org"
      ? area.sourceTemplateId
        ? "Org template copy"
        : "Org custom"
      : "Global template";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex items-center gap-2 transition-all", isDragging && "opacity-40 scale-[1.02]")}
    >
      <div
        {...attributes}
        {...listeners}
        className={cn(
          "flex-1 cursor-grab touch-none overflow-hidden rounded-[28px] border bg-white p-4 active:cursor-grabbing",
          area.isActive ? "border-slate-100 shadow-sm" : "border-slate-100 opacity-60"
        )}
      >
        <div className="flex min-w-0 items-stretch justify-between gap-4">
          <div className="flex min-w-0 flex-[2_2_0px] flex-col justify-between py-1">
            <div>
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[20px] font-bold leading-[1.2] tracking-tight text-slate-900">
                  {area.name}
                </p>
              </div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {ownerLabel}
              </p>
              <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] text-slate-500">
                {area._count.sections} {area._count.sections === 1 ? "unit" : "units"} learned
              </p>
              <p className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-primary-700">
                {area.nameEs}
              </p>
            </div>
            <Link
              href={href}
              className="mt-4 inline-flex h-11 w-fit shrink-0 items-center justify-center rounded-full bg-primary-50 px-5 text-base font-bold text-primary-600 transition-colors hover:bg-primary-100"
            >
              View Details
            </Link>
          </div>
          <div className="relative h-32 w-36 shrink-0 overflow-hidden rounded-3xl bg-primary-50">
            {area.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={area.imageUrl}
                alt={area.name}
                className="h-full w-full object-cover object-center"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <LogoBadge logo={null} fallback={area.name.slice(0, 1)} size="md" tone="primary" />
              </div>
            )}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onRegenerate(area);
              }}
              disabled={regenerating || !canEdit}
              className="absolute bottom-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-white shadow-md transition hover:bg-primary-700 disabled:opacity-60"
              title="Refresh area image"
              aria-label="Refresh area image"
            >
              {regenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
        {!area.isActive && (
          <div className="mt-3 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
            Hidden
          </div>
        )}
      </div>
    </div>
  );
}

function AreaDragOverlayCard({ area }: { area: Area }) {
  return (
    <div className="rounded-3xl border-2 border-primary-300 bg-white p-4 shadow-xl">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="truncate font-semibold text-gray-900">{area.name}</p>
          <p className="truncate text-xs text-primary-700">
            {area.nameEs} · {area._count.sections}{" "}
            {area._count.sections === 1 ? "unit" : "units"}
          </p>
        </div>
      </div>
    </div>
  );
}

function PendingAreaCard({ area }: { area: Area }) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-primary-100 bg-primary-50/15 p-4 shadow-sm">
      <div className="flex min-w-0 items-stretch justify-between gap-4">
        <div className="flex min-w-0 flex-[2_2_0px] flex-col justify-between py-1">
          <div>
            <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[20px] font-bold leading-[1.2] tracking-tight text-slate-900">
              {area.name}
            </p>
            <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] text-slate-500">
              {area._count.sections} {area._count.sections === 1 ? "unit" : "units"} syncing
            </p>
            <p className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-primary-700">
              {area.nameEs}
            </p>
          </div>
          <span className="mt-4 inline-flex h-11 w-fit shrink-0 items-center justify-center rounded-full bg-primary-100 px-5 text-base font-bold text-primary-700">
            Replicating...
          </span>
        </div>
        <div className="relative h-32 w-36 shrink-0 overflow-hidden rounded-3xl bg-primary-50">
          {area.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={area.imageUrl}
              alt={area.name}
              className="h-full w-full object-cover object-center"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <LogoBadge logo={null} fallback={area.name.slice(0, 1)} size="md" tone="primary" />
            </div>
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[28px] bg-white/40 backdrop-blur-[1px]">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-100/90 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-primary-700" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminAreasPage() {
  const router = useRouter();
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createProgress, setCreateProgress] = useState("");
  const [createError, setCreateError] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [regeneratingAreaId, setRegeneratingAreaId] = useState<string | null>(
    null
  );
  const [role, setRole] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [editUnlocked, setEditUnlocked] = useState(false);

  // Create form
  const [name, setName] = useState("");

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { distance: 6 },
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

  function canEditNow() {
    const isSuperRole = role === "super_admin" || role === "admin";
    const inOrgContext = Boolean(selectedOrgId) && (isSuperRole || role === null);
    return !inOrgContext || editUnlocked;
  }

  function canCreateNow() {
    const isSuperRole = role === "super_admin" || role === "admin";
    const inOrgContext = Boolean(selectedOrgId) && (isSuperRole || role === null);
    return !inOrgContext;
  }

  async function fetchAreas() {
    setApiError("");
    try {
      const query = selectedOrgId
        ? `?organizationId=${encodeURIComponent(selectedOrgId)}`
        : "";
      const res = await fetch(`/api/admin/areas${query}`);
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

  async function fetchOrgContext() {
    try {
      const [meRes, orgRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/admin/organizations"),
      ]);
      if (meRes.ok) {
        const data = (await meRes.json()) as { role?: string; activeRole?: string };
        const nextRole = data.activeRole || data.role || null;
        setRole(nextRole);
      }
      if (orgRes.ok) {
        const orgData = (await orgRes.json()) as Organization[];
        setOrganizations(orgData);
      }
    } catch {
      // Ignore context fetch errors and keep default behavior.
    }
  }

  async function persistOrder(newAreas: Area[]) {
    if (!canEditNow()) return;
    setApiError("");
    const orderedIds = newAreas
      .filter((area) => !area.replicationPending)
      .map((area) => area.id);
    if (orderedIds.length === 0) return;
    const res = await fetch("/api/admin/areas/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderedIds,
        ...(selectedOrgId ? { organizationId: selectedOrgId } : {}),
      }),
    });
    if (!res.ok) {
      setApiError(await readApiError(res, "Failed to save area order."));
      await fetchAreas();
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextOrgId =
        new URLSearchParams(window.location.search).get("organizationId") || null;
      setSelectedOrgId(nextOrgId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchOrgContext();
      void fetchAreas();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId]);

  useEffect(() => {
    if (!areas.some((area) => area.replicationPending)) return;
    const timer = window.setTimeout(() => {
      void fetchAreas();
    }, 2500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areas]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!canEditNow()) return;
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const editable = areas.filter((area) => !area.replicationPending);
    const pending = areas.filter((area) => area.replicationPending);
    const oldIndex = editable.findIndex((a) => a.id === active.id);
    const newIndex = editable.findIndex((a) => a.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reorderedEditable = arrayMove(editable, oldIndex, newIndex);
    const merged = [...reorderedEditable, ...pending];
    setAreas(merged);
    persistOrder(reorderedEditable);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canEditNow() || !canCreateNow()) return;
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

  async function handleRegenerateAreaImage(area: Area) {
    if (!canEditNow()) return;
    setApiError("");
    setRegeneratingAreaId(area.id);
    try {
      const res = await fetch(`/api/admin/areas/${area.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: area.name,
          nameEs: area.nameEs,
          description: area.description,
          isActive: area.isActive,
          regenerateImage: true,
          ...(selectedOrgId ? { organizationId: selectedOrgId } : {}),
        }),
      });

      if (!res.ok) {
        setApiError(await readApiError(res, "Failed to refresh area image."));
        return;
      }

      const updated = (await res.json()) as { id: string; imageUrl?: string | null };
      if (updated.imageUrl) {
        setAreas((prev) =>
          prev.map((item) =>
            item.id === area.id ? { ...item, imageUrl: updated.imageUrl || item.imageUrl } : item
          )
        );
      } else {
        await fetchAreas();
      }
    } catch {
      setApiError("Connection error. Please try again.");
    } finally {
      setRegeneratingAreaId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const filteredAreas = areas.filter((area) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      area.name.toLowerCase().includes(q) ||
      area.nameEs.toLowerCase().includes(q) ||
      (area.description || "").toLowerCase().includes(q)
    );
  });
  const isSuperRole = role === "super_admin" || role === "admin";
  const inOrgContext = Boolean(selectedOrgId) && (isSuperRole || role === null);
  const canEdit = !inOrgContext || editUnlocked;
  const canCreateArea = canCreateNow();
  const editableAreas = filteredAreas.filter((area) => !area.replicationPending);
  const pendingAreas = filteredAreas.filter((area) => area.replicationPending);

  return (
    <div className="mx-auto max-w-md px-4 py-4 pb-32">
      <header className="mb-6">
        <h2 className="text-[28px] font-bold leading-tight tracking-tight text-slate-900">
          Areas of Knowledge
        </h2>
      </header>

      {isSuperRole && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Organization context
          </p>
          <div className="flex items-center gap-2">
            <select
              value={selectedOrgId || ""}
              onChange={(e) => {
                const nextOrgId = e.target.value || null;
                setSelectedOrgId(nextOrgId);
                setEditUnlocked(false);
                router.replace(
                  nextOrgId
                    ? `/admin?organizationId=${encodeURIComponent(nextOrgId)}`
                    : "/admin"
                );
              }}
              className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
            >
              <option value="">Global templates</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            {inOrgContext && (
              <button
                type="button"
                onClick={() => setEditUnlocked((prev) => !prev)}
                className={cn(
                  "h-10 rounded-xl px-3 text-xs font-semibold",
                  editUnlocked
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-700"
                )}
              >
                {editUnlocked ? "Editing ON" : "Unlock edit"}
              </button>
            )}
          </div>
          {inOrgContext && !editUnlocked && (
            <p className="mt-2 text-xs text-slate-500">
              Read-only guardrail active. Unlock edit to change org-owned content.
            </p>
          )}
          {inOrgContext && (
            <p className="mt-1 text-xs text-slate-500">
              Creation is disabled in org context to avoid accidental global template creation.
            </p>
          )}
        </div>
      )}

      <div className="mb-5 rounded-full bg-slate-100 px-4 py-3">
        <div className="flex items-center gap-2 text-slate-500">
          <Search className="h-5 w-5 text-primary-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search areas..."
            className="w-full border-none bg-transparent p-0 text-lg text-slate-700 placeholder:text-slate-400 focus:ring-0"
          />
        </div>
      </div>

      {apiError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {apiError}
        </div>
      )}

      {editableAreas.length > 1 && search.trim() === "" && (
        <div className="mb-2 mt-4 flex items-center justify-end">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider">
            Drag to reorder
          </span>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={editableAreas.map((a) => a.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="mb-4 space-y-4">
            {editableAreas.map((area) => (
              <div key={area.id} className="relative">
                <SortableAreaCard
                  area={area}
                  regenerating={regeneratingAreaId === area.id}
                  onRegenerate={handleRegenerateAreaImage}
                  orgContextId={selectedOrgId}
                  canEdit={canEdit}
                />
              </div>
            ))}
            {pendingAreas.map((area) => (
              <PendingAreaCard key={area.id} area={area} />
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

      {filteredAreas.length === 0 && !showCreate && (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {areas.length === 0
              ? "No areas yet. Create your first one!"
              : "No areas match your search."}
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
      ) : areas.length > 0 ? (
        <button
          onClick={() => {
            if (!canCreateArea) return;
            setShowCreate(true);
          }}
          disabled={!canCreateArea}
          className="fixed bottom-[88px] left-1/2 z-20 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-center gap-2 rounded-2xl bg-primary-600 px-4 py-3.5 text-lg font-bold tracking-tight text-white shadow-lg shadow-primary-300/40 transition-all hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-6 w-6" />
          Create New Area
        </button>
      ) : null}
      {showCreate && areas.length > 0 ? (
        <div className="h-4" />
      ) : null}
      {showCreate && (
        <div className="pt-2" />
      )}
    </div>
  );
}
