"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { isAdminRole } from "@/lib/roles";

interface LoginMembershipOption {
  membershipId: string;
  role: string;
  organizationId: string | null;
  organizationName: string | null;
}

// ─── Verification Code Input ──────────────────────────────────────────────────

function CodeInput({
  onComplete,
}: {
  onComplete: (code: string) => void;
}) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function handleChange(index: number, value: string) {
    // Only accept digits
    const digit = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (digit && index === 5) {
      const code = newDigits.join("");
      if (code.length === 6) {
        onComplete(code);
      }
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 0) return;

    const newDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || "";
    }
    setDigits(newDigits);

    // Focus the next empty input or the last one
    const nextEmpty = newDigits.findIndex((d) => !d);
    inputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();

    if (pasted.length === 6) {
      onComplete(pasted);
    }
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="w-12 h-14 text-center text-xl font-bold border border-gray-200 rounded-xl bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
        />
      ))}
    </div>
  );
}

// ─── Main Login Page ──────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [uiReady, setUiReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Role selection step state
  const [roleStep, setRoleStep] = useState(false);
  const [challengeToken, setChallengeToken] = useState("");
  const [membershipOptions, setMembershipOptions] = useState<LoginMembershipOption[]>([]);
  const [selectingRole, setSelectingRole] = useState(false);

  // Verification step state
  const [verifyStep, setVerifyStep] = useState(false);
  const [pendingUserId, setPendingUserId] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setUiReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!uiReady) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-b from-primary-50 to-white">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-primary-600" />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      if (data.requireRoleSelection) {
        setChallengeToken(data.challengeToken);
        setMembershipOptions(Array.isArray(data.memberships) ? data.memberships : []);
        setRoleStep(true);
        setLoading(false);
        return;
      }

      // Admin needs verification
      if (data.requireVerification) {
        setPendingUserId(data.userId);
        setVerifyStep(true);
        setResendCooldown(30);
        setLoading(false);
        return;
      }

      // Route by role
      router.push(isAdminRole(data.activeRole || data.role) ? "/admin" : "/learn");
      router.refresh();
    } catch {
      setError("Connection error. Please try again.");
      setLoading(false);
    }
  }

  async function handleSelectRole(membershipId: string) {
    if (!challengeToken || selectingRole) return;
    setSelectingRole(true);
    setError("");
    try {
      const res = await fetch("/api/auth/select-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken, membershipId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to continue login");
        setSelectingRole(false);
        return;
      }
      if (data.requireVerification) {
        setPendingUserId(data.userId);
        setRoleStep(false);
        setVerifyStep(true);
        setResendCooldown(30);
        setSelectingRole(false);
        return;
      }
      router.push(isAdminRole(data.activeRole || data.role) ? "/admin" : "/learn");
      router.refresh();
    } catch {
      setError("Connection error. Please try again.");
      setSelectingRole(false);
    }
  }

  async function handleVerify(code: string) {
    setVerifyError("");
    setVerifying(true);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: pendingUserId, code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setVerifyError(data.error || "Verification failed");
        setVerifying(false);
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setVerifyError("Connection error. Please try again.");
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setVerifyError("");

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: pendingUserId, resend: true }),
      });

      if (res.ok) {
        setResendCooldown(30);
      } else {
        const data = await res.json();
        setVerifyError(data.error || "Failed to resend code");
      }
    } catch {
      setVerifyError("Connection error");
    }
  }

  function handleBack() {
    setVerifyStep(false);
    setRoleStep(false);
    setChallengeToken("");
    setMembershipOptions([]);
    setPendingUserId("");
    setVerifyError("");
    setPassword("");
  }

  function formatRoleLabel(role: string) {
    if (role === "super_admin") return "Super Admin";
    if (role === "org_admin") return "Org Admin";
    if (role === "admin") return "Admin";
    if (role === "learner") return "Learner";
    return role;
  }

  // ── Verification Step UI ─────────────────────────────────────────────
  if (verifyStep) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-primary-50 to-white">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Verify Your Identity
            </h1>
            <p className="text-sm text-gray-500 mt-2 text-center">
              We sent a 6-digit code to your email.
              <br />
              Enter it below to continue.
            </p>
          </div>

          <div className="mb-6">
            <CodeInput onComplete={handleVerify} />
          </div>

          {verifyError && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm animate-scale-in mb-4 text-center">
              {verifyError}
            </div>
          )}

          {verifying && (
            <div className="text-center text-sm text-gray-500 mb-4">
              Verifying...
            </div>
          )}

          <div className="text-center space-y-3">
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : "Resend code"}
            </button>

            <div>
              <button
                onClick={handleBack}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1 mx-auto transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (roleStep) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-primary-50 to-white">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Choose Role</h1>
            <p className="text-sm text-gray-500 mt-2 text-center">
              This e-mail has multiple memberships.
              <br />
              Select one to continue.
            </p>
          </div>
          <div className="space-y-2 mb-4">
            {membershipOptions.map((option) => (
              <button
                key={option.membershipId}
                type="button"
                onClick={() => handleSelectRole(option.membershipId)}
                disabled={selectingRole}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left hover:bg-gray-50 disabled:opacity-60"
              >
                <p className="text-sm font-semibold text-gray-900">{formatRoleLabel(option.role)}</p>
                {option.organizationName ? (
                  <p className="text-xs text-gray-500 mt-0.5">{option.organizationName}</p>
                ) : null}
              </button>
            ))}
          </div>
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm animate-scale-in mb-4 text-center">
              {error}
            </div>
          )}
          <button
            onClick={handleBack}
            className="text-sm text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1 mx-auto transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to login
          </button>
        </div>
      </div>
    );
  }

  // ── Login Form UI ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-primary-50 to-white">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-24 h-24 rounded-2xl flex items-center justify-center mb-4 shadow-lg overflow-hidden bg-white border border-primary-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/library/english_flags.png"
              alt="VocabPath logo"
              className="h-full w-full object-cover"
            />
          </div>
          <h1 className="text-[2.05rem] font-bold tracking-tight text-primary-700">
            <span className="inline-block animate-title-breathe">VocabPath</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            English Vocabulary Practice
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              E-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-50 text-gray-900 placeholder-gray-400"
              placeholder="Enter your e-mail"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-50 text-gray-900 placeholder-gray-400"
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm animate-scale-in">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-8">
          Contact your administrator for account access
        </p>
      </div>
    </div>
  );
}
