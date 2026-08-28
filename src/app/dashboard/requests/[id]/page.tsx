import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSessionUser } from "@/lib/session";
import { getRequestForViewer } from "@/lib/services/requests";
import { formatDate, formatDateTime, initials } from "@/lib/format";
import { Badge, buttonClass, Card } from "@/components/ui";
import { RequestSpecSheet } from "@/components/requests/spec-sheet";
import { RequestActions } from "../request-actions";

export const dynamic = "force-dynamic";

const DAY_MS = 1000 * 60 * 60 * 24;

function isDeadlineUrgent(deadline: Date | null): boolean {
  if (!deadline) return false;
  return Math.ceil((deadline.getTime() - Date.now()) / DAY_MS) <= 7;
}

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireSessionUser(`/dashboard/requests/${id}`);

  let data;
  try {
    data = await getRequestForViewer(user.id, id);
  } catch {
    notFound();
  }

  const { request, role } = data;
  const customer = request.conversation.requester;
  const customerName = customer.name ?? "Customer";

  const deadline = request.deadline;
  const deadlineUrgent = isDeadlineUrgent(deadline);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/requests"
        className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink"
      >
        ← Back to requests
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,340px)]">
        <div className="space-y-6">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 gap-3">
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold text-ink-muted"
                >
                  {initials(customerName)}
                </span>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-ink">{customerName}</p>
                  {customer.email ? (
                    <p className="truncate text-sm text-ink-muted">{customer.email}</p>
                  ) : null}
                  <p className="text-xs text-ink-muted">
                    Requested {formatDateTime(request.createdAt)}
                  </p>
                </div>
              </div>
              {deadline ? (
                <Badge tone={deadlineUrgent ? "danger" : "neutral"}>
                  Due {formatDate(deadline)}
                </Badge>
              ) : null}
            </div>

            <Link
              href={`/messages/${request.conversation.id}`}
              className={buttonClass("primary", "md")}
            >
              Open chat / ask a question
            </Link>
          </Card>

          <RequestSpecSheet request={request} />
        </div>

        <aside className="space-y-4">
          <Card className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Respond
            </h2>
            <RequestActions requestId={request.id} status={request.status} role={role} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
