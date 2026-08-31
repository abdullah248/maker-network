"use client";

import {
  PROCESSES,
  PROCESS_DESCRIPTIONS,
  PROCESS_LABELS,
  type Process,
} from "@/lib/print-specs";
import { cn } from "@/components/ui";

export function ProcessPicker({
  value,
  onChange,
}: {
  value: Process;
  onChange: (process: Process) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">Fabrication process</legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PROCESSES.map((process) => {
          const active = value === process;
          return (
            <label
              key={process}
              className={cn(
                "flex cursor-pointer flex-col rounded-xl border p-4 transition-colors",
                active
                  ? "border-ember-500 bg-ember-50 shadow-sm"
                  : "border-line bg-surface hover:bg-surface-muted",
              )}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="process"
                  value={process}
                  checked={active}
                  onChange={() => onChange(process)}
                  className="h-4 w-4 accent-[var(--color-ember-500)]"
                />
                <span className="text-sm font-semibold text-ink">
                  {PROCESS_LABELS[process]}
                </span>
              </span>
              <span className="mt-2 text-xs text-ink-muted">
                {PROCESS_DESCRIPTIONS[process]}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
