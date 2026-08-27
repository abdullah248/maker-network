import { requireSessionUser } from "@/lib/session";
import { getOwnProfile } from "@/lib/services/profiles";
import { listMaterials } from "@/lib/services/inventory";
import { SectionHeading } from "@/components/ui";
import { NoProfileNotice } from "@/components/dashboard/no-profile-notice";
import { MaterialsManager, type MaterialDTO } from "./materials-manager";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  const user = await requireSessionUser("/dashboard");
  const profile = await getOwnProfile(user.id);

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Inventory"
        title="Materials"
        description="List the materials you stock or can custom-order, with pricing per unit."
      />
      {!profile ? (
        <NoProfileNotice feature="materials" />
      ) : (
        <MaterialsManager
          initialMaterials={(await listMaterials(profile.id)).map(
            (m): MaterialDTO => ({
              id: m.id,
              category: m.category,
              name: m.name,
              brand: m.brand,
              colors: m.colors,
              specs: m.specs,
              unit: m.unit,
              pricePerUnit: m.pricePerUnit,
              currency: m.currency,
              stockQuantity: m.stockQuantity,
              inStock: m.inStock,
              canCustomOrder: m.canCustomOrder,
              customOrderLeadDays: m.customOrderLeadDays,
              notes: m.notes,
            }),
          )}
        />
      )}
    </div>
  );
}
