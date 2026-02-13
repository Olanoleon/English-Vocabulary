"use client";

import { useEffect, useState, useMemo } from "react";
import {
  DollarSign,
  UserCircle,
  CheckCircle2,
  AlertTriangle,
  Gift,
  ChevronDown,
  ChevronUp,
  Clock,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  monthlyRate: number;
  nextPaymentDue: string | null;
  lastPaymentDate: string | null;
  createdAt: string;
  paymentStatus: PaymentStatus;
  payments: PaymentRecord[];
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
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
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
}: {
  learner: Learner;
  onClose: () => void;
  onSaved: () => void;
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
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 animate-scale-in">
        <h3 className="text-lg font-bold text-gray-900 mb-1">
          Record Payment
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          for {learner.displayName}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Amount ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-primary-500 focus:outline-none"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-primary-500 focus:outline-none"
              placeholder="e.g. Cash payment, Bank transfer"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Record Payment"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-gray-600 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Rate Modal ──────────────────────────────────────────────────────────

function EditRateForm({
  learner,
  onClose,
  onSaved,
}: {
  learner: Learner;
  onClose: () => void;
  onSaved: () => void;
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
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 animate-scale-in">
        <h3 className="text-lg font-bold text-gray-900 mb-1">
          Set Monthly Rate
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          for {learner.displayName} — set to $0 for free trial
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Monthly Rate ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-primary-500 focus:outline-none"
              placeholder="0.00"
              required
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Update Rate"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-gray-600 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
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

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Main row */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "rounded-full p-2",
                learner.paymentStatus === "past_due"
                  ? "bg-red-100"
                  : learner.paymentStatus === "settled"
                  ? "bg-green-100"
                  : "bg-blue-100"
              )}
            >
              <UserCircle
                className={cn(
                  "w-5 h-5",
                  learner.paymentStatus === "past_due"
                    ? "text-red-600"
                    : learner.paymentStatus === "settled"
                    ? "text-green-600"
                    : "text-blue-600"
                )}
              />
            </div>
            <div>
              <p className="font-semibold text-gray-900">
                {learner.displayName}
              </p>
              <p className="text-xs text-gray-500">@{learner.username}</p>
            </div>
          </div>
          <StatusBadge status={learner.paymentStatus} />
        </div>

        {/* Payment info */}
        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-gray-500">Monthly Rate</p>
            <p className="font-semibold text-gray-900">
              {learner.monthlyRate > 0
                ? formatCurrency(learner.monthlyRate)
                : "Free"}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2">
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
        <div className="flex gap-2 mt-3">
          {learner.monthlyRate > 0 && (
            <button
              onClick={onRecordPayment}
              className="flex-1 bg-green-600 text-white py-2 rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
            >
              <DollarSign className="w-3.5 h-3.5" />
              Record Payment
            </button>
          )}
          <button
            onClick={onEditRate}
            className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-colors"
          >
            {learner.monthlyRate > 0 ? "Edit Rate" : "Set Rate"}
          </button>
          {learner.payments.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
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
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 animate-scale-in">
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
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [paymentTarget, setPaymentTarget] = useState<Learner | null>(null);
  const [rateTarget, setRateTarget] = useState<Learner | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const res = await fetch("/api/admin/payments");
    if (res.ok) {
      setLearners(await res.json());
    }
    setLoading(false);
  }

  function handlePaymentSaved() {
    setPaymentTarget(null);
    fetchData();
  }

  function handleRateSaved() {
    setRateTarget(null);
    fetchData();
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
    <div className="px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Payments</h2>
        <p className="text-sm text-gray-500 mt-1">
          Track and manage monthly learner payments
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-xs font-medium text-green-600 uppercase">
            Monthly Revenue
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(counts.monthlyRevenue)}
          </p>
        </div>
        <div className="bg-red-50 rounded-xl p-4">
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
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-medium transition-all",
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
        <div className="text-center py-12">
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
        />
      )}
      {rateTarget && (
        <EditRateForm
          learner={rateTarget}
          onClose={() => setRateTarget(null)}
          onSaved={handleRateSaved}
        />
      )}
    </div>
  );
}
