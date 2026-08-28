import Link from "next/link";

import { requireSessionUser } from "@/lib/session";
import { getOwnProfile } from "@/lib/services/profiles";
import {
  listAvailability,
  listMachines,
  listMaterials,
  listOperatingHours,
} from "@/lib/services/inventory";
import { listConversations, unreadMessageCount } from "@/lib/services/messaging";
import { countPendingRequests } from "@/lib/services/requests";
import { formatDateTime, formatRelative, initials } from "@/lib/format";
import { PROFILE_TYPE_LABELS, type ProfileType } from "@/lib/constants";
import { Badge, Button, buttonClass, Card, EmptyState, SectionHeading } from "@/components/ui";
import { togglePublishedAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function DashboardOverviewPage() {
  const user = await requireSessionUser("/dashboard");
  const profile = await getOwnProfile(user.id);

  if (!profile) {
    return (
      <div className="space-y-6">
        <SectionHeading
          eyebrow="Overview"
          title="Welcome to Maker Network"
          description="Set up your provider profile so customers can find your machines and materials."
        />
        <EmptyState
          title="Create your profile"
          description="You haven't created a maker profile yet. It only takes a minute — pick a handle, add your city, and you're ready to list machines."
          action={
            <Link href="/dashboard/profile" className={buttonClass("primary", "md")}>
              Create your profile
            </Link>
          }
        />
      </div>
    );
  }

  const [machines, materials, hours, slots, unread, conversations, pendingRequests] =
    await Promise.all([
      listMachines(profile.id),
      listMaterials(profile.id),
      listOperatingHours(profile.id),
      listAvailability(profile.id, { from: new Date() }),
      unreadMessageCount(user.id),
      listConversations(user.id),
      countPendingRequests(user.id),
    ]);

  const openUpcomingSlots = slots.filter((slot) => slot.status === "OPEN").length;
  const projectCount = profile.portfolio.length;
  const recentConversations = conversations.slice(0, 5);

  const checklist = [
    { label: "Profile created", done: true, href: "/dashboard/profile" },
    { label: "At least one machine", done: machines.length > 0, href: "/dashboard/machines" },
    { label: "At least one material", done: materials.length > 0, href: "/dashboard/materials" },
    { label: "Add project photos", done: projectCount > 0, href: "/dashboard/gallery" },
    { label: "Operating hours set", done: hours.length > 0, href: "/dashboard/hours" },
    { label: "Profile published", done: profile.published, href: "/dashboard/profile" },
  ];
  const completed = checklist.filter((item) => item.done).length;

  const stats = [
    { label: "Open requests", value: pendingRequests, href: "/dashboard/requests" },
    { label: "Machines", value: machines.length, href: "/dashboard/machines" },
    { label: "Materials", value: materials.length, href: "/dashboard/materials" },
    { label: "Projects", value: projectCount, href: "/dashboard/gallery" },
    { label: "Upcoming open slots", value: openUpcomingSlots, href: "/dashboard/availability" },
    { label: "Unread messages", value: unread, href: "/messages" },
    {
      label: "Avg. rating",
      value: profile.ratingCount > 0 ? profile.ratingAverage.toFixed(1) : "—",
      href: "/dashboard/reviews",
    },
    { label: "Reviews", value: profile.ratingCount, href: "/dashboard/reviews" },
  ];

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Overview"
        title={profile.displayName}
        description={
          <>
            {PROFILE_TYPE_LABELS[profile.type as ProfileType]} ·{" "}
            {profile.published ? "Live on Maker Network" : "Not yet published"}
          </>
        }
        action={
          <div className="flex items-center gap-2">
            <Link href={`/p/${profile.slug}`} className={buttonClass("outline", "md")}>
              View public page
            </Link>
            <form action={togglePublishedAction}>
              <input
                type="hidden"
                name="published"
                value={profile.published ? "false" : "true"}
              />
              <Button type="submit" variant={profile.published ? "outline" : "primary"}>
                {profile.published ? "Unpublish" : "Publish profile"}
              </Button>
            </form>
          </div>
        }
      />

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-ink">Getting started</h3>
          <Badge tone={completed === checklist.length ? "moss" : "ember"}>
            {completed}/{checklist.length} complete
          </Badge>
        </div>
        <ul className="space-y-2">
          {checklist.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-surface-muted"
              >
                <span
                  aria-hidden
                  className={
                    item.done
                      ? "flex h-5 w-5 items-center justify-center rounded-full bg-moss-100 text-xs font-bold text-moss-600"
                      : "flex h-5 w-5 items-center justify-center rounded-full border border-line text-xs text-ink-muted"
                  }
                >
                  {item.done ? "✓" : ""}
                </span>
                <span className={item.done ? "text-ink" : "text-ink-muted"}>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="h-full transition-colors hover:border-ember-200">
              <p className="text-3xl font-semibold text-ink">{stat.value}</p>
              <p className="mt-1 text-sm text-ink-muted">{stat.label}</p>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-ink">Recent conversations</h3>
          <Link
            href="/messages"
            className="text-sm font-medium text-blueprint-600 hover:text-blueprint-700"
          >
            View all
          </Link>
        </div>
        {recentConversations.length === 0 ? (
          <p className="text-sm text-ink-muted">No conversations yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {recentConversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href="/messages"
                  className="flex items-center gap-3 py-3 transition-colors hover:bg-surface-muted"
                >
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-ink-muted"
                  >
                    {initials(conversation.counterpartName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-ink">
                        {conversation.subject}
                      </span>
                      <span
                        className="shrink-0 text-xs text-ink-muted"
                        title={formatDateTime(conversation.lastMessageAt)}
                      >
                        {formatRelative(conversation.lastMessageAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className="truncate text-xs text-ink-muted">
                        {conversation.counterpartName}
                        {conversation.preview ? ` — ${conversation.preview}` : ""}
                      </span>
                      {conversation.unreadCount > 0 ? (
                        <Badge tone="ember">{conversation.unreadCount}</Badge>
                      ) : null}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
