import { requireSessionUser } from "@/lib/session";
import { getOwnProfile } from "@/lib/services/profiles";
import { listOperatingHours } from "@/lib/services/inventory";
import { SectionHeading } from "@/components/ui";
import { NoProfileNotice } from "@/components/dashboard/no-profile-notice";
import { HoursEditor, type HoursRow } from "./hours-editor";

export const dynamic = "force-dynamic";

const DEFAULT_OPENS = 540; // 9:00 AM
const DEFAULT_CLOSES = 1020; // 5:00 PM

export default async function HoursPage() {
  const user = await requireSessionUser("/dashboard");
  const profile = await getOwnProfile(user.id);

  let rows: HoursRow[] = [];
  if (profile) {
    const existing = await listOperatingHours(profile.id);
    const byDay = new Map(existing.map((entry) => [entry.dayOfWeek, entry]));
    rows = Array.from({ length: 7 }, (_, day) => {
      const found = byDay.get(day);
      return {
        dayOfWeek: day,
        opensAt: found?.opensAt ?? DEFAULT_OPENS,
        closesAt: found?.closesAt ?? DEFAULT_CLOSES,
        isClosed: found ? found.isClosed : day === 0 || day === 6,
        note: found?.note ?? "",
      };
    });
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Availability"
        title="Hours of operation"
        description="Set your weekly opening hours. Customers see these on your public page."
      />
      {!profile ? <NoProfileNotice feature="hours" /> : <HoursEditor initialRows={rows} />}
    </div>
  );
}
