"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { DAY_LABELS } from "@/lib/constants";
import { minutesToTimeInput, timeInputToMinutes } from "@/lib/format";
import { Alert, Button, Card, Input } from "@/components/ui";
import { apiRequest } from "@/components/dashboard/client";

export type HoursRow = {
  dayOfWeek: number;
  opensAt: number;
  closesAt: number;
  isClosed: boolean;
  note: string;
};

export function HoursEditor({ initialRows }: { initialRows: HoursRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<HoursRow[]>(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  function updateRow(day: number, patch: Partial<HoursRow>) {
    setRows((prev) => prev.map((row) => (row.dayOfWeek === day ? { ...row, ...patch } : row)));
    setSuccess(false);
  }

  function copyMondayToWeekdays() {
    const monday = rows.find((row) => row.dayOfWeek === 1);
    if (!monday) return;
    setRows((prev) =>
      prev.map((row) =>
        row.dayOfWeek >= 1 && row.dayOfWeek <= 5
          ? { ...row, opensAt: monday.opensAt, closesAt: monday.closesAt, isClosed: monday.isClosed }
          : row,
      ),
    );
    setSuccess(false);
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);

    const payload = rows.map((row) => ({
      dayOfWeek: row.dayOfWeek,
      opensAt: row.opensAt,
      closesAt: row.closesAt,
      isClosed: row.isClosed,
      note: row.note,
    }));

    const result = await apiRequest("/api/hours", { method: "PUT", body: payload });
    setSaving(false);

    if (result.ok) {
      setSuccess(true);
      router.refresh();
    } else {
      setError(result.error.formErrors[0] ?? result.error.message);
    }
  }

  return (
    <div className="space-y-4">
      {success ? <Alert tone="success" title="Hours saved">Your weekly schedule is up to date.</Alert> : null}
      {error ? <Alert tone="error" title="Could not save hours">{error}</Alert> : null}

      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={copyMondayToWeekdays}>
          Copy Monday to all weekdays
        </Button>
      </div>

      <Card className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.dayOfWeek}
            className="grid grid-cols-1 items-center gap-3 border-b border-line pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[8rem_auto_1fr]"
          >
            <span className="text-sm font-medium text-ink">{DAY_LABELS[row.dayOfWeek]}</span>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                aria-label={`${DAY_LABELS[row.dayOfWeek]} opening time`}
                value={minutesToTimeInput(row.opensAt)}
                disabled={row.isClosed}
                onChange={(e) => updateRow(row.dayOfWeek, { opensAt: timeInputToMinutes(e.target.value) })}
                className="w-32"
              />
              <span className="text-ink-muted">to</span>
              <Input
                type="time"
                aria-label={`${DAY_LABELS[row.dayOfWeek]} closing time`}
                value={minutesToTimeInput(row.closesAt)}
                disabled={row.isClosed}
                onChange={(e) => updateRow(row.dayOfWeek, { closesAt: timeInputToMinutes(e.target.value) })}
                className="w-32"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={row.isClosed}
                onChange={(e) => updateRow(row.dayOfWeek, { isClosed: e.target.checked })}
                className="h-4 w-4 rounded border-line accent-[var(--color-ember-500)]"
              />
              Closed
            </label>
          </div>
        ))}
      </Card>

      <div>
        <Button type="button" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save hours"}
        </Button>
      </div>
    </div>
  );
}
