"use client";

import { useEffect, useState, useMemo } from "react";
import {
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Gift,
  ChevronDown,
  ChevronUp,
  Clock,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppModal, modalActionButtonClass } from "@/components/app-modal";

type PaymentStatus = "free_trial" | "settled" | "past_due";

interface PaymentRecord {
  id: string;
  amount: number;
  paidAt: string;
  note: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

interface Learner {
  id: string;
  username: string;
  displayName: string;
  avatarGender: "female" | "male" | null;
  monthlyRate: number;
  nextPaymentDue: string | null;
  lastPaymentDate: string | null;
  createdAt: string;
  paymentStatus: PaymentStatus;
  payments: PaymentRecord[];
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

type FilterTab = "all" | "settled" | "past_due" | "free_trial";

const STATUS_CONFIG: Record<
  PaymentStatus,
  { label: string; color: string; bg: string; icon: typeof CheckCircle2 }
> = {
  settled: {
    label: "Settled",
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
    icon: CheckCircle2,
  },
  past_due: {
    label: "Past Due",
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
    icon: AlertTriangle,
  },
  free_trial: {
    label: "Free Trial",
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    icon: Gift,
  },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PaymentStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex h-10 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold leading-none",
        config.bg,
        config.color
      )}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

// ─── Record Payment Modal ─────────────────────────────────────────────────────

function RecordPaymentForm({
  learner,
  onClose,
  onSaved,
  onError,
}: {
  learner: Learner;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [amount, setAmount] = useState(
    learner.monthlyRate > 0 ? String(learner.monthlyRate) : ""
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/admin/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: learner.id,
        amount: Number(amount),
        note: note || undefined,
      }),
    });
    if (res.ok) {
      onSaved();
    } else {
      onError("Failed to record payment.");
    }
    setSaving(false);
  }

  return (
    <AppModal open onClose={onClose} maxWidthClassName="max-w-md">
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">
          Record Payment
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          for {learner.displayName}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">
              Amount ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. Cash payment, Bank transfer"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className={cn(modalActionButtonClass.primary, "flex-1")}
            >
              {saving ? "Saving..." : "Record Payment"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={modalActionButtonClass.secondary}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </AppModal>
  );
}

// ─── Edit Rate Modal ──────────────────────────────────────────────────────────

function EditRateForm({
  learner,
  onClose,
  onSaved,
  onError,
}: {
  learner: Learner;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [rate, setRate] = useState(String(learner.monthlyRate));
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/admin/payments/${learner.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyRate: Number(rate) }),
    });
    if (res.ok) {
      onSaved();
    } else {
      onError("Failed to update monthly rate.");
    }
    setSaving(false);
  }

  return (
    <AppModal open onClose={onClose} maxWidthClassName="max-w-md">
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">
          Set Monthly Rate
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          for {learner.displayName} — set to $0 for free trial
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">
              Monthly Rate ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="0.00"
              required
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className={cn(modalActionButtonClass.primary, "flex-1")}
            >
              {saving ? "Saving..." : "Update Rate"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={modalActionButtonClass.secondary}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </AppModal>
  );
}

// ─── Learner Payment Card ─────────────────────────────────────────────────────

function LearnerCard({
  learner,
  onRecordPayment,
  onEditRate,
}: {
  learner: Learner;
  onRecordPayment: () => void;
  onEditRate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const avatarSrc =
    learner.avatarGender === "male"
      ? "/images/library/humanbody_male.png"
      : "/images/library/humanbody_femaleface.png";

  return (
    <div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm">
      {/* Main row */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-gray-100">
              <img
                src={avatarSrc}
                alt={`${learner.displayName} avatar`}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/images/library/humanbody_femaleface.png";
                }}
              />
            </div>
            <div>
              <p className="truncate font-semibold text-gray-900">
                {learner.displayName}
              </p>
              <p className="truncate text-xs text-gray-500">@{learner.username}</p>
            </div>
          </div>
        </div>

        {/* Payment info */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl bg-gray-50 px-3 py-2">
            <p className="text-gray-500">Monthly Rate</p>
            <p className="font-semibold text-gray-900">
              {learner.monthlyRate > 0
                ? formatCurrency(learner.monthlyRate)
                : "Free"}
            </p>
          </div>
          <div className="rounded-2xl bg-gray-50 px-3 py-2">
            <p className="text-gray-500">Next Due</p>
            <p
              className={cn(
                "font-semibold",
                learner.paymentStatus === "past_due"
                  ? "text-red-600"
                  : "text-gray-900"
              )}
            >
              {learner.monthlyRate > 0
                ? formatDate(learner.nextPaymentDue)
                : "—"}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2">
          {learner.monthlyRate > 0 && (
            <button
              onClick={onRecordPayment}
              className="flex h-10 flex-1 items-center justify-center gap-1 rounded-2xl bg-green-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-green-700"
            >
              <DollarSign className="w-3.5 h-3.5" />
              Record Payment
            </button>
          )}
          <button
            onClick={onEditRate}
            className="h-10 flex-1 rounded-2xl bg-gray-100 px-3 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-200"
          >
            {learner.monthlyRate > 0 ? "Edit Rate" : "Set Rate"}
          </button>
          <StatusBadge status={learner.paymentStatus} />
          {learner.payments.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              title="Payment history"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Payment history (expanded) */}
      {expanded && learner.payments.length > 0 && (
        <div className="animate-scale-in border-t border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
            <Receipt className="w-3 h-3" /> Recent Payments
          </p>
          <div className="space-y-2">
            {learner.payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-600">
                    {formatDate(payment.paidAt)}
                  </span>
                  {payment.note && (
                    <span className="text-gray-400">· {payment.note}</span>
                  )}
                </div>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(payment.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [sessionMe, setSessionMe] = useState<SessionMe | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [paymentTarget, setPaymentTarget] = useState<Learner | null>(null);
  const [rateTarget, setRateTarget] = useState<Learner | null>(null);
  const [apiError, setApiError] = useState("");

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
      await fetchData(initialOrgId || undefined);
    } catch {
      setApiError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchData(orgId?: string) {
    setApiError("");
    const query = orgId ? `?organizationId=${encodeURIComponent(orgId)}` : "";
    const res = await fetch(`/api/admin/payments${query}`);
    if (res.ok) {
      setLearners(await res.json());
    } else {
      setLearners([]);
      setApiError(await readApiError(res, "Failed to load payments."));
    }
  }

  function handlePaymentSaved() {
    setPaymentTarget(null);
    void fetchData(selectedOrgId || undefined);
  }

  function handleRateSaved() {
    setRateTarget(null);
    void fetchData(selectedOrgId || undefined);
  }

  const filtered = useMemo(() => {
    if (activeFilter === "all") return learners;
    return learners.filter((l) => l.paymentStatus === activeFilter);
  }, [learners, activeFilter]);

  const counts = useMemo(() => {
    const settled = learners.filter((l) => l.paymentStatus === "settled").length;
    const pastDue = learners.filter(
      (l) => l.paymentStatus === "past_due"
    ).length;
    const freeTrial = learners.filter(
      (l) => l.paymentStatus === "free_trial"
    ).length;
    const monthlyRevenue = learners
      .filter((l) => l.paymentStatus === "settled")
      .reduce((sum, l) => sum + l.monthlyRate, 0);
    return { settled, pastDue, freeTrial, monthlyRevenue, total: learners.length };
  }, [learners]);

  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.total },
    { key: "settled", label: "Settled", count: counts.settled },
    { key: "past_due", label: "Past Due", count: counts.pastDue },
    { key: "free_trial", label: "Free Trial", count: counts.freeTrial },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-6 pb-24">
      {/* Header */}
      <div>
        <h2 className="text-[28px] font-bold leading-none text-gray-900">Payments</h2>
        <p className="mt-2 text-sm text-gray-500">
          Track and manage monthly learner payments
        </p>
      </div>
      {apiError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {apiError}
        </div>
      )}

      {(sessionMe?.role === "super_admin" || sessionMe?.role === "admin") &&
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
                void fetchData(orgId || undefined);
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

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[24px] bg-green-50 p-4">
          <p className="text-xs font-medium text-green-600 uppercase">
            Monthly Revenue
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(counts.monthlyRevenue)}
          </p>
        </div>
        <div className="rounded-[24px] bg-red-50 p-4">
          <p className="text-xs font-medium text-red-600 uppercase">
            Past Due
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {counts.pastDue}
            <span className="text-sm font-normal text-gray-500 ml-1">
              learner{counts.pastDue !== 1 ? "s" : ""}
            </span>
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 rounded-2xl bg-gray-100 p-1">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={cn(
              "flex-1 rounded-xl py-2 text-xs font-semibold transition-all",
              activeFilter === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.label}
            <span
              className={cn(
                "ml-1",
                activeFilter === tab.key ? "text-primary-600" : "text-gray-400"
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Learner List */}
      <div className="space-y-3">
        {filtered.map((learner) => (
          <LearnerCard
            key={learner.id}
            learner={learner}
            onRecordPayment={() => setPaymentTarget(learner)}
            onEditRate={() => setRateTarget(learner)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-[28px] border border-dashed border-gray-200 py-12 text-center">
          <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {activeFilter === "all"
              ? "No learners yet."
              : `No ${activeFilter.replace("_", " ")} learners.`}
          </p>
        </div>
      )}

      {/* Modals */}
      {paymentTarget && (
        <RecordPaymentForm
          learner={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onSaved={handlePaymentSaved}
          onError={setApiError}
        />
      )}
      {rateTarget && (
        <EditRateForm
          learner={rateTarget}
          onClose={() => setRateTarget(null)}
          onSaved={handleRateSaved}
          onError={setApiError}
        />
      )}
    </div>
  );
}
