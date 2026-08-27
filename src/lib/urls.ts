const DEFAULT_CALLBACK = "/dashboard";

/**
 * Returns a safe same-origin redirect target.
 *
 * Only single-slash relative paths are allowed. Protocol-relative forms
 * (`//evil.com`), backslash variants that some browsers normalise to a
 * protocol-relative URL (`/\evil.com`), absolute URLs and control characters
 * are all rejected in favour of {@link DEFAULT_CALLBACK}.
 */
export function safeCallbackUrl(
  raw: string | string[] | undefined | null,
  fallback: string = DEFAULT_CALLBACK,
): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return fallback;

   
  const cleaned = value.replace(/[\u0000-\u001f\u007f\s]/g, "");
  if (cleaned.length === 0 || cleaned.length > 512) return fallback;
  if (!cleaned.startsWith("/")) return fallback;
  // Reject "//host" and "/\host" — both can resolve to another origin.
  if (cleaned[1] === "/" || cleaned[1] === "\\") return fallback;
  if (cleaned.includes("\\")) return fallback;
  // A colon before the first slash would make this an absolute URL.
  if (/^\/[^/?#]*:/.test(cleaned)) return fallback;

  return cleaned;
}

/** Builds a `/signin?callbackUrl=…` link with the target safely encoded. */
export function signInHref(callbackUrl: string, intent?: string) {
  const params = new URLSearchParams({ callbackUrl: safeCallbackUrl(callbackUrl, callbackUrl) });
  if (intent) params.set("intent", intent);
  return `/signin?${params.toString()}`;
}
