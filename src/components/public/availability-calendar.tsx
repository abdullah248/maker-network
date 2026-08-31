import { Badge, EmptyState } from "@/components/ui";
import { cn } from "@/components/ui";
import type { listAvailability } from "@/lib/services/inventory";

type Slot = Awaited<ReturnType<typeof listAvailability>>[number];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function slotTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
}

function statusTone(status: string) {
  if (status === "OPEN") return "moss" as const;
  if (status === "BOOKED") return "blueprint" as const;
  return "neutral" as const;
}

function statusLabel(status: string) {
  if (status === "OPEN") return "Open";
  if (status === "BOOKED") return "Booked";
  return "Blocked";
}

export function AvailabilityCalendar({
  slots,
  from,
  to,
}: {
  slots: Slot[];
  from: Date;
  to: Date;
}) {
  if (slots.length === 0) {
    return (
      <EmptyState
        title="No published availability yet"
        description="This provider hasn't opened up any booking slots for the next few weeks. Send a request to ask about timing."
      />
    );
  }

  const byDay = new Map<string, Slot[]>();
  for (const slot of slots) {
    const key = dayKey(new Date(slot.startsAt));
    const list = byDay.get(key) ?? [];
    list.push(slot);
    byDay.set(key, list);
  }

  // Grid starts on the Sunday on/before `from` and covers whole weeks through `to`.
  const gridStart = startOfDay(from);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = startOfDay(to);
  const totalDays = Math.ceil((gridEnd.getTime() - gridStart.getTime()) / 86_400_000) + 1;
  const weeks = Math.ceil(totalDays / 7);
  const todayKey = dayKey(new Date());
  const rangeStartDay = startOfDay(from).getTime();
  const rangeEndDay = startOfDay(to).getTime();

  const cells: Date[] = [];
  for (let i = 0; i < weeks * 7; i += 1) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((label) => (
          <div key={label} className="pb-1 text-xs font-semibold uppercase text-ink-muted">
            <span aria-hidden>{label}</span>
            <span className="sr-only">{label}</span>
          </div>
        ))}
        {cells.map((date) => {
          const key = dayKey(date);
          const daySlots = byDay.get(key) ?? [];
          const inRange = date.getTime() >= rangeStartDay && date.getTime() <= rangeEndDay;
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              className={cn(
                "min-h-20 rounded-lg border p-1.5 text-left",
                inRange ? "border-line bg-surface" : "border-transparent bg-surface-muted/40",
                daySlots.length > 0 && "border-moss-100 bg-moss-100/40",
                isToday && "ring-2 ring-blueprint-500",
              )}
            >
              <div className="text-xs font-medium text-ink-muted">{date.getDate()}</div>
              {daySlots.length > 0 ? (
                <ul className="mt-1 space-y-1">
                  {daySlots.map((slot) => (
                    <li key={slot.id}>
                      <Badge tone={statusTone(slot.status)} className="w-full justify-start">
                        <span className="truncate">
                          {slotTime(new Date(slot.startsAt))} · {statusLabel(slot.status)}
                        </span>
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-moss-600" /> Open
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-blueprint-500" /> Booked
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-ink-muted" /> Blocked
        </span>
      </div>
    </div>
  );
}
