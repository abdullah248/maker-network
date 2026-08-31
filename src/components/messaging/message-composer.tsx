"use client";

import { useState, type KeyboardEvent } from "react";

import { LIMITS } from "@/lib/constants";
import { Button, Textarea, cn } from "@/components/ui";

export type SentMessage = {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
};

async function readError(response: Response): Promise<string> {
  if (response.status === 429) {
    return "You are sending messages too quickly. Please wait a moment and try again.";
  }
  try {
    const data = (await response.json()) as {
      error?: string;
      details?: { fieldErrors?: Record<string, string[]> };
    };
    const fieldError = data.details?.fieldErrors?.body?.[0];
    return fieldError ?? data.error ?? "Could not send your message.";
  } catch {
    return "Could not send your message.";
  }
}

export function MessageComposer({
  conversationId,
  onSent,
}: {
  conversationId: string;
  onSent?: (message: SentMessage) => void;
}) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();
  const disabled = sending || trimmed.length === 0;

  async function send() {
    if (sending || trimmed.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: value }),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      const message = (await response.json()) as SentMessage;
      setValue("");
      onSent?.(message);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {error ? (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}
      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={LIMITS.messageBody}
        rows={3}
        disabled={sending}
        placeholder="Write a message…  (Enter to send, Shift+Enter for a new line)"
        aria-label="Message"
      />
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "text-xs text-ink-muted",
            value.length >= LIMITS.messageBody && "font-medium text-red-600",
          )}
        >
          {value.length.toLocaleString()} / {LIMITS.messageBody.toLocaleString()}
        </span>
        <Button type="submit" disabled={disabled}>
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </form>
  );
}
