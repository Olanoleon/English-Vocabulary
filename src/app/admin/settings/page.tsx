"use client";

import { BookOpen } from "lucide-react";

export default function AdminSettingsPage() {
  return (
    <div className="px-4 py-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Settings</h2>
      <p className="text-sm text-gray-500 mb-6">Application configuration</p>

      <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-900 mb-1">Sequential Unlocking</h3>
          <p className="text-sm text-gray-500">
            Sections are unlocked sequentially. Learners must pass the unit test
            with 80% or higher to unlock the next section.
          </p>
          <div className="mt-3 bg-primary-50 text-primary-700 text-sm px-3 py-2 rounded-lg">
            This setting is enabled by default and cannot be changed.
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-900 mb-1">Pass Threshold</h3>
          <p className="text-sm text-gray-500">
            Minimum score required to pass a unit test and unlock the next section.
          </p>
          <div className="mt-3 text-2xl font-bold text-primary-600">80%</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-900 mb-1">About</h3>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium">VocabPath</p>
              <p className="text-xs text-gray-400">Version 1.0.0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
