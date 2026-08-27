import { cn } from "@/components/ui";
import { dayLabel, formatMinutes } from "@/lib/format";
import type { PublicProfile } from "@/lib/services/profiles";

type Hours = PublicProfile["operatingHours"][number];

export function HoursTable({ hours }: { hours: Hours[] }) {
  const today = new Date().getDay();
  const byDay = new Map<number, Hours>();
  for (const entry of hours) byDay.set(entry.dayOfWeek, entry);

  // A maker who has not published a schedule is not "closed all week" — say so
  // explicitly rather than showing seven misleading Closed rows.
  if (hours.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        This maker hasn&apos;t published set opening hours. Send a request to agree on timing
        directly.
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Weekly operating hours</caption>
      <tbody>
        {Array.from({ length: 7 }, (_, day) => {
          const entry = byDay.get(day);
          const isToday = day === today;
          const closed = !entry || entry.isClosed;
          return (
            <tr
              key={day}
              className={cn(
                "border-b border-line last:border-b-0",
                isToday && "bg-blueprint-50",
              )}
            >
              <th
                scope="row"
                className="py-2 pr-4 text-left font-medium text-ink"
              >
                {dayLabel(day)}
                {isToday ? (
                  <span className="ml-2 text-xs font-normal text-blueprint-700">
                    Today
                  </span>
                ) : null}
              </th>
              <td className="py-2 text-right text-ink-muted">
                {closed ? (
                  <span className="text-ink-muted">Closed</span>
                ) : (
                  <span className="text-ink">
                    {formatMinutes(entry.opensAt)} – {formatMinutes(entry.closesAt)}
                  </span>
                )}
                {entry?.note ? (
                  <span className="block text-xs text-ink-muted">{entry.note}</span>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
