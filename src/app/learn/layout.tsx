"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, BarChart3, User, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/learn", label: "Learning", icon: BookOpen },
  { href: "/learn/stats", label: "Stats", icon: BarChart3 },
  { href: "/learn/profile", label: "Profile", icon: User },
];

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Don't show nav on section detail/module pages
  const showNav = pathname === "/learn" || pathname === "/learn/stats" || pathname === "/learn/profile";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Content */}
      <main className={cn("flex-1 overflow-y-auto", showNav && "pb-20")}>
        {children}
      </main>

      {/* Bottom Nav */}
      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 pb-safe z-30">
          <div className="max-w-lg mx-auto flex">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors",
                    isActive
                      ? "text-primary-600"
                      : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  <Icon className="w-5 h-5 mb-0.5" />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              className="flex-1 flex flex-col items-center py-2 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
            >
              <LogOut className="w-5 h-5 mb-0.5" />
              Logout
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
