"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AppSelectOption {
  value: string;
  label: string;
}

interface AppSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: AppSelectOption[];
  placeholder: string;
  className?: string;
  menuClassName?: string;
}

export function AppSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
  menuClassName,
}: AppSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handleOutsideClick(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-primary-500",
          className
        )}
      >
        <span className={selectedOption ? "text-slate-900" : "text-slate-500"}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-slate-500 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? (
        <div
          className={cn(
            "absolute left-0 right-0 top-full z-[70] mt-1 max-h-56 overflow-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl",
            menuClassName
          )}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value || "__empty__"}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  isSelected
                    ? "bg-primary-50 text-primary-700"
                    : "text-slate-700 hover:bg-slate-50"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
