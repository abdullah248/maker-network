export type FieldErrors = Record<string, string[] | undefined>;

export type ApiErrorResult = {
  message: string;
  fieldErrors: FieldErrors;
  formErrors: string[];
};

type ZodFlatten = {
  formErrors?: string[];
  fieldErrors?: FieldErrors;
};

/**
 * Performs a JSON request and, on failure, extracts the API's error message
 * plus any Zod `flatten()` field errors returned under `details`.
 */
export async function apiRequest<T>(
  url: string,
  options: { method: string; body?: unknown },
): Promise<{ ok: true; data: T } | { ok: false; error: ApiErrorResult }> {
  const response = await fetch(url, {
    method: options.method,
    headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.ok) {
    return { ok: true, data: payload as T };
  }

  const record = (payload ?? {}) as {
    error?: string;
    details?: ZodFlatten;
  };
  const details = record.details ?? {};

  return {
    ok: false,
    error: {
      message: record.error ?? "Something went wrong. Please try again.",
      fieldErrors: details.fieldErrors ?? {},
      formErrors: details.formErrors ?? [],
    },
  };
}

export function firstError(errors: FieldErrors, field: string): string | undefined {
  return errors[field]?.[0];
}
