"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Plus,
  Trash2,
  UserCircle,
  KeyRound,
  ShieldCheck,
  ShieldOff,
  ChevronDown,
  Search,
  Upload,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ToastMessage } from "@/components/toast-message";
import { AppModal, modalActionButtonClass } from "@/components/app-modal";

interface Learner {
  id: string;
  username: string;
  displayName: string;
  avatarGender: "female" | "male" | null;
  organizationId: string | null;
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
  activeRole?: string;
  organizationId: string | null;
}

interface ToastState {
  open: boolean;
  status: "success" | "failed";
  message: string;
}

interface ImportRowResult {
  rowNumber: number;
  email: string;
  displayName: string;
  status: "created" | "skipped" | "error";
  reason: string;
}

interface ImportSummary {
  createdCount: number;
  skippedCount: number;
  errorCount: number;
  totalProcessed: number;
  results: ImportRowResult[];
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
          "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors",
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
          <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg animate-scale-in">
            <div className="border-b border-gray-100 px-4 py-3">
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
                    "w-full px-4 py-3 text-left transition-colors hover:bg-gray-50",
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
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newAvatarGender, setNewAvatarGender] = useState<"female" | "male" | null>(null);
  const [createOrgId, setCreateOrgId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [apiError, setApiError] = useState("");
  const [resetTarget, setResetTarget] = useState<Learner | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<Learner | null>(null);
  const [reassignOrgId, setReassignOrgId] = useState("");
  const [reassigning, setReassigning] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [toast, setToast] = useState<ToastState>({
    open: false,
    status: "success",
    message: "",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void initialize();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast.open) return;
    const timer = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, open: false }));
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [toast.open]);

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

      const activeRole = me?.activeRole || me?.role;
      const initialOrgId =
        activeRole === "org_admin"
          ? me?.organizationId || ""
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
      ((sessionMe?.activeRole || sessionMe?.role) === "super_admin" ||
        (sessionMe?.activeRole || sessionMe?.role) === "admin") &&
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
        email: newEmail,
        password: newPassword,
        displayName: newDisplayName,
        avatarGender: newAvatarGender,
        organizationId:
          (sessionMe?.activeRole || sessionMe?.role) === "org_admin"
            ? sessionMe?.organizationId
            : createOrgId || undefined,
      }),
    });
    if (res.ok) {
      setNewEmail("");
      setNewPassword("");
      setNewDisplayName("");
      setNewAvatarGender(null);
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

  async function reassignLearnerOrganization(e: React.FormEvent) {
    e.preventDefault();
    if (!reassignTarget) return;
    setReassigning(true);
    setApiError("");
    const res = await fetch(`/api/admin/learners/${reassignTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: reassignOrgId }),
    });
    if (res.ok) {
      setReassignTarget(null);
      setReassignOrgId("");
      await fetchLearners(selectedOrgId || undefined);
      setToast({
        open: true,
        status: "success",
        message: "Learner organization updated.",
      });
    } else {
      const err = await readApiError(res, "Failed to change learner organization.");
      setApiError(err);
      setToast({
        open: true,
        status: "failed",
        message: err,
      });
    }
    setReassigning(false);
  }

  async function handleImportLearners(e: React.FormEvent) {
    e.preventDefault();
    setImporting(true);
    setImportError("");
    setImportSummary(null);
    setApiError("");

    if (!importFile) {
      setImportError("Please select a CSV or Excel file.");
      setImporting(false);
      return;
    }

    if (
      ((sessionMe?.activeRole || sessionMe?.role) === "super_admin" ||
        (sessionMe?.activeRole || sessionMe?.role) === "admin") &&
      !selectedOrgId
    ) {
      setImportError("Choose an organization scope before importing learners.");
      setImporting(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", importFile);
    if (selectedOrgId) {
      formData.append("organizationId", selectedOrgId);
    }

    try {
      const res = await fetch("/api/admin/learners/import", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        setImportError(await readApiError(res, "Failed to import learners."));
        setImporting(false);
        return;
      }

      const data = (await res.json()) as ImportSummary;
      setImportSummary(data);
      await fetchLearners(selectedOrgId || undefined);
      setToast({
        open: true,
        status: "success",
        message: `Import complete: ${data.createdCount} created, ${data.skippedCount} skipped, ${data.errorCount} errors.`,
      });
    } catch {
      setImportError("Connection error while importing learners.");
    }

    setImporting(false);
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
  const activeSessionRole = sessionMe?.activeRole || sessionMe?.role;
  const canResetPasswords =
    activeSessionRole === "super_admin" || activeSessionRole === "admin";
  const canReassignOrganization =
    activeSessionRole === "super_admin" || activeSessionRole === "admin";
  const organizationNameById = new Map(
    organizations.map((org) => [org.id, org.name])
  );
  const avatarSrcByGender: Record<"female" | "male", string> = {
    female: "/images/library/humanbody_femaleface.png",
    male: "/images/library/humanbody_male.png",
  };

  return (
    <div className="space-y-4 px-4 py-6 pb-24">
      <ToastMessage
        open={toast.open}
        status={toast.status}
        message={toast.message}
      />
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[28px] font-bold leading-none text-gray-900">
            Learner Management
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            {learners.length} registered learner
            {learners.length !== 1 ? "s" : ""}
          </p>
        </div>
        {!showCreate && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setImportFile(null);
                setImportError("");
                setImportSummary(null);
                setShowImportModal(true);
              }}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-primary-200 bg-primary-50 px-3 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-100"
              title="Import Learners"
            >
              <Upload className="h-4 w-4" />
              Import
            </button>
            <button
              onClick={() => {
                setCreateOrgId(selectedOrgId || "");
                setShowCreate(true);
              }}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-600 text-white transition-colors hover:bg-primary-700"
              title="Add New Learner"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
      {apiError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {apiError}
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <form
          onSubmit={createLearner}
          className="animate-scale-in space-y-3 rounded-[28px] border border-primary-100 bg-white p-4 shadow-sm"
        >
          <h4 className="text-base font-semibold text-gray-900">New Learner Account</h4>
          {(activeSessionRole === "super_admin" || activeSessionRole === "admin") && (
            <select
              value={createOrgId}
              onChange={(e) => setCreateOrgId(e.target.value)}
              className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
            className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            required
          />
          <input
            type="email"
            placeholder="E-mail"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            required
            minLength={4}
          />
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Avatar Gender
            </p>
            <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 p-1">
              <button
                type="button"
                onClick={() => setNewAvatarGender("male")}
                className={cn(
                  "h-10 rounded-xl text-2xl font-semibold leading-none transition-colors",
                  newAvatarGender === "male"
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-500 hover:bg-gray-100"
                )}
                title="Male avatar"
                aria-pressed={newAvatarGender === "male"}
              >
                ♂
              </button>
              <button
                type="button"
                onClick={() => setNewAvatarGender(null)}
                className={cn(
                  "h-10 rounded-xl text-2xl font-semibold leading-none transition-colors",
                  newAvatarGender === null
                    ? "bg-gray-200 text-gray-700"
                    : "text-gray-500 hover:bg-gray-100"
                )}
                title="No gender preference"
                aria-pressed={newAvatarGender === null}
              >
                ○
              </button>
              <button
                type="button"
                onClick={() => setNewAvatarGender("female")}
                className={cn(
                  "h-10 rounded-xl text-2xl font-semibold leading-none transition-colors",
                  newAvatarGender === "female"
                    ? "bg-pink-100 text-pink-700"
                    : "text-gray-500 hover:bg-gray-100"
                )}
                title="Female avatar"
                aria-pressed={newAvatarGender === "female"}
              >
                ♀
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-danger-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={creating}
              className="flex-1 rounded-2xl bg-primary-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Account"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setError("");
                setNewAvatarGender(null);
              }}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {(activeSessionRole === "super_admin" || activeSessionRole === "admin") &&
        organizations.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">
              Organization Scope
            </label>
            <select
              value={selectedOrgId}
              onChange={(e) => {
                const orgId = e.target.value;
                setSelectedOrgId(orgId);
                void fetchLearners(orgId || undefined);
              }}
              className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-gray-50 p-3 text-center">
            <p className="text-lg font-bold text-gray-900">{learners.length}</p>
            <p className="text-[10px] text-gray-500 uppercase">Total</p>
          </div>
          <div className="rounded-2xl bg-green-50 p-3 text-center">
            <p className="text-lg font-bold text-green-700">{activeCount}</p>
            <p className="text-[10px] text-green-600 uppercase">Active</p>
          </div>
          <div className={cn("rounded-2xl p-3 text-center", blockedCount > 0 ? "bg-red-50" : "bg-gray-50")}>
            <p className={cn("text-lg font-bold", blockedCount > 0 ? "text-red-700" : "text-gray-900")}>{blockedCount}</p>
            <p className={cn("text-[10px] uppercase", blockedCount > 0 ? "text-red-600" : "text-gray-500")}>Blocked</p>
          </div>
        </div>
      )}

      {/* Search */}
      {learners.length > 0 && (
        <div>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search learners by name or username"
              className="h-12 w-full rounded-2xl border border-gray-200 bg-white pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                "rounded-[28px] border bg-white p-4 shadow-sm",
                learner.hasAccess ? "border-gray-200" : "border-red-200"
              )}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={cn(
                        "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[18px]",
                        learner.hasAccess ? "bg-primary-100" : "bg-red-100"
                      )}
                    >
                      <img
                        src={avatarSrcByGender[learner.avatarGender === "male" ? "male" : "female"]}
                        alt={`${learner.displayName} avatar`}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "/images/library/humanbody_femaleface.png";
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[17px] font-semibold leading-tight text-gray-900">
                        {learner.displayName}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-gray-500">
                        @{learner.username}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <AccessControl
                      learner={learner}
                      onUpdate={() => void fetchLearners(selectedOrgId || undefined)}
                      onError={setApiError}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {canReassignOrganization && (
                    <div className="rounded-2xl bg-gray-50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400">
                        Organization
                      </p>
                      <p className="truncate text-xs font-medium text-gray-700">
                        {learner.organizationId
                          ? organizationNameById.get(learner.organizationId) || "Unknown"
                          : "Unassigned"}
                      </p>
                    </div>
                  )}
                  <div className="rounded-2xl bg-gray-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400">
                      Progress
                    </p>
                    <p className="text-xs font-medium text-gray-700">
                      {completedSections} section
                      {completedSections !== 1 ? "s" : ""} completed
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[10px]",
                        learner.hasAccess
                          ? "bg-gray-100 text-gray-500"
                          : "bg-red-50 text-red-500"
                      )}
                    >
                      {learner.accessReason}
                    </span>
                    {learner.accessOverride && (
                      <span className="rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[10px] text-yellow-700">
                        Manual override
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    {canResetPasswords && (
                      <button
                        onClick={() => {
                          setResetTarget(learner);
                          setResetPassword("");
                        }}
                        className="rounded-xl bg-gray-50 p-2 text-gray-400 transition-colors hover:bg-primary-50 hover:text-primary-600"
                        title="Reset password"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                    )}
                    {canReassignOrganization && (
                      <button
                        onClick={() => {
                          setReassignTarget(learner);
                          setReassignOrgId(learner.organizationId || "");
                        }}
                        className="rounded-xl bg-gray-50 p-2 text-gray-400 transition-colors hover:bg-primary-50 hover:text-primary-600"
                        title="Change organization"
                      >
                        <Building2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() =>
                        deleteLearner(learner.id, learner.displayName)
                      }
                      className="rounded-xl bg-gray-50 p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-danger-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {learners.length > 0 && filteredLearners.length === 0 && (
        <div className="rounded-[28px] border border-dashed border-gray-200 py-10 text-center">
          <p className="text-sm text-gray-500">
            No learners match &quot;<span className="font-medium">{search}</span>&quot;
          </p>
        </div>
      )}

      {learners.length === 0 && !showCreate && (
        <div className="rounded-[28px] border border-dashed border-gray-200 py-12 text-center">
          <UserCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            No learners yet. Create your first one!
          </p>
        </div>
      )}

      {resetTarget && (
        <AppModal
          open={Boolean(resetTarget)}
          onClose={() => {
            setResetTarget(null);
            setResetPassword("");
          }}
          maxWidthClassName="max-w-sm"
        >
          <form
            onSubmit={resetLearnerPassword}
            className="w-full space-y-3"
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
              className="h-12 w-full rounded-2xl border border-gray-200 px-4 text-sm"
              minLength={4}
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={resetting}
                className={cn(modalActionButtonClass.primary, "flex-1")}
              >
                {resetting ? "Updating..." : "Update Password"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setResetTarget(null);
                  setResetPassword("");
                }}
                className={modalActionButtonClass.secondary}
              >
                Cancel
              </button>
            </div>
          </form>
        </AppModal>
      )}

      {reassignTarget && (
        <AppModal
          open={Boolean(reassignTarget)}
          onClose={() => {
            setReassignTarget(null);
            setReassignOrgId("");
          }}
          maxWidthClassName="max-w-sm"
        >
          <form
            onSubmit={reassignLearnerOrganization}
            className="w-full space-y-3"
          >
            <h3 className="font-bold text-gray-900">Change Learner Organization</h3>
            <p className="text-xs text-gray-500">
              Move <span className="font-medium">{reassignTarget.displayName}</span> to a different organization.
            </p>
            <select
              value={reassignOrgId}
              onChange={(e) => setReassignOrgId(e.target.value)}
              className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm"
              required
            >
              <option value="">Select organization...</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={reassigning}
                className={cn(modalActionButtonClass.primary, "flex-1")}
              >
                {reassigning ? "Updating..." : "Update Organization"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setReassignTarget(null);
                  setReassignOrgId("");
                }}
                className={modalActionButtonClass.secondary}
              >
                Cancel
              </button>
            </div>
          </form>
        </AppModal>
      )}

      {showImportModal && (
        <AppModal
          open={showImportModal}
          onClose={() => {
            if (importing) return;
            setShowImportModal(false);
            setImportFile(null);
            setImportError("");
            setImportSummary(null);
          }}
          maxWidthClassName="max-w-lg"
          showCloseButton={!importing}
          closeLabel="Close learner import modal"
        >
          <form onSubmit={handleImportLearners} className="w-full space-y-3">
            <h3 className="font-bold text-gray-900">Bulk Import Learners</h3>
            <p className="text-xs text-gray-500">
              Upload CSV/XLS/XLSX with required columns <span className="font-semibold">Display Name</span> and <span className="font-semibold">Email</span>, and optional <span className="font-semibold">Gender</span>. Initial password is set to each learner&apos;s email.
            </p>

            <input
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={(e) => {
                const nextFile = e.target.files?.[0] || null;
                setImportFile(nextFile);
                setImportError("");
              }}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-primary-700"
              disabled={importing}
            />

            {importError && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {importError}
              </div>
            )}

            {importSummary && (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-800">
                  Import results
                </p>
                <p className="text-xs text-slate-600">
                  {importSummary.createdCount} created, {importSummary.skippedCount} skipped, {importSummary.errorCount} errors
                  {" "}({importSummary.totalProcessed} processed rows)
                </p>
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg bg-white p-2">
                  {importSummary.results.slice(0, 20).map((row) => (
                    <p key={`${row.rowNumber}-${row.email}-${row.status}`} className="text-xs text-slate-600">
                      Row {row.rowNumber}:{" "}
                      <span className="font-medium">{row.email || "(no email)"}</span>
                      {" "}- {row.status} ({row.reason})
                    </p>
                  ))}
                  {importSummary.results.length > 20 && (
                    <p className="text-xs text-slate-500">
                      Showing first 20 row results.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={importing}
                className={cn(modalActionButtonClass.primary, "flex flex-1 items-center justify-center gap-2")}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Start Import
                  </>
                )}
              </button>
              {!importing && (
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                    setImportError("");
                    setImportSummary(null);
                  }}
                  className={modalActionButtonClass.secondary}
                >
                  Close
                </button>
              )}
            </div>
          </form>
        </AppModal>
      )}
    </div>
  );
}
