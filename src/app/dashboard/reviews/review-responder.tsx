"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, Button, Field, Textarea } from "@/components/ui";
import { apiRequest, firstError, type FieldErrors } from "@/components/dashboard/client";
import { LIMITS } from "@/lib/constants";

export function ReviewResponder({
  reviewId,
  initialResponse,
}: {
  reviewId: string;
  initialResponse: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(!initialResponse);
  const [body, setBody] = useState<string>(initialResponse ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const hasResponse = Boolean(initialResponse);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setFormError(null);

    const result = await apiRequest<{ id: string }>(`/api/reviews/${reviewId}/response`, {
      method: "POST",
      body: { body },
    });

    setSubmitting(false);

    if (!result.ok) {
      setErrors(result.error.fieldErrors);
      setFormError(result.error.formErrors[0] ?? result.error.message);
      return;
    }

    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
        {hasResponse ? "Edit reply" : "Reply"}
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-3">
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <Field
        label={hasResponse ? "Edit your public reply" : "Write a public reply"}
        htmlFor={`response-${reviewId}`}
        error={firstError(errors, "body")}
        hint={`${body.length}/${LIMITS.reviewBody} characters · Your reply is shown publicly beneath this review.`}
      >
        <Textarea
          id={`response-${reviewId}`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Thanks for the feedback…"
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Saving…" : hasResponse ? "Save reply" : "Post reply"}
        </Button>
        {hasResponse ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setBody(initialResponse ?? "");
              setErrors({});
              setFormError(null);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
