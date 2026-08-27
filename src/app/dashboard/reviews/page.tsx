import { StarRating } from "@/components/star-rating";
import { Badge, Card, EmptyState, SectionHeading } from "@/components/ui";
import { NoProfileNotice } from "@/components/dashboard/no-profile-notice";
import { formatDate, initials } from "@/lib/format";
import { RATING_VALUES } from "@/lib/constants";
import { requireSessionUser } from "@/lib/session";
import { listReviewsForOwnProfile } from "@/lib/services/reviews";
import { ReviewResponder } from "./review-responder";

export const dynamic = "force-dynamic";

export default async function DashboardReviewsPage() {
  const user = await requireSessionUser("/dashboard/reviews");

  let data: Awaited<ReturnType<typeof listReviewsForOwnProfile>>;
  try {
    data = await listReviewsForOwnProfile(user.id);
  } catch {
    return (
      <div className="space-y-6">
        <SectionHeading
          eyebrow="Reviews"
          title="Customer reviews"
          description="See what customers say about your work and reply to their feedback."
        />
        <NoProfileNotice feature="reviews" />
      </div>
    );
  }

  const { reviews, summary } = data;

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Reviews"
        title="Customer reviews"
        description="Reply publicly to build trust. You can respond to reviews but can't delete them — only the customer who wrote a review can remove it."
      />

      <Card className="flex flex-wrap items-center gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-4xl font-semibold text-ink">{summary.average.toFixed(1)}</span>
          <StarRating value={summary.average} size="md" showValue={false} />
          <span className="text-sm text-ink-muted">
            {summary.count} review{summary.count === 1 ? "" : "s"}
          </span>
        </div>
        <div className="min-w-48 flex-1 space-y-1.5">
          {[...RATING_VALUES].reverse().map((star) => {
            const value = summary.breakdown[star];
            const pct = summary.count === 0 ? 0 : Math.round((value / summary.count) * 100);
            return (
              <div key={star} className="flex items-center gap-3 text-sm">
                <span className="w-12 shrink-0 text-ink-muted">{star}★</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <span
                    className="block h-full rounded-full bg-ember-500"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right text-ink-muted">{value}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {reviews.length === 0 ? (
        <EmptyState
          title="No reviews yet"
          description="Once customers complete requests with you, their reviews will show up here."
        />
      ) : (
        <ul className="space-y-4">
          {reviews.map((review) => (
            <li key={review.id}>
              <Card className="space-y-3">
                <div className="flex items-start gap-3">
                  {review.author.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={review.author.image}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blueprint-100 text-sm font-semibold text-blueprint-700"
                    >
                      {initials(review.author.name)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">{review.author.name ?? "Anonymous"}</p>
                      {review.verified ? (
                        <span
                          className="cursor-help"
                          title="This customer completed a request with you before reviewing."
                        >
                          <Badge tone="moss">Verified project</Badge>
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StarRating value={review.rating} size="sm" showValue={false} />
                      <span className="text-xs text-ink-muted">{formatDate(review.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {review.title ? <p className="font-medium text-ink">{review.title}</p> : null}
                <p className="whitespace-pre-wrap text-sm text-ink-muted">{review.body}</p>

                {review.providerResponse ? (
                  <div className="rounded-lg border-l-2 border-ember-200 bg-surface-muted px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Your response
                      {review.providerRespondedAt
                        ? ` · ${formatDate(review.providerRespondedAt)}`
                        : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
                      {review.providerResponse}
                    </p>
                  </div>
                ) : null}

                <ReviewResponder
                  reviewId={review.id}
                  initialResponse={review.providerResponse}
                />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
