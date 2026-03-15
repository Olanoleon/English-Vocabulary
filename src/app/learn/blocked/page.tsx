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
    <div className="min-h-screen bg-white px-6">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center">
        <div className="w-full text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100">
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
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 font-semibold text-white transition-colors hover:bg-gray-800"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
