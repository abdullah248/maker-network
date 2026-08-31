import { StarRating } from "@/components/star-rating";
import { Badge, Card, EmptyState, SectionHeading } from "@/components/ui";
import { ReviewForm, type OwnReviewDTO } from "@/components/public/review-form";
import { formatDate, initials } from "@/lib/format";
import { RATING_VALUES } from "@/lib/constants";
import { getOwnReview, getRatingSummary, listReviews } from "@/lib/services/reviews";

type ReviewsSectionProfile = {
  id: string;
  slug: string;
  displayName: string;
  userId: string;
};

function RatingSummaryCard({
  average,
  count,
  breakdown,
}: {
  average: number;
  count: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
}) {
  return (
    <Card className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <div className="flex shrink-0 flex-col items-center gap-1 text-center sm:w-40">
        <span className="text-5xl font-semibold text-ink">{average.toFixed(1)}</span>
        <StarRating value={average} size="lg" showValue={false} />
        <span className="text-sm text-ink-muted">
          {count} review{count === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex-1 space-y-1.5">
        {[...RATING_VALUES].reverse().map((star) => {
          const value = breakdown[star];
          const pct = count === 0 ? 0 : Math.round((value / count) * 100);
          return (
            <div key={star} className="flex items-center gap-3 text-sm">
              <span className="w-12 shrink-0 text-ink-muted">
                {star} star{star === 1 ? "" : "s"}
              </span>
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
  );
}

export async function ReviewsSection({
  profile,
  viewerId,
}: {
  profile: ReviewsSectionProfile;
  viewerId: string | null;
}) {
  const [reviews, summary, ownReview] = await Promise.all([
    listReviews(profile.id),
    getRatingSummary(profile.id),
    getOwnReview(profile.id, viewerId),
  ]);

  const isOwner = viewerId != null && viewerId === profile.userId;
  const ownReviewDto: OwnReviewDTO | null = ownReview
    ? { id: ownReview.id, rating: ownReview.rating, title: ownReview.title, body: ownReview.body }
    : null;

  return (
    <section aria-labelledby="reviews-heading">
      <SectionHeading
        title="Reviews"
        description="Ratings and written feedback from customers who worked with this maker."
      />
      <span id="reviews-heading" className="sr-only">
        Reviews
      </span>

      <div className="space-y-6">
        {summary.count > 0 ? (
          <RatingSummaryCard
            average={summary.average}
            count={summary.count}
            breakdown={summary.breakdown}
          />
        ) : null}

        <ReviewForm
          profileSlug={profile.slug}
          signedIn={viewerId != null}
          isOwner={isOwner}
          ownReview={ownReviewDto}
        />

        {reviews.length === 0 ? (
          <EmptyState
            title="No reviews yet"
            description="Be the first to share your experience with this maker."
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
                        <p className="font-semibold text-ink">
                          {review.author.name ?? "Anonymous"}
                        </p>
                        {review.verified ? (
                          <span
                            className="cursor-help"
                            title="This customer completed a request with this maker before reviewing."
                          >
                            <Badge tone="moss">Verified project</Badge>
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StarRating value={review.rating} size="sm" showValue={false} />
                        <span className="text-xs text-ink-muted">
                          {formatDate(review.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {review.title ? (
                    <p className="font-medium text-ink">{review.title}</p>
                  ) : null}
                  <p className="whitespace-pre-wrap text-sm text-ink-muted">{review.body}</p>

                  {review.providerResponse ? (
                    <div className="rounded-lg border-l-2 border-ember-200 bg-surface-muted px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        Response from {profile.displayName}
                        {review.providerRespondedAt
                          ? ` · ${formatDate(review.providerRespondedAt)}`
                          : ""}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
                        {review.providerResponse}
                      </p>
                    </div>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
