import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSessionUser } from "@/lib/session";
import { getConversation, markConversationRead } from "@/lib/services/messaging";
import { FULFILLMENT_LABELS, type Fulfillment } from "@/lib/constants";
import { formatDate, formatMoney, formatPrice } from "@/lib/format";
import { Badge, Card } from "@/components/ui";
import { Avatar } from "@/components/messaging/avatar";
import { MessageThread } from "@/components/messaging/message-thread";
import { RequestActions } from "@/components/messaging/request-actions";
import {
  isRequestClosed,
  RequestStatusBadge,
} from "@/components/messaging/request-status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conversation",
};

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
      <dt className="w-32 shrink-0 text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireSessionUser(`/messages/${id}`);

  let data;
  try {
    data = await getConversation(user.id, id);
  } catch {
    notFound();
  }

  const { conversation, role } = data;
  await markConversationRead(user.id, id);

  const counterpartName =
    role === "REQUESTER"
      ? conversation.providerProfile.displayName
      : conversation.requester.name ?? "Customer";
  const counterpartImage =
    role === "REQUESTER"
      ? conversation.providerProfile.avatarUrl
      : conversation.requester.image;

  const request = conversation.request;
  const requestClosed = request ? isRequestClosed(request.status) : false;

  const initialMessages = conversation.messages.map((message) => ({
    id: message.id,
    body: message.body,
    senderId: message.senderId,
    createdAt: message.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/messages"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink"
      >
        ← Back to messages
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,340px)]">
        <Card className="flex min-h-[70vh] flex-col p-0">
          <header className="flex items-center gap-3 border-b border-line px-5 py-4">
            <Avatar name={counterpartName} image={counterpartImage} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{counterpartName}</p>
              <p className="truncate text-sm text-ink-muted">{conversation.subject}</p>
              <Link
                href={`/p/${conversation.providerProfile.slug}`}
                className="text-xs font-medium text-blueprint-600 hover:text-blueprint-700"
              >
                View {conversation.providerProfile.displayName} profile
              </Link>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col px-5 pb-4">
            <MessageThread
              conversationId={conversation.id}
              currentUserId={user.id}
              counterpartName={counterpartName}
              initialMessages={initialMessages}
            />
          </div>
        </Card>

        <aside className="space-y-4">
          {request ? (
            <Card className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                  Print request
                </h2>
                <RequestStatusBadge status={request.status} />
              </div>

              <p className="whitespace-pre-wrap text-sm text-ink">{request.description}</p>

              <dl className="space-y-2.5">
                {request.machine ? (
                  <DetailRow label="Machine">
                    {request.machine.make} {request.machine.model}
                  </DetailRow>
                ) : null}
                {request.material ? (
                  <DetailRow label="Material">
                    {request.material.name} ·{" "}
                    {formatPrice(request.material.pricePerUnit, request.material.unit)}
                  </DetailRow>
                ) : null}
                <DetailRow label="Quantity">{request.quantity}</DetailRow>
                <DetailRow label="Fulfilment">
                  {FULFILLMENT_LABELS[request.fulfillment as Fulfillment] ?? request.fulfillment}
                </DetailRow>
                {request.budgetCents !== null ? (
                  <DetailRow label="Budget">{formatMoney(request.budgetCents / 100)}</DetailRow>
                ) : null}
                {request.deadline ? (
                  <DetailRow label="Deadline">{formatDate(request.deadline)}</DetailRow>
                ) : null}
                {request.fileUrl ? (
                  <DetailRow label="Files">
                    <a
                      href={request.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all font-medium text-blueprint-600 hover:text-blueprint-700"
                    >
                      Open file link
                    </a>
                  </DetailRow>
                ) : null}
              </dl>

              {requestClosed ? (
                <Badge tone="neutral">This request is closed.</Badge>
              ) : (
                <RequestActions requestId={request.id} role={role} />
              )}
            </Card>
          ) : (
            <Card>
              <h2 className="text-sm font-semibold text-ink">Direct message</h2>
              <p className="mt-1 text-sm text-ink-muted">
                This conversation isn’t tied to a structured print request.
              </p>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
