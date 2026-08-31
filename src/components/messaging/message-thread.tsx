"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { formatDateTime } from "@/lib/format";
import { cn } from "@/components/ui";
import {
  MessageComposer,
  type SentMessage,
} from "@/components/messaging/message-composer";

function mergeMessages(existing: SentMessage[], incoming: SentMessage[]): SentMessage[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((message) => message.id));
  const added = incoming.filter((message) => !seen.has(message.id));
  if (added.length === 0) return existing;
  return [...existing, ...added].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function MessageThread({
  conversationId,
  currentUserId,
  counterpartName,
  initialMessages,
}: {
  conversationId: string;
  currentUserId: string;
  counterpartName: string;
  initialMessages: SentMessage[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<SentMessage[]>(initialMessages);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep the newest timestamp available to the polling closure without
  // re-creating the interval on every message.
  const cursorRef = useRef<string | null>(
    initialMessages.at(-1)?.createdAt ?? null,
  );
  useEffect(() => {
    cursorRef.current = messages.at(-1)?.createdAt ?? cursorRef.current;
  }, [messages]);

  const poll = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    const cursor = cursorRef.current;
    const query = cursor ? `?after=${encodeURIComponent(cursor)}` : "";
    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/messages${query}`,
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const data = (await response.json()) as { messages: SentMessage[] };
      if (data.messages.length > 0) {
        setMessages((current) => mergeMessages(current, data.messages));
      }
    } catch {
      // Silent — polling retries on the next tick.
    }
  }, [conversationId]);

  useEffect(() => {
    const interval = setInterval(() => void poll(), 10_000);
    return () => clearInterval(interval);
  }, [poll]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const handleSent = useCallback(
    (message: SentMessage) => {
      setMessages((current) => mergeMessages(current, [message]));
      router.refresh();
    },
    [router],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto px-1 py-4">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">
            No messages yet. Say hello to start the conversation.
          </p>
        ) : (
          messages.map((message) => {
            const own = message.senderId === currentUserId;
            return (
              <div
                key={message.id}
                className={cn("flex flex-col", own ? "items-end" : "items-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm sm:max-w-[75%]",
                    own
                      ? "rounded-br-sm bg-ember-500 text-white"
                      : "rounded-bl-sm bg-surface-muted text-ink",
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                </div>
                <span className="mt-1 px-1 text-[11px] text-ink-muted">
                  {own ? "You" : counterpartName} · {formatDateTime(message.createdAt)}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-line pt-3">
        <MessageComposer conversationId={conversationId} onSent={handleSent} />
      </div>
    </div>
  );
}
