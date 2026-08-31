import type { Metadata } from "next";
import Link from "next/link";

import { requireSessionUser } from "@/lib/session";
import { listConversations } from "@/lib/services/messaging";
import { buttonClass, Card, EmptyState, SectionHeading } from "@/components/ui";
import {
  ConversationList,
  normalizeFilter,
} from "@/components/messaging/conversation-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Messages",
};

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requireSessionUser("/messages");
  const { filter: filterParam } = await searchParams;
  const filter = normalizeFilter(filterParam);
  const conversations = await listConversations(user.id);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Inbox"
        title="Messages"
        description="Your conversations with makers and customers. Print requests appear here too."
      />

      {conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          description="When you contact a maker or receive a print request, the thread will show up here."
          action={
            <Link href="/browse" className={buttonClass("primary", "md")}>
              Browse makers
            </Link>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
          <Card className="overflow-hidden p-0">
            <ConversationList conversations={conversations} filter={filter} />
          </Card>
          <Card className="hidden flex-col items-center justify-center text-center lg:flex">
            <div className="max-w-sm space-y-2 py-12">
              <p className="text-base font-semibold text-ink">Select a conversation</p>
              <p className="text-sm text-ink-muted">
                Pick a thread on the left to read the full conversation, review the print
                request details, and reply.
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
