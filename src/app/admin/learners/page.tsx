"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, UserCircle } from "lucide-react";

interface Learner {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
  sectionProgress: {
    sectionId: string;
    introCompleted: boolean;
    practiceCompleted: boolean;
    testPassed: boolean;
    testScore: number | null;
  }[];
}

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
    if (!confirm(`Delete learner "${name}"? This will remove all their progress.`)) return;
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

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Learner Management</h2>
        <p className="text-sm text-gray-500 mt-1">
          {learners.length} registered learner{learners.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Learners List */}
      <div className="space-y-3">
        {learners.map((learner) => {
          const completedSections = learner.sectionProgress.filter(
            (p) => p.testPassed
          ).length;
          return (
            <div
              key={learner.id}
              className="bg-white border border-gray-200 rounded-xl p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-primary-100 rounded-full p-2">
                    <UserCircle className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {learner.displayName}
                    </p>
                    <p className="text-xs text-gray-500">@{learner.username}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {completedSections} section{completedSections !== 1 ? "s" : ""}{" "}
                      completed
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteLearner(learner.id, learner.displayName)}
                  className="p-2 text-gray-300 hover:text-danger-500 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {learners.length === 0 && !showCreate && (
        <div className="text-center py-12">
          <UserCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No learners yet. Create your first one!</p>
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
          {error && (
            <p className="text-sm text-danger-500">{error}</p>
          )}
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
