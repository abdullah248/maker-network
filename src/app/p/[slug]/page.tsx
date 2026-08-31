import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Alert, Badge, buttonClass, Card, SectionHeading } from "@/components/ui";
import { AvailabilityCalendar } from "@/components/public/availability-calendar";
import { ReviewsSection } from "@/components/public/reviews-section";
import { StarRating } from "@/components/star-rating";
import { HoursTable } from "@/components/public/hours-table";
import { MachineList } from "@/components/public/machine-list";
import { MaterialTable } from "@/components/public/material-table";
import { ProjectGallery } from "@/components/public/project-gallery";
import { PinIcon } from "@/components/public/icons";
import { formatLocation, initials } from "@/lib/format";
import { PROFILE_TYPE_LABELS, type ProfileType } from "@/lib/constants";
import { getProfileBySlugForViewer } from "@/lib/services/profiles";
import { listAvailability } from "@/lib/services/inventory";
import { getSessionUser } from "@/lib/session";

type Params = Promise<{ slug: string }>;

const AVAILABILITY_DAYS = 35;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getProfileBySlugForViewer(slug, null);
  if (!profile) return { title: "Maker not found" };

  const location = formatLocation(profile);
  const description =
    profile.headline ??
    `${PROFILE_TYPE_LABELS[profile.type as ProfileType]} in ${location} on Maker Network.`;

  return {
    title: profile.displayName,
    description,
    openGraph: { title: profile.displayName, description, type: "profile" },
  };
}

function AccessRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <span className="text-sm text-ink">{label}</span>
      <Badge tone={value ? "clay" : "neutral"}>{value ? "Required" : "Not required"}</Badge>
    </div>
  );
}

function FulfilmentRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <span className="text-sm text-ink">{label}</span>
      <Badge tone={value ? "moss" : "neutral"}>{value ? "Yes" : "No"}</Badge>
    </div>
  );
}

export default async function ProfilePage({ params }: { params: Params }) {
  const { slug } = await params;
  const viewer = await getSessionUser();
  const profile = await getProfileBySlugForViewer(slug, viewer?.id ?? null);

  if (!profile) notFound();

  const type = profile.type as ProfileType;
  const isMakerspace = type === "MAKERSPACE";

  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + AVAILABILITY_DAYS);
  const slots = await listAvailability(profile.id, { from, to });

  const requestHref = `/requests/new?profile=${profile.slug}`;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {!profile.published ? (
        <div className="mb-6">
          <Alert tone="info" title="Draft — only visible to you">
            This profile isn&apos;t published yet. Publish it from your dashboard to make it
            public.
          </Alert>
        </div>
      ) : null}

      {/* Header */}
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt=""
              className="h-16 w-16 shrink-0 rounded-2xl object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blueprint-100 text-lg font-semibold text-blueprint-700"
            >
              {initials(profile.displayName)}
            </span>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                {profile.displayName}
              </h1>
              <Badge tone={isMakerspace ? "blueprint" : "ember"}>
                {PROFILE_TYPE_LABELS[type]}
              </Badge>
              <StarRating value={profile.ratingAverage} count={profile.ratingCount} />
            </div>
            {profile.headline ? (
              <p className="mt-1 max-w-xl text-ink-muted">{profile.headline}</p>
            ) : null}
            <p className="mt-2 flex items-center gap-1 text-sm text-ink-muted">
              <PinIcon className="h-4 w-4" />
              {formatLocation(profile)}
            </p>
            {profile.websiteUrl ? (
              <a
                href={profile.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-sm font-medium text-blueprint-600 hover:underline"
              >
                Visit website
              </a>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {profile.acceptingRequests ? (
            <>
              <Link href={requestHref} className={buttonClass("primary", "md")}>
                Request a print
              </Link>
              <Link
                href={`${requestHref}#message`}
                className={buttonClass("outline", "md")}
              >
                Message
              </Link>
            </>
          ) : (
            <>
              <span
                aria-disabled
                className={buttonClass("primary", "md", "pointer-events-none opacity-50")}
              >
                Request a print
              </span>
              <p className="max-w-56 text-right text-xs text-ink-muted">
                This provider isn&apos;t accepting new requests right now.
              </p>
            </>
          )}
        </div>
      </header>

      {profile.bio ? (
        <Card className="mt-8">
          <p className="whitespace-pre-line text-sm text-ink-muted">{profile.bio}</p>
        </Card>
      ) : null}

      <div className="mt-10 space-y-10">
        {/* Recent work */}
        {profile.portfolio.length > 0 ? (
          <section aria-labelledby="recent-work-heading">
            <SectionHeading
              title="Recent work"
              description="A few things this maker has actually made."
            />
            <span id="recent-work-heading" className="sr-only">
              Recent work
            </span>
            <ProjectGallery items={profile.portfolio} makerName={profile.displayName} />
          </section>
        ) : null}

        {/* Machines */}
        {profile.machines.length > 0 ? (
          <section aria-labelledby="machines-heading">
            <SectionHeading title="Machines" />
            <span id="machines-heading" className="sr-only">
              Machines
            </span>
            <MachineList machines={profile.machines} />
          </section>
        ) : null}

        {/* Materials */}
        {profile.materials.length > 0 ? (
          <section aria-labelledby="materials-heading">
            <SectionHeading
              title="Materials"
              description="Prices are per unit and may vary — confirm when you send a request."
            />
            <span id="materials-heading" className="sr-only">
              Materials
            </span>
            <MaterialTable materials={profile.materials} />
          </section>
        ) : null}

        {/* Visiting & access (makerspace) */}
        {isMakerspace ? (
          <section aria-labelledby="access-heading">
            <SectionHeading title="Visiting &amp; access" />
            <span id="access-heading" className="sr-only">
              Visiting and access
            </span>
            <Card>
              <AccessRow label="Appointment" value={profile.requiresAppointment} />
              <AccessRow label="Membership" value={profile.requiresMembership} />
              <AccessRow label="Library card" value={profile.requiresLibraryCard} />
              {profile.membershipDetails ? (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-ink">Membership details</h3>
                  <p className="mt-1 whitespace-pre-line text-sm text-ink-muted">
                    {profile.membershipDetails}
                  </p>
                </div>
              ) : null}
              {profile.accessNotes ? (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-ink">Access notes</h3>
                  <p className="mt-1 whitespace-pre-line text-sm text-ink-muted">
                    {profile.accessNotes}
                  </p>
                </div>
              ) : null}
            </Card>
          </section>
        ) : (
          <section aria-labelledby="fulfilment-heading">
            <SectionHeading title="Fulfilment" />
            <span id="fulfilment-heading" className="sr-only">
              Fulfilment
            </span>
            <Card>
              <FulfilmentRow label="Shipping" value={profile.offersShipping} />
              <FulfilmentRow label="Local pickup" value={profile.offersLocalPickup} />
              <FulfilmentRow
                label="Can custom-order material"
                value={profile.canCustomOrderMaterials}
              />
              {profile.customOrderNotes ? (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-ink">Custom order notes</h3>
                  <p className="mt-1 whitespace-pre-line text-sm text-ink-muted">
                    {profile.customOrderNotes}
                  </p>
                </div>
              ) : null}
            </Card>
          </section>
        )}

        {/* Operating hours */}
        <section aria-labelledby="hours-heading" className="grid gap-8 lg:grid-cols-2">
          <div>
            <SectionHeading title="Operating hours" />
            <span id="hours-heading" className="sr-only">
              Operating hours
            </span>
            <Card>
              <HoursTable hours={profile.operatingHours} />
            </Card>
          </div>
          <div>
            <SectionHeading title="Availability" />
            <Card>
              <AvailabilityCalendar slots={slots} from={from} to={to} />
            </Card>
          </div>
        </section>

        {/* Reviews */}
        <ReviewsSection
          profile={{
            id: profile.id,
            slug: profile.slug,
            displayName: profile.displayName,
            userId: profile.userId,
          }}
          viewerId={viewer?.id ?? null}
        />
      </div>
    </div>
  );
}
