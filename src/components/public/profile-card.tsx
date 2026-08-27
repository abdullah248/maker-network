import Link from "next/link";

import { Badge, Card } from "@/components/ui";
import { formatLocation, formatPrice, initials } from "@/lib/format";
import {
  MACHINE_CATEGORY_LABELS,
  PROFILE_TYPE_LABELS,
  type MachineCategory,
  type ProfileType,
} from "@/lib/constants";
import type { DirectoryCard } from "@/lib/services/search";
import { PinIcon } from "./icons";

/** Distinct machine categories, preserving catalog order of first appearance. */
function distinctCategories(machines: DirectoryCard["machines"]): MachineCategory[] {
  const seen = new Set<string>();
  const out: MachineCategory[] = [];
  for (const machine of machines) {
    if (!seen.has(machine.category)) {
      seen.add(machine.category);
      out.push(machine.category as MachineCategory);
    }
  }
  return out;
}

export function ProfileCard({ profile }: { profile: DirectoryCard }) {
  const categories = distinctCategories(profile.machines);
  const materials = profile.materials.slice(0, 3);
  const type = profile.type as ProfileType;

  return (
    <Card className="flex h-full flex-col gap-4 p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blueprint-100 text-sm font-semibold text-blueprint-700"
          >
            {initials(profile.displayName)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-ink">
              <Link href={`/p/${profile.slug}`} className="hover:underline">
                {profile.displayName}
              </Link>
            </h3>
            <Badge tone={type === "MAKERSPACE" ? "blueprint" : "ember"}>
              {PROFILE_TYPE_LABELS[type]}
            </Badge>
          </div>
          <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
            <PinIcon className="h-3.5 w-3.5" />
            {formatLocation(profile)}
          </p>
        </div>
      </div>

      {profile.headline ? (
        <p className="line-clamp-2 text-sm text-ink-muted">{profile.headline}</p>
      ) : null}

      {categories.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {categories.slice(0, 4).map((category) => (
            <Badge key={category} tone="neutral">
              {MACHINE_CATEGORY_LABELS[category]}
            </Badge>
          ))}
          {categories.length > 4 ? (
            <Badge tone="neutral">+{categories.length - 4} more</Badge>
          ) : null}
        </div>
      ) : null}

      {materials.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {materials.map((material) => (
            <li
              key={material.id}
              className="rounded-full bg-surface-muted px-2.5 py-1 text-xs text-ink-muted"
            >
              <span className="font-medium text-ink">{material.name}</span>
              {" · "}
              {formatPrice(material.pricePerUnit, material.unit)}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-1.5 border-t border-line pt-3">
        {profile.requiresLibraryCard ? <Badge tone="clay">Library card</Badge> : null}
        {profile.requiresMembership ? <Badge tone="clay">Membership</Badge> : null}
        {profile.requiresAppointment ? <Badge tone="clay">Appointment</Badge> : null}
        {profile.offersShipping ? <Badge tone="moss">Ships</Badge> : null}
        {profile.offersLocalPickup ? <Badge tone="moss">Local pickup</Badge> : null}
        {profile.canCustomOrderMaterials ? <Badge tone="moss">Custom orders</Badge> : null}
        {profile.acceptingRequests ? (
          <Badge tone="ember">Accepting requests</Badge>
        ) : (
          <Badge tone="neutral">Not accepting requests</Badge>
        )}
      </div>
    </Card>
  );
}
