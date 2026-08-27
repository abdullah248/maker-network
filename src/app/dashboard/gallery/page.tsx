import { requireSessionUser } from "@/lib/session";
import { getOwnProfile } from "@/lib/services/profiles";
import { SectionHeading } from "@/components/ui";
import { NoProfileNotice } from "@/components/dashboard/no-profile-notice";
import {
  GalleryManager,
  type MachineOptionDTO,
  type PortfolioItemDTO,
} from "./gallery-manager";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const user = await requireSessionUser("/dashboard/gallery");
  const profile = await getOwnProfile(user.id);

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Showcase"
        title="Project gallery"
        description="Post photos of things you've made so customers can see the quality of your work before sending a request."
      />
      {!profile ? (
        <NoProfileNotice feature="project photos" />
      ) : (
        <GalleryManager
          initialItems={profile.portfolio.map(
            (item): PortfolioItemDTO => ({
              id: item.id,
              title: item.title,
              description: item.description,
              imageUrl: item.imageUrl,
              altText: item.altText,
              materialUsed: item.materialUsed,
              featured: item.featured,
              sortOrder: item.sortOrder,
              machine: item.machine
                ? {
                    id: item.machine.id,
                    make: item.machine.make,
                    model: item.machine.model,
                    category: item.machine.category,
                  }
                : null,
            }),
          )}
          machines={profile.machines.map(
            (machine): MachineOptionDTO => ({
              id: machine.id,
              make: machine.make,
              model: machine.model,
            }),
          )}
        />
      )}
    </div>
  );
}
