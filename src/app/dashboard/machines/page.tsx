import { requireSessionUser } from "@/lib/session";
import { getOwnProfile } from "@/lib/services/profiles";
import { listMachines } from "@/lib/services/inventory";
import { SectionHeading } from "@/components/ui";
import { NoProfileNotice } from "@/components/dashboard/no-profile-notice";
import { MachinesManager, type MachineDTO } from "./machines-manager";

export const dynamic = "force-dynamic";

export default async function MachinesPage() {
  const user = await requireSessionUser("/dashboard");
  const profile = await getOwnProfile(user.id);

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Inventory"
        title="Machines"
        description="List the equipment you offer. Pick common machines from the catalog or add a custom one."
      />
      {!profile ? (
        <NoProfileNotice feature="machines" />
      ) : (
        <MachinesManager
          initialMachines={(await listMachines(profile.id)).map(
            (m): MachineDTO => ({
              id: m.id,
              category: m.category,
              make: m.make,
              model: m.model,
              isCustom: m.isCustom,
              nickname: m.nickname,
              buildVolume: m.buildVolume,
              quantity: m.quantity,
              hourlyRate: m.hourlyRate,
              perJobFee: m.perJobFee,
              notes: m.notes,
              isOperational: m.isOperational,
            }),
          )}
        />
      )}
    </div>
  );
}
