"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  FULFILLMENT_LABELS,
  FULFILLMENT_OPTIONS,
  MACHINE_CATEGORY_LABELS,
  LIMITS,
  type Fulfillment,
  type MachineCategory,
} from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import {
  Alert,
  Button,
  Field,
  Input,
  Select,
  Textarea,
  cn,
} from "@/components/ui";

type MachineOption = {
  id: string;
  make: string;
  model: string;
  category: string;
};

type MaterialOption = {
  id: string;
  name: string;
  unit: string;
  pricePerUnit: number;
  currency: string;
};

type FieldErrors = Record<string, string[]>;

function firstError(errors: FieldErrors, key: string): string | undefined {
  return errors[key]?.[0];
}

async function parseErrors(response: Response): Promise<{ message: string; fields: FieldErrors }> {
  if (response.status === 429) {
    return {
      message: "You are doing that too often. Please wait a moment and try again.",
      fields: {},
    };
  }
  try {
    const data = (await response.json()) as {
      error?: string;
      details?: { fieldErrors?: FieldErrors; formErrors?: string[] };
    };
    return {
      message:
        data.details?.formErrors?.[0] ?? data.error ?? "Something went wrong. Please try again.",
      fields: data.details?.fieldErrors ?? {},
    };
  } catch {
    return { message: "Something went wrong. Please try again.", fields: {} };
  }
}

export function RequestForm({
  profileSlug,
  makerName,
  machines,
  materials,
  offersShipping,
  offersLocalPickup,
  disabled,
}: {
  profileSlug: string;
  makerName: string;
  machines: MachineOption[];
  materials: MaterialOption[];
  offersShipping: boolean;
  offersLocalPickup: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"request" | "message">("request");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    // One-time sync from the URL hash (#message) so a deep link opens the
    // message tab. This is an intentional external-system read on mount.
    if (typeof window !== "undefined" && window.location.hash === "#message") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode("message");
    }
  }, []);

  const fulfillmentOptions = FULFILLMENT_OPTIONS.filter((option) => {
    if (option === "SHIPPING") return offersShipping;
    if (option === "PICKUP") return offersLocalPickup;
    // EITHER only makes sense when both are available.
    return offersShipping && offersLocalPickup;
  });
  const defaultFulfillment: Fulfillment = fulfillmentOptions[0] ?? "PICKUP";

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || disabled) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      profileSlug,
      title: String(data.get("title") ?? ""),
      description: String(data.get("description") ?? ""),
      machineId: String(data.get("machineId") ?? "") || undefined,
      materialId: String(data.get("materialId") ?? "") || undefined,
      quantity: Number(data.get("quantity") ?? 1),
      fulfillment: String(data.get("fulfillment") ?? defaultFulfillment),
      budget: data.get("budget") ? Number(data.get("budget")) : undefined,
      deadline: String(data.get("deadline") ?? "") || undefined,
      fileUrl: String(data.get("fileUrl") ?? "") || undefined,
    };

    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const { message, fields } = await parseErrors(response);
        setFormError(message);
        setFieldErrors(fields);
        return;
      }
      const conversation = (await response.json()) as { id: string };
      router.push(`/messages/${conversation.id}`);
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || disabled) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      profileSlug,
      subject: String(data.get("subject") ?? ""),
      message: String(data.get("message") ?? ""),
    };

    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const { message, fields } = await parseErrors(response);
        setFormError(message);
        setFieldErrors(fields);
        return;
      }
      const conversation = (await response.json()) as { id: string };
      router.push(`/messages/${conversation.id}`);
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const tabClass = (active: boolean) =>
    cn(
      "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
      active ? "bg-ember-50 text-ember-700" : "text-ink-muted hover:bg-surface-muted hover:text-ink",
    );

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Contact mode" className="flex gap-1">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "request"}
          className={tabClass(mode === "request")}
          onClick={() => setMode("request")}
        >
          Print request
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "message"}
          className={tabClass(mode === "message")}
          onClick={() => setMode("message")}
        >
          Just send a message
        </button>
      </div>

      {formError ? <Alert tone="error">{formError}</Alert> : null}

      {mode === "request" ? (
        <form className="space-y-4" onSubmit={submitRequest} noValidate>
          <Field
            label="Title"
            htmlFor="title"
            required
            error={firstError(fieldErrors, "title")}
            hint="A short summary, e.g. “Replacement drone frame in PETG”."
          >
            <Input id="title" name="title" maxLength={120} required disabled={disabled} />
          </Field>

          <Field
            label="Description"
            htmlFor="description"
            required
            error={firstError(fieldErrors, "description")}
            hint="Describe what you need made, dimensions, colours, finish, and anything else that helps."
          >
            <Textarea
              id="description"
              name="description"
              rows={5}
              maxLength={4000}
              required
              disabled={disabled}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Machine" htmlFor="machineId" error={firstError(fieldErrors, "machineId")}>
              <Select id="machineId" name="machineId" defaultValue="" disabled={disabled}>
                <option value="">No preference</option>
                {machines.map((machine) => (
                  <option key={machine.id} value={machine.id}>
                    {machine.make} {machine.model} —{" "}
                    {MACHINE_CATEGORY_LABELS[machine.category as MachineCategory] ?? machine.category}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Material"
              htmlFor="materialId"
              error={firstError(fieldErrors, "materialId")}
            >
              <Select id="materialId" name="materialId" defaultValue="" disabled={disabled}>
                <option value="">No preference</option>
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.name} —{" "}
                    {formatPrice(material.pricePerUnit, material.unit, material.currency)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Quantity"
              htmlFor="quantity"
              error={firstError(fieldErrors, "quantity")}
            >
              <Input
                id="quantity"
                name="quantity"
                type="number"
                min={1}
                max={10000}
                defaultValue={1}
                disabled={disabled}
              />
            </Field>

            <Field
              label="Fulfilment"
              htmlFor="fulfillment"
              error={firstError(fieldErrors, "fulfillment")}
            >
              <Select
                id="fulfillment"
                name="fulfillment"
                defaultValue={defaultFulfillment}
                disabled={disabled}
              >
                {fulfillmentOptions.map((option) => (
                  <option key={option} value={option}>
                    {FULFILLMENT_LABELS[option]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Budget (USD)"
              htmlFor="budget"
              error={firstError(fieldErrors, "budget")}
              hint="Optional — helps the maker gauge scope."
            >
              <Input
                id="budget"
                name="budget"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                disabled={disabled}
              />
            </Field>

            <Field
              label="Deadline"
              htmlFor="deadline"
              error={firstError(fieldErrors, "deadline")}
              hint="Optional — when do you need it by?"
            >
              <Input id="deadline" name="deadline" type="date" disabled={disabled} />
            </Field>
          </div>

          <Field
            label="File link"
            htmlFor="fileUrl"
            error={firstError(fieldErrors, "fileUrl")}
            hint="Link to a Drive, Dropbox or Printables URL — direct uploads are not supported yet."
          >
            <Input
              id="fileUrl"
              name="fileUrl"
              type="url"
              placeholder="https://…"
              disabled={disabled}
            />
          </Field>

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting || disabled}>
              {submitting ? "Sending…" : "Send print request"}
            </Button>
          </div>
        </form>
      ) : (
        <form id="message" className="space-y-4" onSubmit={submitMessage} noValidate>
          <Field
            label="Subject"
            htmlFor="subject"
            required
            error={firstError(fieldErrors, "subject")}
          >
            <Input
              id="subject"
              name="subject"
              maxLength={120}
              required
              disabled={disabled}
              placeholder={`Question for ${makerName}`}
            />
          </Field>

          <Field
            label="Message"
            htmlFor="message"
            required
            error={firstError(fieldErrors, "message")}
          >
            <Textarea
              id="message-body"
              name="message"
              rows={6}
              maxLength={LIMITS.messageBody}
              required
              disabled={disabled}
            />
          </Field>

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting || disabled}>
              {submitting ? "Sending…" : "Send message"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
