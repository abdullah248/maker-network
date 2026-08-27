"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { SLOT_STATUSES, type SlotStatus } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
  type BadgeTone,
} from "@/components/ui";
import { apiRequest, firstError, type FieldErrors } from "@/components/dashboard/client";

export type SlotDTO = {
  id: string;
  machineId: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  capacity: number;
  note: string | null;
  machineLabel: string | null;
};

export type MachineOption = { id: string; label: string };

const STATUS_TONE: Record<string, BadgeTone> = {
  OPEN: "moss",
  BOOKED: "blueprint",
  BLOCKED: "clay",
};

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

type FormState = {
  machineId: string;
  startsAt: string;
  endsAt: string;
  status: SlotStatus;
  capacity: string;
  note: string;
};

function emptyForm(): FormState {
  const start = new Date();
  start.setHours(start.getHours() + 1, 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return {
    machineId: "",
    startsAt: toDateTimeLocal(start),
    endsAt: toDateTimeLocal(end),
    status: "OPEN",
    capacity: "1",
    note: "",
  };
}

function MonthGrid({
  year,
  month,
  slots,
}: {
  year: number;
  month: number;
  slots: SlotDTO[];
}) {
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const byDay = new Map<string, SlotDTO[]>();
  for (const slot of slots) {
    const key = dateKey(slot.startsAt);
    const list = byDay.get(key) ?? [];
    list.push(slot);
    byDay.set(key, list);
  }

  const cells: Array<number | null> = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  return (
    <Card className="p-4">
      <p className="mb-3 text-sm font-semibold text-ink">{monthLabel}</p>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-ink-muted">
        {WEEKDAY_HEADERS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (day === null) return <div key={`empty-${index}`} className="min-h-14 rounded-md" />;
          const key = `${year}-${month}-${day}`;
          const daySlots = byDay.get(key) ?? [];
          return (
            <div
              key={key}
              className="min-h-14 rounded-md border border-line bg-surface p-1 text-left"
            >
              <span className="text-[11px] font-medium text-ink-muted">{day}</span>
              <div className="mt-0.5 space-y-0.5">
                {daySlots.slice(0, 3).map((slot) => (
                  <div
                    key={slot.id}
                    title={`${new Date(slot.startsAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })} · ${slot.status}`}
                    className="truncate rounded px-1 text-[10px] font-medium"
                    style={{ backgroundColor: "var(--color-surface-muted)" }}
                  >
                    <span
                      aria-hidden
                      className={
                        slot.status === "OPEN"
                          ? "mr-1 inline-block h-1.5 w-1.5 rounded-full bg-moss-600 align-middle"
                          : slot.status === "BOOKED"
                            ? "mr-1 inline-block h-1.5 w-1.5 rounded-full bg-blueprint-600 align-middle"
                            : "mr-1 inline-block h-1.5 w-1.5 rounded-full bg-clay-600 align-middle"
                      }
                    />
                    {new Date(slot.startsAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                ))}
                {daySlots.length > 3 ? (
                  <div className="px-1 text-[10px] text-ink-muted">+{daySlots.length - 3} more</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function AvailabilityManager({
  monthParam,
  baseYear,
  baseMonth,
  calendarSlots,
  upcomingSlots: initialUpcoming,
  machines,
}: {
  monthParam: string;
  baseYear: number;
  baseMonth: number;
  calendarSlots: SlotDTO[];
  upcomingSlots: SlotDTO[];
  machines: MachineOption[];
}) {
  const router = useRouter();
  const [upcoming, setUpcoming] = useState<SlotDTO[]>(initialUpcoming);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nextMonthDate = useMemo(() => new Date(baseYear, baseMonth + 1, 1), [baseYear, baseMonth]);
  const prevMonthDate = useMemo(() => new Date(baseYear, baseMonth - 1, 1), [baseYear, baseMonth]);

  function monthHref(date: Date): string {
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return `/dashboard/availability?month=${value}`;
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setFormError(null);

    const payload = {
      machineId: form.machineId || undefined,
      startsAt: form.startsAt,
      endsAt: form.endsAt,
      status: form.status,
      capacity: form.capacity,
      note: form.note,
    };

    const result = await apiRequest<SlotDTO>("/api/availability", { method: "POST", body: payload });
    setSubmitting(false);

    if (!result.ok) {
      setErrors(result.error.fieldErrors);
      setFormError(result.error.formErrors[0] ?? result.error.message);
      return;
    }

    setShowForm(false);
    setForm(emptyForm());
    router.refresh();
  }

  async function onDelete(slot: SlotDTO) {
    if (!window.confirm("Delete this availability slot?")) return;
    const result = await apiRequest(`/api/availability/${slot.id}`, { method: "DELETE" });
    if (result.ok) {
      setUpcoming((prev) => prev.filter((s) => s.id !== slot.id));
      router.refresh();
    } else {
      window.alert(result.error.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={monthHref(prevMonthDate)} className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted">
            ← Prev
          </Link>
          <Link href={monthHref(nextMonthDate)} className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted">
            Next →
          </Link>
          <span className="text-xs text-ink-muted">Viewing {monthParam}</span>
        </div>
        {!showForm ? <Button onClick={() => setShowForm(true)}>Add slot</Button> : null}
      </div>

      {showForm ? (
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold text-ink">Add an availability slot</h3>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Machine (optional)" htmlFor="machineId" hint="Leave blank for a general slot.">
              <Select id="machineId" value={form.machineId} onChange={(e) => update("machineId", e.target.value)}>
                <option value="">Any / general</option>
                {machines.map((machine) => (
                  <option key={machine.id} value={machine.id}>
                    {machine.label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts at" htmlFor="startsAt" required error={firstError(errors, "startsAt")}>
                <Input id="startsAt" type="datetime-local" value={form.startsAt} onChange={(e) => update("startsAt", e.target.value)} />
              </Field>
              <Field label="Ends at" htmlFor="endsAt" required error={firstError(errors, "endsAt")}>
                <Input id="endsAt" type="datetime-local" value={form.endsAt} onChange={(e) => update("endsAt", e.target.value)} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status" htmlFor="status" error={firstError(errors, "status")}>
                <Select id="status" value={form.status} onChange={(e) => update("status", e.target.value as SlotStatus)}>
                  {SLOT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Capacity" htmlFor="capacity" error={firstError(errors, "capacity")}>
                <Input id="capacity" type="number" min={1} max={100} value={form.capacity} onChange={(e) => update("capacity", e.target.value)} />
              </Field>
            </div>

            <Field label="Note" htmlFor="note" error={firstError(errors, "note")}>
              <Textarea id="note" value={form.note} onChange={(e) => update("note", e.target.value)} />
            </Field>

            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Add slot"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <MonthGrid year={baseYear} month={baseMonth} slots={calendarSlots} />
        <MonthGrid year={nextMonthDate.getFullYear()} month={nextMonthDate.getMonth()} slots={calendarSlots} />
      </div>

      <div>
        <h3 className="mb-3 text-lg font-semibold text-ink">Upcoming slots</h3>
        {upcoming.length === 0 ? (
          <EmptyState
            title="No upcoming slots"
            description="Add availability so customers can book time on your machines."
          />
        ) : (
          <div className="space-y-3">
            {upcoming.map((slot) => (
              <Card key={slot.id} className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink">
                      {formatDateTime(slot.startsAt)} → {formatDateTime(slot.endsAt)}
                    </p>
                    <Badge tone={STATUS_TONE[slot.status] ?? "neutral"}>{slot.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    {slot.machineLabel ? `${slot.machineLabel} · ` : ""}
                    Capacity {slot.capacity}
                    {slot.note ? ` · ${slot.note}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="danger" onClick={() => onDelete(slot)}>
                  Delete
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
