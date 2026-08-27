"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui";

type Action = {
  status: "ACCEPTED" | "DECLINED" | "COMPLETED" | "CANCELLED";
  label: string;
  variant: "primary" | "secondary" | "outline" | "danger";
};

const PROVIDER_ACTIONS: Action[] = [
  { status: "ACCEPTED", label: "Accept", variant: "primary" },
  { status: "COMPLETED", label: "Mark complete", variant: "secondary" },
  { status: "DECLINED", label: "Decline", variant: "outline" },
];

const REQUESTER_ACTIONS: Action[] = [
  { status: "CANCELLED", label: "Cancel request", variant: "danger" },
];

export function RequestActions({
  requestId,
  role,
}: {
  requestId: string;
  role: "REQUESTER" | "PROVIDER";
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actions = role === "PROVIDER" ? PROVIDER_ACTIONS : REQUESTER_ACTIONS;

  async function apply(status: Action["status"]) {
    if (pending) return;
    setPending(status);
    setError(null);
    try {
      const response = await fetch(`/api/requests/${requestId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not update the request.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.status}
            type="button"
            size="sm"
            variant={action.variant}
            disabled={pending !== null}
            onClick={() => void apply(action.status)}
          >
            {pending === action.status ? "Working…" : action.label}
          </Button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
