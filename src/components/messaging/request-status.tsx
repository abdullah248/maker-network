import { Badge, type BadgeTone } from "@/components/ui";

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open request",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_TONES: Record<string, BadgeTone> = {
  OPEN: "blueprint",
  ACCEPTED: "moss",
  DECLINED: "danger",
  COMPLETED: "moss",
  CANCELLED: "neutral",
};

/** True once a request can no longer change state. */
export function isRequestClosed(status: string): boolean {
  return status === "COMPLETED" || status === "CANCELLED" || status === "DECLINED";
}

export function RequestStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? "neutral"}>{STATUS_LABELS[status] ?? status}</Badge>
  );
}

export function RoleBadge({ role }: { role: "REQUESTER" | "PROVIDER" }) {
  return role === "REQUESTER" ? (
    <Badge tone="ember">You asked</Badge>
  ) : (
    <Badge tone="blueprint">Request received</Badge>
  );
}
