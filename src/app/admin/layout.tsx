"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Building2,
  DollarSign,
  LayoutGrid,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Areas", icon: LayoutGrid },
  { href: "/admin/learners", label: "Learners", icon: Users },
  { href: "/admin/payments", label: "Payments", icon: DollarSign },
  { href: "/admin/orgs", label: "Orgs", icon: Building2 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/auth/me");
          if (!res.ok) return;
          const data = (await res.json()) as { role?: string };
          if (typeof data.role === "string") {
            setRole(data.role);
          }
        } catch {
          // Ignore fetch errors and keep default navigation.
        }
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const visibleNavItems =
    role === "org_admin"
      ? navItems.filter((item) => item.href !== "/admin/orgs")
      : navItems;

  return (
    <div className="min-h-screen bg-[#f5f7f8]">
      <main className="mx-auto min-h-screen max-w-md overflow-y-auto pb-28">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 pb-3 pt-2 backdrop-blur-md">
        <div className="mx-auto flex max-w-md">
          {visibleNavItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin" ||
                  pathname.startsWith("/admin/areas") ||
                  pathname.startsWith("/admin/sections") ||
                  pathname.startsWith("/admin/preview")
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center justify-end gap-1 py-1 text-[10px] uppercase tracking-wider transition-colors",
                  isActive
                    ? "font-bold text-primary-600"
                    : "font-medium text-slate-400 hover:text-slate-600"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
