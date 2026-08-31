import { cn } from "@/components/ui";

const STAR_PATH =
  "M12 2.6l2.72 5.51 6.08.88-4.4 4.29 1.04 6.06L12 16.48l-5.44 2.86 1.04-6.06-4.4-4.29 6.08-.88L12 2.6z";

const SIZES = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-6 w-6",
} as const;

/**
 * Read-only star rating. Rendered as a single labelled image for screen
 * readers rather than five separate icons.
 */
export function StarRating({
  value,
  count,
  size = "md",
  showValue = true,
  className,
}: {
  value: number;
  count?: number;
  size?: keyof typeof SIZES;
  showValue?: boolean;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(5, value));
  const label =
    count === 0
      ? "No reviews yet"
      : `Rated ${clamped.toFixed(1)} out of 5${count ? ` from ${count} review${count === 1 ? "" : "s"}` : ""}`;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span role="img" aria-label={label} className="relative inline-flex">
        <span className="inline-flex text-line">
          {[0, 1, 2, 3, 4].map((index) => (
            <svg key={index} viewBox="0 0 24 24" aria-hidden className={SIZES[size]} fill="currentColor">
              <path d={STAR_PATH} />
            </svg>
          ))}
        </span>
        <span
          aria-hidden
          className="absolute inset-0 inline-flex overflow-hidden text-ember-500"
          style={{ width: `${(clamped / 5) * 100}%` }}
        >
          {[0, 1, 2, 3, 4].map((index) => (
            <svg
              key={index}
              viewBox="0 0 24 24"
              className={cn(SIZES[size], "shrink-0")}
              fill="currentColor"
            >
              <path d={STAR_PATH} />
            </svg>
          ))}
        </span>
      </span>

      {showValue ? (
        <span className="text-sm text-ink-muted">
          {count === 0 ? (
            "No reviews yet"
          ) : (
            <>
              <span className="font-medium text-ink">{clamped.toFixed(1)}</span>
              {typeof count === "number" ? ` (${count})` : null}
            </>
          )}
        </span>
      ) : null}
    </span>
  );
}

/** Interactive 1-5 star input backed by a native radio group. */
export function StarRatingInput({
  name,
  value,
  onChange,
  disabled,
}: {
  name: string;
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="flex items-center gap-1" disabled={disabled}>
      <legend className="sr-only">Your rating</legend>
      {[1, 2, 3, 4, 5].map((star) => (
        <label
          key={star}
          className="cursor-pointer p-0.5"
          title={`${star} star${star === 1 ? "" : "s"}`}
        >
          <input
            type="radio"
            name={name}
            value={star}
            checked={value === star}
            onChange={() => onChange(star)}
            className="sr-only"
          />
          <span className="sr-only">{`${star} star${star === 1 ? "" : "s"}`}</span>
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className={cn(
              "h-7 w-7 transition-colors",
              star <= value ? "text-ember-500" : "text-line hover:text-ember-200",
            )}
            fill="currentColor"
          >
            <path d={STAR_PATH} />
          </svg>
        </label>
      ))}
    </fieldset>
  );
}
