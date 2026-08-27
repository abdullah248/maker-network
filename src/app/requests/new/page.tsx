import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSessionUser } from "@/lib/session";
import { getPublicProfileBySlug } from "@/lib/services/profiles";
import { formatLocation } from "@/lib/format";
import { Alert, Badge, buttonClass, Card, SectionHeading } from "@/components/ui";
import { Avatar } from "@/components/messaging/avatar";
import { RequestForm } from "@/components/messaging/request-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact a maker",
};

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>;
}) {
  const { profile: profileParam } = await searchParams;
  const slug = (profileParam ?? "").trim();
  if (!slug) notFound();

  const callbackUrl = `/requests/new?profile=${encodeURIComponent(slug)}`;
  const user = await requireSessionUser(callbackUrl);

  const profile = await getPublicProfileBySlug(slug);
  if (!profile) notFound();

  const isOwnProfile = profile.userId === user.id;
  const paused = !profile.acceptingRequests;

  const accessRequirements =
    profile.requiresAppointment || profile.requiresMembership || profile.requiresLibraryCard;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/p/${profile.slug}`}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink"
      >
        ← Back to {profile.displayName}
      </Link>

      <SectionHeading
        eyebrow="Get in touch"
        title={`Contact ${profile.displayName}`}
        description="Send a structured print request or a quick message to start a conversation."
      />

      <Card className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar name={profile.displayName} image={profile.avatarUrl} size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink">{profile.displayName}</p>
          <p className="text-sm text-ink-muted">{formatLocation(profile)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profile.offersShipping ? <Badge tone="blueprint">Ships work</Badge> : null}
            {profile.offersLocalPickup ? <Badge tone="moss">Local pickup</Badge> : null}
            {profile.canCustomOrderMaterials ? (
              <Badge tone="ember">Custom material orders</Badge>
            ) : null}
            {accessRequirements ? <Badge tone="clay">Access requirements</Badge> : null}
          </div>
        </div>
      </Card>

      {isOwnProfile ? (
        <Alert tone="info" title="This is your own profile">
          <p>
            You can’t send a print request to yourself. Manage your incoming requests from your
            dashboard.
          </p>
          <Link href="/dashboard" className={buttonClass("primary", "sm", "mt-3")}>
            Go to dashboard
          </Link>
        </Alert>
      ) : (
        <>
          {paused ? (
            <Alert tone="info" title="Not accepting requests right now">
              This maker has paused new requests, so submissions are disabled. Check back later.
            </Alert>
          ) : null}
          <div className={paused ? "mt-6" : undefined}>
            <RequestForm
              profileSlug={profile.slug}
              makerName={profile.displayName}
              offersShipping={profile.offersShipping}
              offersLocalPickup={profile.offersLocalPickup}
              disabled={paused}
              machines={profile.machines
                .filter((machine) => machine.isOperational)
                .map((machine) => ({
                  id: machine.id,
                  make: machine.make,
                  model: machine.model,
                  category: machine.category,
                }))}
              materials={profile.materials.map((material) => ({
                id: material.id,
                name: material.name,
                unit: material.unit,
                pricePerUnit: material.pricePerUnit,
                currency: material.currency,
              }))}
            />
          </div>
        </>
      )}
    </div>
  );
}
