"use client";

import { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const modalActionButtonClass = {
  primary:
    "h-11 rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60",
  danger:
    "h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60",
  secondary:
    "h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60",
};

interface AppModalProps {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  maxWidthClassName?: string;
  showCloseButton?: boolean;
  closeLabel?: string;
}

export function AppModal({
  open,
  onClose,
  children,
  maxWidthClassName = "max-w-md",
  showCloseButton = false,
  closeLabel = "Close dialog",
}: AppModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal overlay"
      />
      <div
        className={cn(
          "relative w-full rounded-[30px] border border-slate-200/80 bg-white/98 p-6 shadow-2xl shadow-slate-900/15 animate-scale-in",
          maxWidthClassName
        )}
        role="dialog"
        aria-modal="true"
      >
        {showCloseButton && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label={closeLabel}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );
}
