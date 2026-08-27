"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { StarRatingInput } from "@/components/star-rating";
import { Alert, Button, buttonClass, Card, Field, Input, Textarea } from "@/components/ui";
import { apiRequest, firstError, type FieldErrors } from "@/components/dashboard/client";
import { LIMITS, RATING_LABELS, type RatingValue } from "@/lib/constants";

export type OwnReviewDTO = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
};

type ReviewResult = { id: string };

export function ReviewForm({
  profileSlug,
  signedIn,
  isOwner,
  ownReview,
}: {
  profileSlug: string;
  signedIn: boolean;
  isOwner: boolean;
  ownReview: OwnReviewDTO | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState<number>(ownReview?.rating ?? 0);
  const [title, setTitle] = useState<string>(ownReview?.title ?? "");
  const [body, setBody] = useState<string>(ownReview?.body ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!signedIn) {
    return (
      <Card className="space-y-3">
        <h3 className="text-lg font-semibold text-ink">Reviewed this maker?</h3>
        <p className="text-sm text-ink-muted">
          Sign in to leave a rating and share your experience.
        </p>
        <Link
          href={`/signin?callbackUrl=/p/${profileSlug}`}
          className={buttonClass("primary", "md", "w-fit")}
        >
          Sign in to write a review
        </Link>
      </Card>
    );
  }

  if (isOwner) {
    return (
      <Card>
        <p className="text-sm text-ink-muted">
          This is your profile — you can&apos;t review yourself. Reviews left by customers appear
          here, and you can reply to them from your dashboard.
        </p>
      </Card>
    );
  }

  const editing = Boolean(ownReview);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setFormError(null);

    const result = editing
      ? await apiRequest<ReviewResult>(`/api/reviews/${ownReview!.id}`, {
          method: "PUT",
          body: { rating, title, body },
        })
      : await apiRequest<ReviewResult>("/api/reviews", {
          method: "POST",
          body: { profileSlug, rating, title, body },
        });

    setSubmitting(false);

    if (!result.ok) {
      setErrors(result.error.fieldErrors);
      setFormError(result.error.formErrors[0] ?? result.error.message);
      return;
    }

    router.refresh();
  }

  async function onDelete() {
    if (!ownReview) return;
    if (!window.confirm("Delete your review? This can't be undone.")) return;
    setDeleting(true);
    const result = await apiRequest(`/api/reviews/${ownReview.id}`, { method: "DELETE" });
    setDeleting(false);
    if (result.ok) {
      setRating(0);
      setTitle("");
      setBody("");
      router.refresh();
    } else {
      setFormError(result.error.message);
    }
  }

  const ratingError = firstError(errors, "rating");
  const remaining = LIMITS.reviewBody - body.length;

  return (
    <Card className="space-y-4">
      <h3 className="text-lg font-semibold text-ink">
        {editing ? "Update your review" : "Write a review"}
      </h3>
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Your rating" required error={ratingError}>
          <div className="flex items-center gap-3">
            <StarRatingInput name="rating" value={rating} onChange={setRating} />
            {rating >= 1 && rating <= 5 ? (
              <span className="text-sm text-ink-muted">{RATING_LABELS[rating as RatingValue]}</span>
            ) : null}
          </div>
        </Field>

        <Field
          label="Title"
          htmlFor="review-title"
          error={firstError(errors, "title")}
          hint="Optional — a short summary."
        >
          <Input
            id="review-title"
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Great quality and fast turnaround"
          />
        </Field>

        <Field
          label="Your review"
          htmlFor="review-body"
          required
          error={firstError(errors, "body")}
          hint={`${body.length}/${LIMITS.reviewBody} characters${
            remaining < 0 ? " — too long" : ""
          }`}
        >
          <Textarea
            id="review-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="min-h-32"
            placeholder="Tell others about your experience — what you had made, how it turned out, and how it was to work with this maker."
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : editing ? "Update review" : "Post review"}
          </Button>
          {editing ? (
            <Button type="button" variant="danger" onClick={onDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete review"}
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
