"use client";

import { useEffect, useState } from "react";
import { Building2, KeyRound, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppModal, modalActionButtonClass } from "@/components/app-modal";

interface Organization {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

interface SessionMe {
  role: string;
}

interface OrgAdminUser {
  id: string;
  username: string;
  displayName: string;
  organizationId: string | null;
}

export default function OrgsPage() {
  const [me, setMe] = useState<SessionMe | null>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgAdmins, setOrgAdmins] = useState<OrgAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [search, setSearch] = useState("");
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Organization | null>(null);
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null);
  const [showCreateAdminForOrgId, setShowCreateAdminForOrgId] = useState<string | null>(null);
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminDisplayName, setNewAdminDisplayName] = useState("");
  const [resetAdminTarget, setResetAdminTarget] = useState<OrgAdminUser | null>(null);
  const [resetAdminPassword, setResetAdminPassword] = useState("");
  const [resettingAdminPassword, setResettingAdminPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void init();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function readApiError(res: Response, fallback: string) {
    try {
      const data = (await res.json()) as { error?: unknown };
      if (typeof data.error === "string" && data.error.trim()) return data.error;
    } catch {
      // Ignore parse errors and use fallback.
    }
    return fallback;
  }

  async function init() {
    setLoading(true);
    setApiError("");
    try {
      const [meRes, orgRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/admin/organizations"),
      ]);
      if (meRes.ok) {
        setMe((await meRes.json()) as SessionMe);
      } else {
        setApiError(await readApiError(meRes, "Failed to load session."));
      }

      if (orgRes.ok) {
        const organizations = (await orgRes.json()) as Organization[];
        setOrgs(organizations);
      } else {
        setOrgs([]);
        setApiError(await readApiError(orgRes, "Failed to load organizations."));
      }

      const adminsRes = await fetch("/api/admin/org-admins");
      if (adminsRes.ok) {
        setOrgAdmins((await adminsRes.json()) as OrgAdminUser[]);
      } else {
        setOrgAdmins([]);
        setApiError(await readApiError(adminsRes, "Failed to load organization admins."));
      }
    } catch {
      setApiError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setApiError("");
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });
      if (res.ok) {
        setName("");
        setSlug("");
        setShowCreateOrgModal(false);
        await init();
      } else {
        setApiError(await readApiError(res, "Failed to create organization"));
      }
    } catch {
      setApiError("Connection error. Please try again.");
    }
    setSaving(false);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError("");
    setApiError("");
    try {
      const res = await fetch(`/api/admin/organizations/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editing.name,
          slug: editing.slug,
          isActive: editing.isActive,
        }),
      });
      if (res.ok) {
        setEditing(null);
        await init();
      } else {
        setError(await readApiError(res, "Failed to save organization"));
      }
    } catch {
      setError("Connection error. Please try again.");
    }
    setSaving(false);
  }

  async function removeOrg(org: Organization) {
    if (!confirm(`Delete organization "${org.name}"?`)) return;
    setApiError("");
    try {
      const res = await fetch(`/api/admin/organizations/${org.id}`, { method: "DELETE" });
      if (res.ok) {
        await init();
      } else {
        setApiError(await readApiError(res, "Failed to delete organization"));
      }
    } catch {
      setApiError("Connection error. Please try again.");
    }
  }

  async function createOrgAdmin(e: React.FormEvent, organizationId: string) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setApiError("");
    try {
      const res = await fetch("/api/admin/org-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          username: newAdminUsername,
          password: newAdminPassword,
          displayName: newAdminDisplayName,
        }),
      });
      if (res.ok) {
        setNewAdminUsername("");
        setNewAdminPassword("");
        setNewAdminDisplayName("");
        setShowCreateAdminForOrgId(null);
        await init();
      } else {
        setApiError(await readApiError(res, "Failed to create org admin"));
      }
    } catch {
      setApiError("Connection error. Please try again.");
    }
    setSaving(false);
  }

  async function reassignOrgAdmin(userId: string, organizationId: string) {
    setApiError("");
    try {
      const res = await fetch(`/api/admin/org-admins/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (res.ok) {
        await init();
      } else {
        setApiError(await readApiError(res, "Failed to reassign org admin"));
      }
    } catch {
      setApiError("Connection error. Please try again.");
    }
  }

  async function removeOrgAdmin(userId: string) {
    if (!confirm("Remove org admin role for this user?")) return;
    setApiError("");
    try {
      const res = await fetch(`/api/admin/org-admins/${userId}`, { method: "DELETE" });
      if (res.ok) {
        await init();
      } else {
        setApiError(await readApiError(res, "Failed to remove org admin"));
      }
    } catch {
      setApiError("Connection error. Please try again.");
    }
  }

  async function resetOrgAdminPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetAdminTarget) return;
    setResettingAdminPassword(true);
    setApiError("");
    try {
      const res = await fetch(`/api/admin/org-admins/${resetAdminTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetAdminPassword }),
      });
      if (res.ok) {
        setResetAdminTarget(null);
        setResetAdminPassword("");
      } else {
        setApiError(await readApiError(res, "Failed to reset org admin password."));
      }
    } catch {
      setApiError("Connection error. Please try again.");
    }
    setResettingAdminPassword(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const isSuper = me?.role === "super_admin" || me?.role === "admin";
  const filteredOrgs = orgs.filter((org) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return org.name.toLowerCase().includes(q) || org.slug.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4 px-4 py-6 pb-24">
      <div>
        <h2 className="text-[28px] font-bold leading-none text-gray-900">Orgs</h2>
        <p className="mt-2 text-sm text-gray-500">
          Organization and organization admin management
        </p>
      </div>

      {apiError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {apiError}
        </div>
      )}

      {!isSuper ? (
        <div className="rounded-[28px] border border-gray-200 bg-white p-4 text-sm text-gray-500">
          Only super admins can manage organizations and organization admins.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-[28px] border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Organizations
            </h3>

            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search organizations"
                  className="h-12 w-full rounded-2xl border border-gray-200 pl-10 pr-4 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setName("");
                  setSlug("");
                  setShowCreateOrgModal(true);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-600 text-white hover:bg-primary-700"
                title="Create organization"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {orgs.length === 0 ? (
              <p className="text-sm text-gray-500">No organizations yet.</p>
            ) : filteredOrgs.length === 0 ? (
              <p className="text-sm text-gray-500">No organizations match your search.</p>
            ) : (
              <div className="space-y-2">
                {filteredOrgs.map((org) => (
                  <div
                    key={org.id}
                    className={cn(
                      "rounded-2xl border",
                      org.isActive ? "border-gray-200" : "border-gray-100 opacity-60"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedOrgId(expandedOrgId === org.id ? null : org.id)
                      }
                      className="w-full rounded-2xl p-3 text-left transition-colors hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{org.name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {org.slug} ·{" "}
                            {orgAdmins.filter((u) => u.organizationId === org.id).length} admin
                            {orgAdmins.filter((u) => u.organizationId === org.id).length !== 1
                              ? "s"
                              : ""}
                          </p>
                        </div>
                        <span className="text-xs text-gray-400">
                          {expandedOrgId === org.id ? "Hide" : "Manage"}
                        </span>
                      </div>
                    </button>
                    {expandedOrgId === org.id && (
                      <div className="space-y-3 px-3 pb-3">
                        {showCreateAdminForOrgId === org.id ? (
                          <form
                            onSubmit={(e) => createOrgAdmin(e, org.id)}
                            className="grid grid-cols-1 gap-2 rounded-2xl bg-gray-50 p-3 sm:grid-cols-2"
                          >
                            <input
                              type="text"
                              value={newAdminDisplayName}
                              onChange={(e) => setNewAdminDisplayName(e.target.value)}
                              placeholder="Display name"
                              className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm"
                              required
                            />
                            <input
                              type="text"
                              value={newAdminUsername}
                              onChange={(e) => setNewAdminUsername(e.target.value)}
                              placeholder="Username"
                              className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm"
                              required
                            />
                            <input
                              type="password"
                              value={newAdminPassword}
                              onChange={(e) => setNewAdminPassword(e.target.value)}
                              placeholder="Password"
                              className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm"
                              minLength={4}
                              required
                            />
                            <div className="flex gap-2 sm:col-span-2">
                              <button
                                type="submit"
                                disabled={saving}
                                className="rounded-xl bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                              >
                                Create Admin
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowCreateAdminForOrgId(null);
                                  setNewAdminDisplayName("");
                                  setNewAdminUsername("");
                                  setNewAdminPassword("");
                                }}
                                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowCreateAdminForOrgId(org.id)}
                            className="inline-flex items-center gap-1 rounded-xl bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Org Admin
                          </button>
                        )}

                        {orgAdmins.filter((u) => u.organizationId === org.id).length === 0 ? (
                          <p className="text-xs text-gray-500">No admins assigned.</p>
                        ) : (
                          <div className="space-y-2">
                            {orgAdmins
                              .filter((u) => u.organizationId === org.id)
                              .map((u) => (
                                <div
                                  key={u.id}
                                  className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                      {u.displayName}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">@{u.username}</p>
                                  </div>
                                  <select
                                    value={u.organizationId || ""}
                                    onChange={(e) => reassignOrgAdmin(u.id, e.target.value)}
                                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                                  >
                                    {orgs.map((o) => (
                                      <option key={o.id} value={o.id}>
                                        {o.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setResetAdminTarget(u);
                                      setResetAdminPassword("");
                                    }}
                                    className="rounded-lg p-2 text-gray-400 hover:bg-primary-50 hover:text-primary-600"
                                    title="Reset password"
                                  >
                                    <KeyRound className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => removeOrgAdmin(u.id)}
                                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                    title="Remove org admin role"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                          </div>
                        )}
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditing(org)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-primary-50 hover:text-primary-600"
                            title="Edit organization"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeOrg(org)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            title="Delete organization"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showCreateOrgModal && (
        <AppModal
          open={showCreateOrgModal}
          onClose={() => setShowCreateOrgModal(false)}
          maxWidthClassName="max-w-sm"
          showCloseButton
          closeLabel="Close create organization modal"
        >
          <form
            onSubmit={createOrg}
            className="w-full space-y-3"
          >
            <div className="flex items-center justify-between pr-8">
              <h3 className="font-bold text-gray-900">Create Organization</h3>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Organization name"
              className="h-12 w-full rounded-2xl border border-gray-200 px-4 text-sm"
              required
            />
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              placeholder="slug"
              className="h-12 w-full rounded-2xl border border-gray-200 px-4 text-sm"
              required
            />
            {error && <p className="text-sm text-danger-500">{error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className={cn(modalActionButtonClass.primary, "flex-1")}
              >
                {saving ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateOrgModal(false)}
                className={modalActionButtonClass.secondary}
              >
                Cancel
              </button>
            </div>
          </form>
        </AppModal>
      )}

      {resetAdminTarget && (
        <AppModal
          open={Boolean(resetAdminTarget)}
          onClose={() => {
            setResetAdminTarget(null);
            setResetAdminPassword("");
          }}
          maxWidthClassName="max-w-sm"
        >
          <form
            onSubmit={resetOrgAdminPassword}
            className="w-full space-y-3"
          >
            <h3 className="font-bold text-gray-900">Reset Org Admin Password</h3>
            <p className="text-xs text-gray-500">
              Set a new password for <span className="font-medium">{resetAdminTarget.displayName}</span>.
            </p>
            <input
              type="password"
              value={resetAdminPassword}
              onChange={(e) => setResetAdminPassword(e.target.value)}
              placeholder="New password"
              className="h-12 w-full rounded-2xl border border-gray-200 px-4 text-sm"
              minLength={4}
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={resettingAdminPassword}
                className={cn(modalActionButtonClass.primary, "flex-1")}
              >
                {resettingAdminPassword ? "Updating..." : "Update Password"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setResetAdminTarget(null);
                  setResetAdminPassword("");
                }}
                className={modalActionButtonClass.secondary}
              >
                Cancel
              </button>
            </div>
          </form>
        </AppModal>
      )}

      {editing && (
        <AppModal
          open={Boolean(editing)}
          onClose={() => setEditing(null)}
          maxWidthClassName="max-w-sm"
        >
          <form
            onSubmit={saveEdit}
            className="w-full space-y-3"
          >
            <h3 className="font-bold text-gray-900">Edit Organization</h3>
            <input
              type="text"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="h-12 w-full rounded-2xl border border-gray-200 px-4 text-sm"
              required
            />
            <input
              type="text"
              value={editing.slug}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  slug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                })
              }
              className="h-12 w-full rounded-2xl border border-gray-200 px-4 text-sm"
              required
            />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={editing.isActive}
                onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
              />
              Active
            </label>
            {error && <p className="text-sm text-danger-500">{error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className={cn(modalActionButtonClass.primary, "flex-1")}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className={modalActionButtonClass.secondary}
              >
                Cancel
              </button>
            </div>
          </form>
        </AppModal>
      )}
    </div>
  );
}
