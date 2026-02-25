"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  UserCircle,
  KeyRound,
  ShieldCheck,
  ShieldOff,
  ShieldAlert,
  ChevronDown,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Learner {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
  accessOverride: string | null;
  hasAccess: boolean;
  accessReason: string;
  paymentStatus: "free_trial" | "settled" | "past_due";
  sectionProgress: {
    sectionId: string;
    introCompleted: boolean;
    practiceCompleted: boolean;
    testPassed: boolean;
    testScore: number | null;
  }[];
}

interface Organization {
  id: string;
  name: string;
  isActive: boolean;
}

interface SessionMe {
  role: string;
  organizationId: string | null;
}

// ─── Access Control Dropdown ──────────────────────────────────────────────────

function AccessControl({
  learner,
  onUpdate,
  onError,
}: {
  learner: Learner;
  onUpdate: () => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  async function setOverride(value: string | null) {
    setUpdating(true);
    const res = await fetch(`/api/admin/learners/${learner.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessOverride: value }),
    });
    if (res.ok) {
      onUpdate();
    } else {
      onError("Failed to update learner access.");
    }
    setUpdating(false);
    setOpen(false);
  }

  const options: { value: string | null; label: string; desc: string }[] = [
    {
      value: null,
      label: "Auto",
      desc: "Follows payment status",
    },
    {
      value: "enabled",
      label: "Force Enable",
      desc: "Allow access regardless of payment",
    },
    {
      value: "disabled",
      label: "Force Disable",
      desc: "Block access regardless of payment",
    },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={updating}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
          learner.hasAccess
            ? "bg-green-50 border-green-200 text-green-700"
            : "bg-red-50 border-red-200 text-red-700",
          updating && "opacity-50"
        )}
      >
        {learner.hasAccess ? (
          <ShieldCheck className="w-3.5 h-3.5" />
        ) : (
          <ShieldOff className="w-3.5 h-3.5" />
        )}
        <span>{learner.hasAccess ? "Active" : "Blocked"}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 w-56 overflow-hidden animate-scale-in">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
                Access Control
              </p>
            </div>
            {options.map((option) => {
              const isSelected = learner.accessOverride === option.value;
              return (
                <button
                  key={option.value ?? "auto"}
                  onClick={() => setOverride(option.value)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors",
                    isSelected && "bg-primary-50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isSelected ? "text-primary-700" : "text-gray-900"
                      )}
                    >
                      {option.label}
                    </span>
                    {isSelected && (
                      <span className="text-primary-600 text-xs">Active</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {option.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LearnersPage() {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [sessionMe, setSessionMe] = useState<SessionMe | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [createOrgId, setCreateOrgId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [apiError, setApiError] = useState("");
  const [resetTarget, setResetTarget] = useState<Learner | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void initialize();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function initialize() {
    setApiError("");
    try {
      const [meRes, orgRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/admin/organizations?activeOnly=true"),
      ]);

      let me: SessionMe | null = null;
      if (meRes.ok) {
        const meData = (await meRes.json()) as SessionMe;
        me = meData;
        setSessionMe({
          role: meData.role,
          organizationId: meData.organizationId ?? null,
        });
      } else {
        setApiError(await readApiError(meRes, "Failed to load session."));
      }

      if (orgRes.ok) {
        const orgs = (await orgRes.json()) as Organization[];
        setOrganizations(orgs);
      } else {
        setOrganizations([]);
        setApiError(await readApiError(orgRes, "Failed to load organizations."));
      }

      const initialOrgId =
        me?.role === "org_admin"
          ? me.organizationId || ""
          : "";
      setSelectedOrgId(initialOrgId);
      setCreateOrgId(initialOrgId);
      await fetchLearners(initialOrgId || undefined);
    } catch {
      setApiError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchLearners(orgId?: string) {
    setApiError("");
    const query = orgId ? `?organizationId=${encodeURIComponent(orgId)}` : "";
    const res = await fetch(`/api/admin/learners${query}`);
    if (res.ok) {
      setLearners(await res.json());
    } else {
      setLearners([]);
      setApiError(await readApiError(res, "Failed to load learners."));
    }
  }

  async function createLearner(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    setApiError("");
    if (
      (sessionMe?.role === "super_admin" || sessionMe?.role === "admin") &&
      !createOrgId
    ) {
      setError("Please choose an organization for this learner.");
      setCreating(false);
      return;
    }
    const res = await fetch("/api/admin/learners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: newUsername,
        password: newPassword,
        displayName: newDisplayName,
        organizationId:
          sessionMe?.role === "org_admin"
            ? sessionMe.organizationId
            : createOrgId || undefined,
      }),
    });
    if (res.ok) {
      setNewUsername("");
      setNewPassword("");
      setNewDisplayName("");
      setShowCreate(false);
      void fetchLearners(selectedOrgId || undefined);
    } else {
      setError(await readApiError(res, "Failed to create learner"));
    }
    setCreating(false);
  }

  async function deleteLearner(id: string, name: string) {
    if (
      !confirm(
        `Delete learner "${name}"? This will remove all their progress.`
      )
    )
      return;
    setApiError("");
    const res = await fetch(`/api/admin/learners/${id}`, { method: "DELETE" });
    if (res.ok) {
      void fetchLearners(selectedOrgId || undefined);
    } else {
      setApiError(await readApiError(res, "Failed to delete learner."));
    }
  }

  async function resetLearnerPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setResetting(true);
    setApiError("");
    const res = await fetch(`/api/admin/learners/${resetTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetPassword }),
    });
    if (res.ok) {
      setResetTarget(null);
      setResetPassword("");
    } else {
      setApiError(await readApiError(res, "Failed to reset learner password."));
    }
    setResetting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const activeCount = learners.filter((l) => l.hasAccess).length;
  const blockedCount = learners.filter((l) => !l.hasAccess).length;
  const normalizedSearch = search.trim().toLowerCase();
  const filteredLearners = learners.filter((learner) => {
    if (!normalizedSearch) return true;
    return (
      learner.displayName.toLowerCase().includes(normalizedSearch) ||
      learner.username.toLowerCase().includes(normalizedSearch)
    );
  });
  const canResetPasswords =
    sessionMe?.role === "super_admin" || sessionMe?.role === "admin";

  return (
    <div className="px-4 py-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Learner Management
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {learners.length} registered learner
            {learners.length !== 1 ? "s" : ""}
          </p>
        </div>
        {!showCreate && (
          <button
            onClick={() => {
              setCreateOrgId(selectedOrgId || "");
              setShowCreate(true);
            }}
            className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            title="Add New Learner"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>
      {apiError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {apiError}
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <form
          onSubmit={createLearner}
          className="mb-4 bg-primary-50 border border-primary-200 rounded-xl p-4 space-y-3 animate-scale-in"
        >
          <h4 className="font-semibold text-sm">New Learner Account</h4>
          {(sessionMe?.role === "super_admin" || sessionMe?.role === "admin") && (
            <select
              value={createOrgId}
              onChange={(e) => setCreateOrgId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
              required
            >
              <option value="">Select organization...</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          )}
          <input
            type="text"
            placeholder="Display name"
            value={newDisplayName}
            onChange={(e) => setNewDisplayName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
            required
          />
          <input
            type="text"
            placeholder="Username"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
            required
            minLength={4}
          />
          {error && <p className="text-sm text-danger-500">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Account"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setError("");
              }}
              className="px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-lg text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {(sessionMe?.role === "super_admin" || sessionMe?.role === "admin") &&
        organizations.length > 0 && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Organization Scope
            </label>
            <select
              value={selectedOrgId}
              onChange={(e) => {
                const orgId = e.target.value;
                setSelectedOrgId(orgId);
                void fetchLearners(orgId || undefined);
              }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
            >
              <option value="">All organizations</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        )}

      {/* Access stats */}
      {learners.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-gray-900">{learners.length}</p>
            <p className="text-[10px] text-gray-500 uppercase">Total</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-green-700">{activeCount}</p>
            <p className="text-[10px] text-green-600 uppercase">Active</p>
          </div>
          <div className={cn("rounded-xl p-3 text-center", blockedCount > 0 ? "bg-red-50" : "bg-gray-50")}>
            <p className={cn("text-lg font-bold", blockedCount > 0 ? "text-red-700" : "text-gray-900")}>{blockedCount}</p>
            <p className={cn("text-[10px] uppercase", blockedCount > 0 ? "text-red-600" : "text-gray-500")}>Blocked</p>
          </div>
        </div>
      )}

      {/* Search */}
      {learners.length > 0 && (
        <div className="mb-4">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search learners by name or username"
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
          {normalizedSearch && (
            <p className="text-xs text-gray-500 mt-1">
              Showing {filteredLearners.length} of {learners.length} learners
            </p>
          )}
        </div>
      )}

      {/* Learners List */}
      <div className="space-y-3">
        {filteredLearners.map((learner) => {
          const completedSections = learner.sectionProgress.filter(
            (p) => p.testPassed
          ).length;
          return (
            <div
              key={learner.id}
              className={cn(
                "bg-white border rounded-xl p-4",
                learner.hasAccess ? "border-gray-200" : "border-red-200"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "rounded-full p-2",
                      learner.hasAccess ? "bg-primary-100" : "bg-red-100"
                    )}
                  >
                    {learner.hasAccess ? (
                      <UserCircle className="w-6 h-6 text-primary-600" />
                    ) : (
                      <ShieldAlert className="w-6 h-6 text-red-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {learner.displayName}
                    </p>
                    <p className="text-xs text-gray-500">
                      @{learner.username}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {completedSections} section
                      {completedSections !== 1 ? "s" : ""} completed
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <AccessControl
                    learner={learner}
                    onUpdate={() => void fetchLearners(selectedOrgId || undefined)}
                    onError={setApiError}
                  />
                  {canResetPasswords && (
                    <button
                      onClick={() => {
                        setResetTarget(learner);
                        setResetPassword("");
                      }}
                      className="p-2 text-gray-300 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
                      title="Reset password"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() =>
                      deleteLearner(learner.id, learner.displayName)
                    }
                    className="p-2 text-gray-300 hover:text-danger-500 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Access reason hint */}
              <div className="mt-2 flex items-center gap-1.5">
                <span
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full",
                    learner.hasAccess
                      ? "bg-gray-100 text-gray-500"
                      : "bg-red-50 text-red-500"
                  )}
                >
                  {learner.accessReason}
                </span>
                {learner.accessOverride && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
                    Manual override
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {learners.length > 0 && filteredLearners.length === 0 && (
        <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl">
          <p className="text-sm text-gray-500">
            No learners match &quot;<span className="font-medium">{search}</span>&quot;
          </p>
        </div>
      )}

      {learners.length === 0 && !showCreate && (
        <div className="text-center py-12">
          <UserCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            No learners yet. Create your first one!
          </p>
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={resetLearnerPassword}
            className="bg-white rounded-2xl p-6 w-full max-w-sm animate-scale-in space-y-3"
          >
            <h3 className="font-bold text-gray-900">Reset Learner Password</h3>
            <p className="text-xs text-gray-500">
              Set a new password for <span className="font-medium">{resetTarget.displayName}</span>.
            </p>
            <input
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="New password"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              minLength={4}
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={resetting}
                className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {resetting ? "Updating..." : "Update Password"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setResetTarget(null);
                  setResetPassword("");
                }}
                className="px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-lg text-sm"
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
