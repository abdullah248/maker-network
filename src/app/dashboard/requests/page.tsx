import Link from "next/link";

import { requireSessionUser } from "@/lib/session";
import {
  listIncomingRequests,
  requestCountsByStatus,
  type DetailedRequest,
} from "@/lib/services/requests";
import { formatDate, formatRelative, initials } from "@/lib/format";
import { PROCESS_LABELS, type Process } from "@/lib/print-specs";
import {
  buttonClass,
  Card,
  EmptyState,
  SectionHeading,
} from "@/components/ui";
import { RequestStatusBadge } from "@/components/requests/spec-sheet";
import { NoProfileNotice } from "@/components/dashboard/no-profile-notice";

export const dynamic = "force-dynamic";

const STATUS_TABS = [
  { value: "ALL", label: "All" },
  { value: "OPEN", label: "Needs review" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "COMPLETED", label: "Completed" },
  { value: "DECLINED", label: "Declined" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

const VALID_STATUSES = new Set<string>(STATUS_TABS.map((tab) => tab.value));

const DAY_MS = 1000 * 60 * 60 * 24;

function deadlineTone(deadline: Date | null): { label: string; urgent: boolean } | null {
  if (!deadline) return null;
  const diffDays = Math.ceil((deadline.getTime() - Date.now()) / DAY_MS);
  if (diffDays < 0) return { label: `Overdue · ${formatDate(deadline)}`, urgent: true };
  if (diffDays <= 7) return { label: `Due ${formatDate(deadline)}`, urgent: true };
  return { label: `Due ${formatDate(deadline)}`, urgent: false };
}

function RequestRow({ request }: { request: DetailedRequest }) {
  const customerName = request.conversation.requester.name ?? "Customer";
  const fileCount = request.files.length;
  const deadline = deadlineTone(request.deadline);
  const isOpen = request.status === "OPEN";

  return (
    <Card
      className={
        isOpen
          ? "border-ember-200 bg-ember-50/40 transition-colors"
          : "transition-colors hover:border-ember-200"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-ink-muted"
          >
            {initials(customerName)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/dashboard/requests/${request.id}`}
                className="truncate text-base font-semibold text-ink hover:text-ember-700"
              >
                {request.title}
              </Link>
              <RequestStatusBadge status={request.status} />
            </div>
            <p className="mt-0.5 text-sm text-ink-muted">
              From {customerName} · {formatRelative(request.createdAt)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
              <span className="font-medium text-ink">
                {PROCESS_LABELS[request.process as Process] ?? request.process}
              </span>
              {request.materialType ? <span>· {request.materialType}</span> : null}
              <span>· Qty {request.quantity}</span>
              <span>
                · {fileCount} file{fileCount === 1 ? "" : "s"}
              </span>
              {deadline ? (
                <span
                  className={
                    deadline.urgent
                      ? "rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700"
                      : ""
                  }
                >
                  {deadline.urgent ? "" : "· "}
                  {deadline.label}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <Link
            href={`/dashboard/requests/${request.id}`}
            className={buttonClass("primary", "sm")}
          >
            Review
          </Link>
          <Link
            href={`/messages/${request.conversation.id}`}
            className={buttonClass("outline", "sm")}
          >
            Open chat
          </Link>
        </div>
      </div>
    </Card>
  );
}

export default async function RequestsQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireSessionUser("/dashboard/requests");
  const params = await searchParams;
  const status =
    params.status && VALID_STATUSES.has(params.status) ? params.status : "ALL";

  let requests: DetailedRequest[];
  let counts: Record<string, number>;
  try {
    [requests, counts] = await Promise.all([
      listIncomingRequests(user.id, status),
      requestCountsByStatus(user.id),
    ]);
  } catch {
    return (
      <div className="space-y-6">
        <SectionHeading
          eyebrow="Requests"
          title="Request queue"
          description="Review incoming fabrication requests, answer questions and respond with a quote."
        />
        <NoProfileNotice feature="incoming requests" />
      </div>
    );
  }

  // Surface OPEN requests that still need a response at the top of the list.
  const sorted = [...requests].sort((a, b) => {
    if (a.status === "OPEN" && b.status !== "OPEN") return -1;
    if (a.status !== "OPEN" && b.status === "OPEN") return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Requests"
        title="Request queue"
        description="Review incoming fabrication requests, answer questions and respond with a quote."
      />

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const active = tab.value === status;
          const count = counts[tab.value] ?? 0;
          return (
            <Link
              key={tab.value}
              href={
                tab.value === "ALL"
                  ? "/dashboard/requests"
                  : `/dashboard/requests?status=${tab.value}`
              }
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "inline-flex items-center gap-2 rounded-full bg-ember-500 px-4 py-1.5 text-sm font-medium text-white"
                  : "inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
              }
            >
              {tab.label}
              <span
                className={
                  active
                    ? "rounded-full bg-white/20 px-1.5 text-xs"
                    : "rounded-full bg-surface-muted px-1.5 text-xs text-ink-muted"
                }
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description={
            status === "ALL"
              ? "When customers send you fabrication requests, they'll show up here for review."
              : "No requests match this filter right now."
          }
        />
      ) : (
        <div className="space-y-3">
          {sorted.map((request) => (
            <RequestRow key={request.id} request={request} />
          ))}
        </div>
      )}
    </div>
  );
}
