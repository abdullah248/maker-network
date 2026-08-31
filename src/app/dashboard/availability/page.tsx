import { requireSessionUser } from "@/lib/session";
import { getOwnProfile } from "@/lib/services/profiles";
import { listAvailability, listMachines } from "@/lib/services/inventory";
import { SectionHeading } from "@/components/ui";
import { NoProfileNotice } from "@/components/dashboard/no-profile-notice";
import {
  AvailabilityManager,
  type MachineOption,
  type SlotDTO,
} from "./availability-manager";

export const dynamic = "force-dynamic";

type SlotWithMachine = Awaited<ReturnType<typeof listAvailability>>[number];

function machineLabel(machine: SlotWithMachine["machine"]): string | null {
  if (!machine) return null;
  return machine.nickname ?? `${machine.make} ${machine.model}`;
}

function parseMonth(raw: string | undefined): { year: number; month: number; param: string } {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split("-").map((part) => Number.parseInt(part, 10));
    if (y >= 1970 && y <= 3000 && m >= 1 && m <= 12) {
      year = y;
      month = m - 1;
    }
  }
  const param = `${year}-${String(month + 1).padStart(2, "0")}`;
  return { year, month, param };
}

function toSlotDTO(slot: SlotWithMachine): SlotDTO {
  return {
    id: slot.id,
    machineId: slot.machineId,
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
    status: slot.status,
    capacity: slot.capacity,
    note: slot.note,
    machineLabel: machineLabel(slot.machine),
  };
}

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireSessionUser("/dashboard");
  const profile = await getOwnProfile(user.id);

  if (!profile) {
    return (
      <div className="space-y-6">
        <SectionHeading eyebrow="Availability" title="Availability calendar" />
        <NoProfileNotice feature="availability" />
      </div>
    );
  }

  const { month, year, param } = parseMonth((await searchParams).month);

  const calendarFrom = new Date(year, month, 1);
  const calendarTo = new Date(year, month + 2, 0, 23, 59, 59, 999);

  const [calendarSlotsRaw, upcomingRaw, machinesRaw] = await Promise.all([
    listAvailability(profile.id, { from: calendarFrom, to: calendarTo }),
    listAvailability(profile.id, { from: new Date() }),
    listMachines(profile.id),
  ]);

  const machines: MachineOption[] = machinesRaw.map((m) => ({
    id: m.id,
    label: m.nickname ? `${m.nickname} (${m.make} ${m.model})` : `${m.make} ${m.model}`,
  }));

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Availability"
        title="Availability calendar"
        description="Publish bookable time slots. Customers can reserve open slots from your public page."
      />
      <AvailabilityManager
        monthParam={param}
        baseYear={year}
        baseMonth={month}
        calendarSlots={calendarSlotsRaw.map(toSlotDTO)}
        upcomingSlots={upcomingRaw.map(toSlotDTO)}
        machines={machines}
      />
    </div>
  );
}
