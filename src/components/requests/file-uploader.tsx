"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";

import {
  MAX_FILES_PER_REQUEST,
  MAX_UPLOAD_BYTES,
  PROCESS_FILE_EXTENSIONS,
  type Process,
} from "@/lib/print-specs";
import { formatBytes } from "@/lib/format";
import { Alert, Button, cn } from "@/components/ui";

type UploadItem = {
  localId: string;
  filename: string;
  sizeBytes: number;
  status: "uploading" | "done" | "error";
  progress: number;
  serverId?: string;
  error?: string;
};

type StoredUpload = {
  id: string;
  filename: string;
  sizeBytes: number;
};

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

let counter = 0;
function nextLocalId() {
  counter += 1;
  return `local-${Date.now()}-${counter}`;
}

export function FileUploader({
  process,
  onIdsChange,
}: {
  process: Process;
  onIdsChange: (ids: string[]) => void;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptExtensions = PROCESS_FILE_EXTENSIONS[process];
  const acceptAttr = acceptExtensions.join(",");

  const publish = useCallback(
    (next: UploadItem[]) => {
      onIdsChange(
        next
          .filter((item) => item.status === "done" && item.serverId)
          .map((item) => item.serverId as string),
      );
    },
    [onIdsChange],
  );

  const patchItem = useCallback(
    (localId: string, patch: Partial<UploadItem>) => {
      setItems((prev) => {
        const next = prev.map((item) =>
          item.localId === localId ? { ...item, ...patch } : item,
        );
        publish(next);
        return next;
      });
    },
    [publish],
  );

  const uploadOne = useCallback(
    (file: File, localId: string) => {
      const form = new FormData();
      form.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/uploads");

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          patchItem(localId, {
            progress: Math.round((event.loaded / event.total) * 100),
          });
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const stored = JSON.parse(xhr.responseText) as StoredUpload;
            patchItem(localId, {
              status: "done",
              progress: 100,
              serverId: stored.id,
              sizeBytes: stored.sizeBytes,
            });
            return;
          } catch {
            /* fall through to error */
          }
        }
        let message = "Upload failed. Please try again.";
        try {
          const parsed = JSON.parse(xhr.responseText) as { error?: string };
          if (parsed.error) message = parsed.error;
        } catch {
          /* keep default */
        }
        patchItem(localId, { status: "error", error: message });
      });

      xhr.addEventListener("error", () => {
        patchItem(localId, { status: "error", error: "Network error during upload." });
      });

      xhr.send(form);
    },
    [patchItem],
  );

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      setNotice(null);
      const messages: string[] = [];

      setItems((prev) => {
        let slots = MAX_FILES_PER_REQUEST - prev.length;
        const accepted: Array<{ item: UploadItem; file: File }> = [];

        for (const file of files) {
          if (slots <= 0) {
            messages.push(
              `You can attach at most ${MAX_FILES_PER_REQUEST} files. Some were skipped.`,
            );
            break;
          }
          if (file.size > MAX_UPLOAD_BYTES) {
            messages.push(
              `“${file.name}” is ${formatBytes(file.size)}, over the ${formatBytes(
                MAX_UPLOAD_BYTES,
              )} limit.`,
            );
            continue;
          }
          const ext = extensionOf(file.name);
          if (ext && !acceptExtensions.includes(ext)) {
            messages.push(
              `“${file.name}” (${ext}) isn't a typical file for this process — uploading anyway.`,
            );
          }
          accepted.push({
            item: {
              localId: nextLocalId(),
              filename: file.name,
              sizeBytes: file.size,
              status: "uploading",
              progress: 0,
            },
            file,
          });
          slots -= 1;
        }

        // Kick off uploads after state is queued so handlers see the item.
        accepted.forEach(({ item, file }) => uploadOne(file, item.localId));

        return [...prev, ...accepted.map(({ item }) => item)];
      });

      if (messages.length > 0) setNotice(messages.join(" "));
    },
    [acceptExtensions, uploadOne],
  );

  const removeItem = useCallback(
    async (item: UploadItem) => {
      setItems((prev) => {
        const next = prev.filter((entry) => entry.localId !== item.localId);
        publish(next);
        return next;
      });
      if (item.serverId) {
        try {
          await fetch(`/api/uploads/${item.serverId}`, { method: "DELETE" });
        } catch {
          /* best effort — the file stays staged but detached */
        }
      }
    },
    [publish],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      if (event.dataTransfer?.files?.length) addFiles(event.dataTransfer.files);
    },
    [addFiles],
  );

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-colors",
          dragging ? "border-ember-500 bg-ember-50" : "border-line bg-surface-muted",
        )}
      >
        <p className="text-sm font-medium text-ink">Drag &amp; drop your design files here</p>
        <p className="mt-1 text-xs text-ink-muted">
          Up to {MAX_FILES_PER_REQUEST} files, {formatBytes(MAX_UPLOAD_BYTES)} each. Accepted:{" "}
          {acceptExtensions.join(" ")}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => inputRef.current?.click()}
        >
          Choose files
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptAttr}
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {notice ? <Alert tone="info">{notice}</Alert> : null}

      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.localId}
              className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{item.filename}</p>
                <p className="text-xs text-ink-muted">
                  {formatBytes(item.sizeBytes)}
                  {item.status === "uploading" ? ` · uploading ${item.progress}%` : null}
                  {item.status === "done" ? " · ready" : null}
                  {item.status === "error" ? ` · ${item.error ?? "failed"}` : null}
                </p>
                {item.status === "uploading" ? (
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-full rounded-full bg-ember-500 transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                ) : null}
              </div>
              <span
                className={cn(
                  "shrink-0 text-xs font-medium",
                  item.status === "done" && "text-moss-600",
                  item.status === "error" && "text-red-600",
                  item.status === "uploading" && "text-ink-muted",
                )}
              >
                {item.status === "done" ? "✓" : item.status === "error" ? "!" : "…"}
              </span>
              <button
                type="button"
                onClick={() => removeItem(item)}
                className="shrink-0 text-xs font-medium text-red-600 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
