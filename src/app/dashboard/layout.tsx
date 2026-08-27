import type { ReactNode } from "react";

import { requireSessionUser } from "@/lib/session";
import { getOwnProfile } from "@/lib/services/profiles";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { Badge } from "@/components/ui";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireSessionUser("/dashboard");
  const profile = await getOwnProfile(user.id);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="lg:w-60 lg:shrink-0">
          <div className="lg:sticky lg:top-24">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-ember-600">
                Provider dashboard
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-ink">
                {profile?.displayName ?? user.name ?? "Your workspace"}
              </p>
              <div className="mt-2">
                {profile ? (
                  profile.published ? (
                    <Badge tone="moss">Published</Badge>
                  ) : (
                    <Badge tone="clay">Draft</Badge>
                  )
                ) : (
                  <Badge tone="neutral">No profile yet</Badge>
                )}
              </div>
            </div>
            <DashboardNav profileSlug={profile?.slug ?? null} />
          </div>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
