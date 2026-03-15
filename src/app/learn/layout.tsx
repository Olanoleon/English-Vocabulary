"use client";

import { useEffect } from "react";
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

  // Check access on every navigation (skip for /learn/blocked itself)
  useEffect(() => {
    if (pathname === "/learn/blocked") return;

    fetch("/api/learn/access")
      .then((res) => res.json())
      .then((data) => {
        if (!data.hasAccess) {
          router.push("/learn/blocked");
        }
      })
      .catch(() => {});
  }, [pathname, router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Content */}
      <main className={cn("mx-auto w-full max-w-md overflow-y-auto", showNav && "pb-24")}>
        {children}
      </main>

      {/* Bottom Nav */}
      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-100 bg-white/95 pb-3 pt-2 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-md">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-1 flex-col items-center py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    isActive
                      ? "text-primary-600"
                      : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  <Icon className="mb-1 h-[18px] w-[18px]" />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              className="flex flex-1 flex-col items-center py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 transition-colors hover:text-gray-600"
            >
              <LogOut className="mb-1 h-[18px] w-[18px]" />
              Logout
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
