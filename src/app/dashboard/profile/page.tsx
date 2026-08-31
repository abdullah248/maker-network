import { requireSessionUser } from "@/lib/session";
import { getOwnProfile, suggestSlug } from "@/lib/services/profiles";
import { SectionHeading } from "@/components/ui";
import { ProfileForm, type ProfileFormValues } from "./profile-form";
import type { ProfileType } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireSessionUser("/dashboard");
  const profile = await getOwnProfile(user.id);

  const defaultType: ProfileType =
    (profile?.type as ProfileType | undefined) ??
    (user.accountType === "INDIVIDUAL" ? "INDIVIDUAL" : "MAKERSPACE");

  const suggestedSlug = profile?.slug ?? (await suggestSlug(user.name ?? "maker"));

  const initial: ProfileFormValues = {
    type: defaultType,
    displayName: profile?.displayName ?? user.name ?? "",
    slug: profile?.slug ?? suggestedSlug,
    headline: profile?.headline ?? "",
    bio: profile?.bio ?? "",
    city: profile?.city ?? "",
    region: profile?.region ?? "",
    country: profile?.country ?? "US",
    postalCode: profile?.postalCode ?? "",
    websiteUrl: profile?.websiteUrl ?? "",
    contactEmail: profile?.contactEmail ?? user.email ?? "",
    phone: profile?.phone ?? "",
    acceptingRequests: profile?.acceptingRequests ?? true,
    published: profile?.published ?? false,
    requiresAppointment: profile?.requiresAppointment ?? false,
    requiresMembership: profile?.requiresMembership ?? false,
    requiresLibraryCard: profile?.requiresLibraryCard ?? false,
    membershipDetails: profile?.membershipDetails ?? "",
    accessNotes: profile?.accessNotes ?? "",
    offersShipping: profile?.offersShipping ?? false,
    offersLocalPickup: profile?.offersLocalPickup ?? true,
    canCustomOrderMaterials: profile?.canCustomOrderMaterials ?? false,
    customOrderNotes: profile?.customOrderNotes ?? "",
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Public profile"
        title={profile ? "Edit your profile" : "Create your profile"}
        description="This is what customers see. Location is city-level only — your street address is never shown publicly."
      />
      <ProfileForm
        initial={initial}
        suggestedSlug={suggestedSlug}
        isNew={!profile}
      />
    </div>
  );
}
