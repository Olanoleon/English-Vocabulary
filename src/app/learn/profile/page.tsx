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
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>

      {/* User Info */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 text-center mb-6">
        <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <UserCircle className="w-12 h-12 text-primary-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">
          {user?.displayName || "..."}
        </h2>
        <p className="text-sm text-gray-500">@{user?.username || "..."}</p>
      </div>

      {/* App Info */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
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
        className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
      >
        <LogOut className="w-5 h-5" />
        Sign Out
      </button>
    </div>
  );
}
