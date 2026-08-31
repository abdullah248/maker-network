import Link from "next/link";

import type { ConversationSummary } from "@/lib/services/messaging";
import { formatRelative } from "@/lib/format";
import { cn } from "@/components/ui";
import { Avatar } from "@/components/messaging/avatar";
import { RequestStatusBadge, RoleBadge } from "@/components/messaging/request-status";

export const CONVERSATION_FILTERS = ["all", "received", "sent", "open"] as const;
export type ConversationFilter = (typeof CONVERSATION_FILTERS)[number];

const FILTER_TABS: Array<{ value: ConversationFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "received", label: "Received" },
  { value: "sent", label: "Sent" },
  { value: "open", label: "Open requests" },
];

export function normalizeFilter(value: string | undefined): ConversationFilter {
  return CONVERSATION_FILTERS.includes(value as ConversationFilter)
    ? (value as ConversationFilter)
    : "all";
}

function matchesFilter(conversation: ConversationSummary, filter: ConversationFilter): boolean {
  switch (filter) {
    case "received":
      return conversation.role === "PROVIDER";
    case "sent":
      return conversation.role === "REQUESTER";
    case "open":
      return conversation.requestStatus === "OPEN";
    default:
      return true;
  }
}

export function ConversationList({
  conversations,
  filter,
  activeId,
}: {
  conversations: ConversationSummary[];
  filter: ConversationFilter;
  activeId?: string;
}) {
  const visible = conversations.filter((conversation) => matchesFilter(conversation, filter));

  return (
    <div className="flex flex-col">
      <div
        role="tablist"
        aria-label="Filter conversations"
        className="flex flex-wrap gap-1 border-b border-line px-2 py-2"
      >
        {FILTER_TABS.map((tab) => {
          const active = tab.value === filter;
          return (
            <Link
              key={tab.value}
              role="tab"
              aria-selected={active}
              href={tab.value === "all" ? "/messages" : `/messages?filter=${tab.value}`}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-ember-50 text-ember-700"
                  : "text-ink-muted hover:bg-surface-muted hover:text-ink",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-ink-muted">
          No conversations in this view yet.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((conversation) => {
            const active = conversation.id === activeId;
            return (
              <li key={conversation.id}>
                <Link
                  href={`/messages/${conversation.id}`}
                  className={cn(
                    "flex gap-3 px-4 py-3 transition-colors hover:bg-surface-muted",
                    active && "bg-surface-muted",
                  )}
                >
                  <Avatar name={conversation.counterpartName} image={conversation.counterpartImage} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-ink">
                        {conversation.counterpartName}
                      </p>
                      <span className="shrink-0 text-xs text-ink-muted">
                        {formatRelative(conversation.lastMessageAt)}
                      </span>
                    </div>
                    <p className="truncate text-sm text-ink">{conversation.subject}</p>
                    {conversation.preview ? (
                      <p className="truncate text-xs text-ink-muted">{conversation.preview}</p>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <RoleBadge role={conversation.role} />
                      {conversation.requestStatus ? (
                        <RequestStatusBadge status={conversation.requestStatus} />
                      ) : null}
                      {conversation.unreadCount > 0 ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ember-500 px-1.5 text-[11px] font-semibold text-white">
                          {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
