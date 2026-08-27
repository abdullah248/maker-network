import { Badge } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import {
  MACHINE_CATEGORIES,
  MACHINE_CATEGORY_LABELS,
  type MachineCategory,
} from "@/lib/constants";
import type { PublicProfile } from "@/lib/services/profiles";

type Machine = PublicProfile["machines"][number];

function machineRate(machine: Machine): string | null {
  const parts: string[] = [];
  if (machine.hourlyRate && machine.hourlyRate > 0) {
    parts.push(`${formatMoney(machine.hourlyRate)}/hr`);
  }
  if (machine.perJobFee && machine.perJobFee > 0) {
    parts.push(`${formatMoney(machine.perJobFee)}/job`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function MachineList({ machines }: { machines: Machine[] }) {
  const grouped = MACHINE_CATEGORIES.map((category) => ({
    category: category as MachineCategory,
    items: machines.filter((machine) => machine.category === category),
  })).filter((group) => group.items.length > 0);

  if (grouped.length === 0) return null;

  return (
    <div className="space-y-6">
      {grouped.map((group) => (
        <div key={group.category}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
            {MACHINE_CATEGORY_LABELS[group.category]}
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {group.items.map((machine) => {
              const rate = machineRate(machine);
              return (
                <li
                  key={machine.id}
                  className="rounded-xl border border-line bg-surface p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">
                        {machine.make} {machine.model}
                      </p>
                      {machine.nickname ? (
                        <p className="text-sm text-ink-muted">“{machine.nickname}”</p>
                      ) : null}
                    </div>
                    {machine.isOperational ? (
                      machine.quantity > 1 ? (
                        <Badge tone="neutral">×{machine.quantity}</Badge>
                      ) : null
                    ) : (
                      <Badge tone="danger">Out of service</Badge>
                    )}
                  </div>
                  <dl className="mt-3 space-y-1 text-sm text-ink-muted">
                    {machine.buildVolume ? (
                      <div className="flex gap-2">
                        <dt className="font-medium text-ink">Build area</dt>
                        <dd>{machine.buildVolume}</dd>
                      </div>
                    ) : null}
                    {rate ? (
                      <div className="flex gap-2">
                        <dt className="font-medium text-ink">Pricing</dt>
                        <dd>{rate}</dd>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <dt className="font-medium text-ink">Pricing</dt>
                        <dd>Ask for a quote</dd>
                      </div>
                    )}
                  </dl>
                  {machine.notes ? (
                    <p className="mt-2 text-sm text-ink-muted">{machine.notes}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
