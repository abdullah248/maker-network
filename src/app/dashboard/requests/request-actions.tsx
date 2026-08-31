"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, Badge, Button, Field, Input, Textarea } from "@/components/ui";
import { apiRequest, firstError, type FieldErrors } from "@/components/dashboard/client";

type Mode = "idle" | "accept" | "decline";

const DECLINE_REASONS = [
  "I don't stock that material",
  "The part is too large for my machine",
  "I'm fully booked right now",
  "Outside what I can do safely",
];

const CLOSED_COPY: Record<string, string> = {
  ACCEPTED: "You've accepted this request. Mark it complete once you've finished the job.",
  COMPLETED: "This request is complete. No further action is needed.",
  DECLINED: "You declined this request, so there's nothing left to do here.",
  CANCELLED: "The customer cancelled this request, so there's nothing left to do here.",
};

export function RequestActions({
  requestId,
  status,
  role,
}: {
  requestId: string;
  status: string;
  role: "REQUESTER" | "PROVIDER";
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [quotedPrice, setQuotedPrice] = useState("");
  const [quotedLeadDays, setQuotedLeadDays] = useState("");
  const [message, setMessage] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (role !== "PROVIDER") {
    return (
      <p className="text-sm text-ink-muted">
        Only the maker can respond to this request.
      </p>
    );
  }

  const isClosed = status === "COMPLETED" || status === "DECLINED" || status === "CANCELLED";
  if (isClosed) {
    return (
      <Alert tone={status === "COMPLETED" ? "success" : "info"}>
        {CLOSED_COPY[status] ?? "This request is closed."}
      </Alert>
    );
  }

  function resetForms() {
    setErrors({});
    setFormError(null);
  }

  async function submit(body: Record<string, unknown>) {
    setSubmitting(true);
    setErrors({});
    setFormError(null);

    const result = await apiRequest(`/api/requests/${requestId}/decision`, {
      method: "POST",
      body,
    });

    setSubmitting(false);

    if (!result.ok) {
      setErrors(result.error.fieldErrors);
      setFormError(result.error.formErrors[0] ?? result.error.message);
      return;
    }

    setMode("idle");
    setQuotedPrice("");
    setQuotedLeadDays("");
    setMessage("");
    setDeclineReason("");
    router.refresh();
  }

  function onAccept(event: React.FormEvent) {
    event.preventDefault();
    void submit({
      decision: "ACCEPTED",
      quotedPrice: quotedPrice.trim() === "" ? undefined : Number(quotedPrice),
      quotedLeadDays: quotedLeadDays.trim() === "" ? undefined : Number(quotedLeadDays),
      message: message.trim() === "" ? undefined : message.trim(),
    });
  }

  function onDecline(event: React.FormEvent) {
    event.preventDefault();
    void submit({
      decision: "DECLINED",
      declineReason: declineReason.trim() === "" ? undefined : declineReason.trim(),
      message: message.trim() === "" ? undefined : message.trim(),
    });
  }

  function onComplete() {
    if (!window.confirm("Mark this request as complete? The customer will be notified.")) return;
    void submit({ decision: "COMPLETED" });
  }

  // ACCEPTED requests can only be completed. OPEN requests can be accepted or declined.
  if (status === "ACCEPTED") {
    return (
      <div className="space-y-3">
        {formError ? <Alert tone="error">{formError}</Alert> : null}
        <p className="text-sm text-ink-muted">
          You&apos;ve accepted this job. Mark it complete once the parts are finished and handed over.
        </p>
        <Button type="button" onClick={onComplete} disabled={submitting}>
          {submitting ? "Working…" : "Mark complete"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {status === "OPEN" ? (
        <Badge tone="ember">Needs your response</Badge>
      ) : null}

      {formError ? <Alert tone="error">{formError}</Alert> : null}

      {mode === "idle" ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            Accepting isn&apos;t a binding contract — it simply tells the customer you&apos;ll take the
            job so you can finish sorting out the details in chat.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                resetForms();
                setMode("accept");
              }}
            >
              Accept
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForms();
                setMode("decline");
              }}
            >
              Decline
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "accept" ? (
        <form onSubmit={onAccept} className="space-y-4">
          <p className="text-sm text-ink-muted">
            Share a quote if you can. Accepting signals you&apos;ll take the job — it&apos;s not a
            binding contract, and you can still refine details in chat.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Quoted price (USD)"
              htmlFor="quotedPrice"
              hint="Optional"
              error={firstError(errors, "quotedPrice")}
            >
              <Input
                id="quotedPrice"
                type="number"
                min={0}
                step="0.01"
                value={quotedPrice}
                onChange={(e) => setQuotedPrice(e.target.value)}
              />
            </Field>
            <Field
              label="Lead time (days)"
              htmlFor="quotedLeadDays"
              hint="Optional"
              error={firstError(errors, "quotedLeadDays")}
            >
              <Input
                id="quotedLeadDays"
                type="number"
                min={0}
                step="1"
                value={quotedLeadDays}
                onChange={(e) => setQuotedLeadDays(e.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Message to the customer"
            htmlFor="acceptMessage"
            hint="Optional — posted to the conversation."
            error={firstError(errors, "message")}
          >
            <Textarea
              id="acceptMessage"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Happy to take this on — I'll start once we confirm the colour."
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Accepting…" : "Confirm accept"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => {
                resetForms();
                setMode("idle");
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {mode === "decline" ? (
        <form onSubmit={onDecline} className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {DECLINE_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => setDeclineReason(reason)}
                className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
              >
                {reason}
              </button>
            ))}
          </div>
          <Field
            label="Reason for declining"
            htmlFor="declineReason"
            required
            hint="The customer sees this, so keep it brief and kind."
            error={firstError(errors, "declineReason")}
          >
            <Textarea
              id="declineReason"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Let the customer know why you can't take this on."
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={submitting}>
              {submitting ? "Declining…" : "Confirm decline"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => {
                resetForms();
                setMode("idle");
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
