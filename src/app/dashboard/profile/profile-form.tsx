"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { PROFILE_TYPES, PROFILE_TYPE_LABELS, type ProfileType } from "@/lib/constants";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { apiRequest, firstError, type FieldErrors } from "@/components/dashboard/client";

export type ProfileFormValues = {
  type: ProfileType;
  displayName: string;
  slug: string;
  headline: string;
  bio: string;
  city: string;
  region: string;
  country: string;
  postalCode: string;
  websiteUrl: string;
  contactEmail: string;
  phone: string;
  acceptingRequests: boolean;
  published: boolean;
  requiresAppointment: boolean;
  requiresMembership: boolean;
  requiresLibraryCard: boolean;
  membershipDetails: string;
  accessNotes: string;
  offersShipping: boolean;
  offersLocalPickup: boolean;
  canCustomOrderMaterials: boolean;
  customOrderNotes: string;
};

type SlugState = "idle" | "checking" | "available" | "taken" | "invalid";

export function ProfileForm({
  initial,
  suggestedSlug,
  isNew,
}: {
  initial: ProfileFormValues;
  suggestedSlug: string;
  isNew: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProfileFormValues>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [slugState, setSlugState] = useState<SlugState>("idle");
  const slugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = useCallback(<K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const checkSlug = useCallback((slug: string) => {
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug) || slug.length < 3) {
      setSlugState("invalid");
      return;
    }
    setSlugState("checking");
    if (slugTimer.current) clearTimeout(slugTimer.current);
    slugTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/profile/slug-check?slug=${encodeURIComponent(slug)}`);
        const data = (await res.json()) as { available?: boolean };
        setSlugState(data.available ? "available" : "taken");
      } catch {
        setSlugState("idle");
      }
    }, 400);
  }, []);

  useEffect(() => {
    const timer = slugTimer;
    const id = setTimeout(() => checkSlug(values.slug), 0);
    return () => {
      clearTimeout(id);
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSlugChange = (raw: string) => {
    const slug = raw.toLowerCase().replace(/[^a-z0-9-]/g, "");
    set("slug", slug);
    checkSlug(slug);
  };

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setSuccess(false);
    setFormError(null);
    setErrors({});

    const isMakerspace = values.type === "MAKERSPACE";
    const payload = {
      type: values.type,
      displayName: values.displayName,
      slug: values.slug,
      headline: values.headline,
      bio: values.bio,
      city: values.city,
      region: values.region,
      country: values.country,
      postalCode: values.postalCode,
      websiteUrl: values.websiteUrl,
      contactEmail: values.contactEmail,
      phone: values.phone,
      acceptingRequests: values.acceptingRequests,
      published: values.published,
      ...(isMakerspace
        ? {
            requiresAppointment: values.requiresAppointment,
            requiresMembership: values.requiresMembership,
            requiresLibraryCard: values.requiresLibraryCard,
            membershipDetails: values.membershipDetails,
            accessNotes: values.accessNotes,
          }
        : {
            offersShipping: values.offersShipping,
            offersLocalPickup: values.offersLocalPickup,
            canCustomOrderMaterials: values.canCustomOrderMaterials,
            customOrderNotes: values.customOrderNotes,
          }),
    };

    const result = await apiRequest("/api/profile", { method: "PUT", body: payload });
    setSubmitting(false);

    if (result.ok) {
      setSuccess(true);
      setSlugState("available");
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setErrors(result.error.fieldErrors);
    setFormError(
      result.error.formErrors[0] ?? result.error.message ?? "Please fix the errors below.",
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const slugHint = (() => {
    switch (slugState) {
      case "checking":
        return "Checking availability…";
      case "available":
        return "✓ Available";
      case "taken":
        return "That handle is already taken.";
      case "invalid":
        return "Use 3+ lowercase letters, numbers and hyphens.";
      default:
        return "Your public URL will be /p/<handle>.";
    }
  })();

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {success ? (
        <Alert tone="success" title="Profile saved">
          Your changes are live in your dashboard. Publish from the overview to make them public.
        </Alert>
      ) : null}
      {formError ? (
        <Alert tone="error" title="Could not save profile">
          {formError}
        </Alert>
      ) : null}

      <Card className="space-y-4">
        <h3 className="text-lg font-semibold text-ink">Provider type</h3>
        <Field
          label="What kind of provider are you?"
          htmlFor="type"
          hint={
            values.type === "MAKERSPACE"
              ? "Makerspaces list opening hours and access rules such as memberships or library cards."
              : "Individual makers list fulfilment options such as shipping and local pickup."
          }
        >
          <Select
            id="type"
            value={values.type}
            onChange={(e) => set("type", e.target.value as ProfileType)}
          >
            {PROFILE_TYPES.map((type) => (
              <option key={type} value={type}>
                {PROFILE_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>
        {!isNew && values.type !== initial.type ? (
          <p className="text-xs text-ember-700">
            Switching provider type clears the fields that only apply to your previous type.
          </p>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <h3 className="text-lg font-semibold text-ink">Basics</h3>
        <Field
          label="Display name"
          htmlFor="displayName"
          required
          error={firstError(errors, "displayName")}
        >
          <Input
            id="displayName"
            value={values.displayName}
            maxLength={80}
            onChange={(e) => set("displayName", e.target.value)}
          />
        </Field>

        <Field label="Handle" htmlFor="slug" required error={firstError(errors, "slug")} hint={slugHint}>
          <div className="flex gap-2">
            <div className="flex flex-1 items-center rounded-lg border border-line bg-surface px-3">
              <span className="text-sm text-ink-muted">/p/</span>
              <input
                id="slug"
                value={values.slug}
                maxLength={60}
                onChange={(e) => onSlugChange(e.target.value)}
                className="h-10 w-full bg-transparent px-1 text-sm text-ink outline-none"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => onSlugChange(suggestedSlug)}
            >
              Suggest
            </Button>
          </div>
        </Field>

        <Field label="Headline" htmlFor="headline" error={firstError(errors, "headline")} hint="A short tagline shown under your name.">
          <Input
            id="headline"
            value={values.headline}
            maxLength={140}
            onChange={(e) => set("headline", e.target.value)}
          />
        </Field>

        <Field label="Bio" htmlFor="bio" error={firstError(errors, "bio")}>
          <Textarea
            id="bio"
            value={values.bio}
            rows={5}
            onChange={(e) => set("bio", e.target.value)}
          />
        </Field>
      </Card>

      <Card className="space-y-4">
        <h3 className="text-lg font-semibold text-ink">Location</h3>
        <p className="text-sm text-ink-muted">
          Location is <strong>city-level only</strong>. A street address is never shown publicly.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" htmlFor="city" required error={firstError(errors, "city")}>
            <Input id="city" value={values.city} maxLength={80} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="Region / state" htmlFor="region" error={firstError(errors, "region")}>
            <Input id="region" value={values.region} maxLength={80} onChange={(e) => set("region", e.target.value)} />
          </Field>
          <Field label="Country (2-letter code)" htmlFor="country" error={firstError(errors, "country")}>
            <Input
              id="country"
              value={values.country}
              maxLength={2}
              onChange={(e) => set("country", e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Postal code" htmlFor="postalCode" error={firstError(errors, "postalCode")}>
            <Input id="postalCode" value={values.postalCode} maxLength={12} onChange={(e) => set("postalCode", e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <h3 className="text-lg font-semibold text-ink">Contact</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Website URL" htmlFor="websiteUrl" error={firstError(errors, "websiteUrl")}>
            <Input id="websiteUrl" type="url" placeholder="https://" value={values.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} />
          </Field>
          <Field label="Contact email" htmlFor="contactEmail" error={firstError(errors, "contactEmail")}>
            <Input id="contactEmail" type="email" value={values.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
          </Field>
          <Field label="Phone" htmlFor="phone" error={firstError(errors, "phone")}>
            <Input id="phone" type="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
        </div>
        <Checkbox
          label="Accepting requests"
          description="Turn this off to temporarily stop new print/cut requests and messages."
          checked={values.acceptingRequests}
          onChange={(e) => set("acceptingRequests", e.target.checked)}
        />
      </Card>

      {values.type === "MAKERSPACE" ? (
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold text-ink">Access rules</h3>
          <div className="space-y-2">
            <Checkbox
              label="Requires an appointment"
              checked={values.requiresAppointment}
              onChange={(e) => set("requiresAppointment", e.target.checked)}
            />
            <Checkbox
              label="Requires membership"
              checked={values.requiresMembership}
              onChange={(e) => set("requiresMembership", e.target.checked)}
            />
            <Checkbox
              label="Requires a library card"
              checked={values.requiresLibraryCard}
              onChange={(e) => set("requiresLibraryCard", e.target.checked)}
            />
          </div>
          <Field label="Membership details" htmlFor="membershipDetails" error={firstError(errors, "membershipDetails")}>
            <Textarea
              id="membershipDetails"
              value={values.membershipDetails}
              onChange={(e) => set("membershipDetails", e.target.value)}
            />
          </Field>
          <Field label="Access notes" htmlFor="accessNotes" error={firstError(errors, "accessNotes")}>
            <Textarea
              id="accessNotes"
              value={values.accessNotes}
              onChange={(e) => set("accessNotes", e.target.value)}
            />
          </Field>
        </Card>
      ) : (
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold text-ink">Fulfilment</h3>
          <div className="space-y-2">
            <Checkbox
              label="Offers shipping"
              checked={values.offersShipping}
              onChange={(e) => set("offersShipping", e.target.checked)}
            />
            <Checkbox
              label="Offers local pickup"
              checked={values.offersLocalPickup}
              onChange={(e) => set("offersLocalPickup", e.target.checked)}
            />
            <Checkbox
              label="Can custom-order materials"
              description="You can source materials you don't normally stock on request."
              checked={values.canCustomOrderMaterials}
              onChange={(e) => set("canCustomOrderMaterials", e.target.checked)}
            />
          </div>
          {firstError(errors, "offersLocalPickup") ? (
            <p role="alert" className="text-xs font-medium text-red-600">
              {firstError(errors, "offersLocalPickup")}
            </p>
          ) : null}
          <Field label="Custom order notes" htmlFor="customOrderNotes" error={firstError(errors, "customOrderNotes")}>
            <Textarea
              id="customOrderNotes"
              value={values.customOrderNotes}
              onChange={(e) => set("customOrderNotes", e.target.value)}
            />
          </Field>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : isNew ? "Create profile" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
