"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldOff, CreditCard, LogOut } from "lucide-react";

export default function BlockedPage() {
  const router = useRouter();
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    // Check access status
    fetch("/api/learn/access")
      .then((res) => res.json())
      .then((data) => {
        if (data.hasAccess) {
          // Access restored — redirect back
          router.push("/learn");
          router.refresh();
        } else {
          setReason(data.reason);
        }
      });
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-gray-50 to-white">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          {reason === "payment_overdue" ? (
            <CreditCard className="w-8 h-8 text-red-500" />
          ) : (
            <ShieldOff className="w-8 h-8 text-red-500" />
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Access Paused
        </h1>

        {reason === "payment_overdue" ? (
          <p className="text-gray-500 mb-8">
            Your subscription payment is overdue. Please contact your
            administrator to restore access.
          </p>
        ) : (
          <p className="text-gray-500 mb-8">
            Your access has been temporarily disabled by your administrator.
            Please reach out to them for more information.
          </p>
        )}

        <button
          onClick={handleLogout}
          className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
