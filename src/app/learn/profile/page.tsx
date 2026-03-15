"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserCircle, LogOut, BookOpen } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<{
    displayName: string;
    username: string;
  } | null>(null);

  useEffect(() => {
    async function fetchMe() {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        setUser(await res.json());
      }
    }
    fetchMe();
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-4 px-4 py-6">
      <h1 className="text-[28px] font-bold leading-none text-gray-900">Profile</h1>

      {/* User Info */}
      <div className="rounded-[28px] border border-gray-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-[24px] bg-primary-100">
          <UserCircle className="w-12 h-12 text-primary-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">
          {user?.displayName || "..."}
        </h2>
        <p className="text-sm text-gray-500">@{user?.username || "..."}</p>
      </div>

      {/* App Info */}
      <div className="rounded-[28px] border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">VocabPath</p>
            <p className="text-xs text-gray-400">
              English Vocabulary for Spanish Speakers
            </p>
          </div>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gray-100 font-semibold text-gray-700 transition-colors hover:bg-gray-200"
      >
        <LogOut className="w-5 h-5" />
        Sign Out
      </button>
    </div>
  );
}
