"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  UserCircle,
  ShieldCheck,
  ShieldOff,
  ShieldAlert,
  ChevronDown,
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

// ─── Access Control Dropdown ──────────────────────────────────────────────────

function AccessControl({
  learner,
  onUpdate,
}: {
  learner: Learner;
  onUpdate: () => void;
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

  const currentOption =
    options.find((o) => o.value === learner.accessOverride) || options[0];

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
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchLearners();
  }, []);

  async function fetchLearners() {
    const res = await fetch("/api/admin/learners");
    if (res.ok) {
      setLearners(await res.json());
    }
    setLoading(false);
  }

  async function createLearner(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    const res = await fetch("/api/admin/learners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: newUsername,
        password: newPassword,
        displayName: newDisplayName,
      }),
    });
    if (res.ok) {
      setNewUsername("");
      setNewPassword("");
      setNewDisplayName("");
      setShowCreate(false);
      fetchLearners();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create learner");
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
    await fetch(`/api/admin/learners/${id}`, { method: "DELETE" });
    fetchLearners();
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

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Learner Management
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {learners.length} registered learner
          {learners.length !== 1 ? "s" : ""}
        </p>
      </div>

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

      {/* Learners List */}
      <div className="space-y-3">
        {learners.map((learner) => {
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
                    onUpdate={fetchLearners}
                  />
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

      {learners.length === 0 && !showCreate && (
        <div className="text-center py-12">
          <UserCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            No learners yet. Create your first one!
          </p>
        </div>
      )}

      {/* Create Form */}
      {showCreate ? (
        <form
          onSubmit={createLearner}
          className="mt-4 bg-primary-50 border border-primary-200 rounded-xl p-4 space-y-3 animate-scale-in"
        >
          <h4 className="font-semibold text-sm">New Learner Account</h4>
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
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="mt-4 w-full bg-primary-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add New Learner
        </button>
      )}
    </div>
  );
}
