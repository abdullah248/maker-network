"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { LIMITS } from "@/lib/constants";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { apiRequest, firstError, type FieldErrors } from "@/components/dashboard/client";

export type PortfolioMachineDTO = {
  id: string;
  make: string;
  model: string;
  category: string;
};

export type PortfolioItemDTO = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  altText: string | null;
  materialUsed: string | null;
  featured: boolean;
  sortOrder: number;
  machine: PortfolioMachineDTO | null;
};

export type MachineOptionDTO = {
  id: string;
  make: string;
  model: string;
};

type FormState = {
  imageUrl: string;
  title: string;
  description: string;
  altText: string;
  machineId: string;
  materialUsed: string;
  featured: boolean;
  sortOrder: string;
};

function emptyForm(): FormState {
  return {
    imageUrl: "",
    title: "",
    description: "",
    altText: "",
    machineId: "",
    materialUsed: "",
    featured: false,
    sortOrder: "0",
  };
}

function formFromItem(item: PortfolioItemDTO): FormState {
  return {
    imageUrl: item.imageUrl,
    title: item.title,
    description: item.description ?? "",
    altText: item.altText ?? "",
    machineId: item.machine?.id ?? "",
    materialUsed: item.materialUsed ?? "",
    featured: item.featured,
    sortOrder: String(item.sortOrder),
  };
}

function PreviewImage({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);

  if (!url.trim()) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border border-dashed border-line bg-surface-muted text-xs text-ink-muted">
        Image preview
      </div>
    );
  }

  if (failed) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border border-dashed border-line bg-surface-muted px-3 text-center text-xs text-ink-muted">
        Couldn&apos;t load that image. Check the URL.
      </div>
    );
  }

  return (
    <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-line bg-surface-muted">
      {/*
        Preview of an arbitrary third-party image URL. A plain <img> avoids the
        Next.js image optimizer fetching remote URLs.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={url}
        src={url}
        alt="Preview of the project image"
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export function GalleryManager({
  initialItems,
  machines,
}: {
  initialItems: PortfolioItemDTO[];
  machines: MachineOptionDTO[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<PortfolioItemDTO[]>(initialItems);
  const [form, setForm] = useState<FormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const atLimit = items.length >= LIMITS.portfolioMax;

  function openCreate() {
    setForm(emptyForm());
    setEditingId(null);
    setErrors({});
    setFormError(null);
  }

  function openEdit(item: PortfolioItemDTO) {
    setForm(formFromItem(item));
    setEditingId(item.id);
    setErrors({});
    setFormError(null);
  }

  function closeForm() {
    setForm(null);
    setEditingId(null);
    setErrors({});
    setFormError(null);
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSubmitting(true);
    setErrors({});
    setFormError(null);

    const payload = {
      imageUrl: form.imageUrl,
      title: form.title,
      description: form.description,
      altText: form.altText,
      machineId: form.machineId,
      materialUsed: form.materialUsed,
      featured: form.featured,
      sortOrder: form.sortOrder,
    };

    const result = editingId
      ? await apiRequest<PortfolioItemDTO>(`/api/portfolio/${editingId}`, {
          method: "PUT",
          body: payload,
        })
      : await apiRequest<PortfolioItemDTO>("/api/portfolio", {
          method: "POST",
          body: payload,
        });

    setSubmitting(false);

    if (!result.ok) {
      setErrors(result.error.fieldErrors);
      setFormError(result.error.formErrors[0] ?? result.error.message);
      return;
    }

    setItems((prev) => {
      if (editingId) return prev.map((i) => (i.id === editingId ? result.data : i));
      return [...prev, result.data];
    });
    closeForm();
    router.refresh();
  }

  async function onDelete(item: PortfolioItemDTO) {
    if (!window.confirm(`Delete “${item.title}”? This can't be undone.`)) return;
    const result = await apiRequest(`/api/portfolio/${item.id}`, { method: "DELETE" });
    if (result.ok) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      router.refresh();
    } else {
      window.alert(result.error.message);
    }
  }

  return (
    <div className="space-y-6">
      {!form ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-muted">
            {items.length} of {LIMITS.portfolioMax} projects
          </p>
          <Button onClick={openCreate} disabled={atLimit}>
            Add project
          </Button>
        </div>
      ) : null}

      {!form && atLimit ? (
        <Alert tone="info">
          You&apos;ve reached the limit of {LIMITS.portfolioMax} projects. Delete one to add
          another.
        </Alert>
      ) : null}

      {form ? (
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold text-ink">
            {editingId ? "Edit project" : "Add a project"}
          </h3>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-4">
                <Field
                  label="Image URL"
                  htmlFor="imageUrl"
                  required
                  error={firstError(errors, "imageUrl")}
                  hint="Link to a photo of the finished piece (http or https)."
                >
                  <Input
                    id="imageUrl"
                    type="url"
                    inputMode="url"
                    placeholder="https://example.com/photo.jpg"
                    value={form.imageUrl}
                    maxLength={2048}
                    onChange={(e) => update("imageUrl", e.target.value)}
                  />
                </Field>
              </div>
              <div>
                <span className="mb-1.5 block text-sm font-medium text-ink">Preview</span>
                <PreviewImage url={form.imageUrl} />
              </div>
            </div>

            <Field label="Title" htmlFor="title" required error={firstError(errors, "title")}>
              <Input
                id="title"
                value={form.title}
                maxLength={LIMITS.portfolioTitle}
                onChange={(e) => update("title", e.target.value)}
              />
            </Field>

            <Field
              label="Description"
              htmlFor="description"
              error={firstError(errors, "description")}
              hint="Optional. What is it, and what was tricky about making it?"
            >
              <Textarea
                id="description"
                value={form.description}
                maxLength={LIMITS.portfolioDescription}
                onChange={(e) => update("description", e.target.value)}
              />
            </Field>

            <Field
              label="Alt text"
              htmlFor="altText"
              error={firstError(errors, "altText")}
              hint="Describes the image for screen reader users. Falls back to the title if left blank."
            >
              <Input
                id="altText"
                value={form.altText}
                maxLength={200}
                onChange={(e) => update("altText", e.target.value)}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Made on"
                htmlFor="machineId"
                error={firstError(errors, "machineId")}
                hint="Which of your machines produced this?"
              >
                <Select
                  id="machineId"
                  value={form.machineId}
                  onChange={(e) => update("machineId", e.target.value)}
                >
                  <option value="">Not specified</option>
                  {machines.map((machine) => (
                    <option key={machine.id} value={machine.id}>
                      {machine.make} {machine.model}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Material used"
                htmlFor="materialUsed"
                error={firstError(errors, "materialUsed")}
                hint="Optional, e.g. “PLA” or “3mm birch ply”."
              >
                <Input
                  id="materialUsed"
                  value={form.materialUsed}
                  maxLength={120}
                  onChange={(e) => update("materialUsed", e.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
              <Field
                label="Sort order"
                htmlFor="sortOrder"
                error={firstError(errors, "sortOrder")}
                hint="Lower numbers show first."
              >
                <Input
                  id="sortOrder"
                  type="number"
                  min={0}
                  max={9999}
                  value={form.sortOrder}
                  onChange={(e) => update("sortOrder", e.target.value)}
                />
              </Field>
              <Checkbox
                label="Feature this project"
                description="Featured projects appear first in your gallery."
                checked={form.featured}
                onChange={(e) => update("featured", e.target.checked)}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : editingId ? "Save project" : "Add project"}
              </Button>
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {items.length === 0 && !form ? (
        <EmptyState
          title="No projects yet"
          description="Show off things you've made so customers can see the quality of your work."
          action={<Button onClick={openCreate}>Add your first project</Button>}
        />
      ) : null}

      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id} className="flex flex-col gap-3">
              <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-line bg-surface-muted">
                {/*
                  Owner-supplied third-party image URL. A plain <img> avoids the
                  Next.js image optimizer fetching remote URLs.
                */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt={item.altText || item.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-ink">{item.title}</p>
                {item.featured ? <Badge tone="ember">Featured</Badge> : null}
              </div>
              {item.machine || item.materialUsed ? (
                <div className="flex flex-wrap gap-2">
                  {item.machine ? (
                    <Badge tone="blueprint">
                      {item.machine.make} {item.machine.model}
                    </Badge>
                  ) : null}
                  {item.materialUsed ? <Badge tone="moss">{item.materialUsed}</Badge> : null}
                </div>
              ) : null}
              <div className="mt-auto flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                  Edit
                </Button>
                <Button size="sm" variant="danger" onClick={() => onDelete(item)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
