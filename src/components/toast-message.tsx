"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToastMessageProps {
  open: boolean;
  status: "success" | "failed";
  message: string;
}

export function ToastMessage({ open, status, message }: ToastMessageProps) {
  if (!open || !message) return null;

  const isSuccess = status === "success";
  const title = isSuccess ? "Success!" : "Failed!";

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 w-full max-w-md pointer-events-none">
      <div
        className={cn(
          "rounded-xl border shadow-sm px-3 py-2.5 flex items-center gap-2 animate-scale-in pointer-events-auto",
          isSuccess
            ? "bg-green-50 border-green-200 text-green-700"
            : "bg-red-50 border-red-200 text-red-700"
        )}
        role="status"
        aria-live="polite"
      >
        {isSuccess ? (
          <CheckCircle2 className="w-4 h-4 shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold">{title}</p>
          <p className="text-xs truncate">{message}</p>
        </div>
      </div>
    </div>
  );
}
