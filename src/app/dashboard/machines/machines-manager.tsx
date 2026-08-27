"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  MACHINE_CATEGORIES,
  MACHINE_CATEGORY_LABELS,
  type MachineCategory,
} from "@/lib/constants";
import { catalogForCategory, findCatalogEntry } from "@/lib/machine-catalog";
import { formatMoney } from "@/lib/format";
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

export type MachineDTO = {
  id: string;
  category: string;
  make: string;
  model: string;
  isCustom: boolean;
  nickname: string | null;
  buildVolume: string | null;
  quantity: number;
  hourlyRate: number | null;
  perJobFee: number | null;
  notes: string | null;
  isOperational: boolean;
};

type FormState = {
  category: MachineCategory;
  catalogKey: string;
  make: string;
  model: string;
  isCustom: boolean;
  nickname: string;
  buildVolume: string;
  quantity: string;
  hourlyRate: string;
  perJobFee: string;
  notes: string;
  isOperational: boolean;
};

const CUSTOM_KEY = "__custom__";

function emptyForm(): FormState {
  return {
    category: "FDM_3D_PRINTER",
    catalogKey: "",
    make: "",
    model: "",
    isCustom: false,
    nickname: "",
    buildVolume: "",
    quantity: "1",
    hourlyRate: "",
    perJobFee: "",
    notes: "",
    isOperational: true,
  };
}

function formFromMachine(machine: MachineDTO): FormState {
  const entry = findCatalogEntry(machine.make, machine.model);
  return {
    category: machine.category as MachineCategory,
    catalogKey: !machine.isCustom && entry ? `${entry.make}|||${entry.model}` : CUSTOM_KEY,
    make: machine.make,
    model: machine.model,
    isCustom: machine.isCustom,
    nickname: machine.nickname ?? "",
    buildVolume: machine.buildVolume ?? "",
    quantity: String(machine.quantity),
    hourlyRate: machine.hourlyRate != null ? String(machine.hourlyRate) : "",
    perJobFee: machine.perJobFee != null ? String(machine.perJobFee) : "",
    notes: machine.notes ?? "",
    isOperational: machine.isOperational,
  };
}

export function MachinesManager({ initialMachines }: { initialMachines: MachineDTO[] }) {
  const router = useRouter();
  const [machines, setMachines] = useState<MachineDTO[]>(initialMachines);
  const [form, setForm] = useState<FormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, MachineDTO[]>();
    for (const machine of machines) {
      const list = map.get(machine.category) ?? [];
      list.push(machine);
      map.set(machine.category, list);
    }
    return map;
  }, [machines]);

  const catalogOptions = form ? catalogForCategory(form.category) : [];

  function openCreate() {
    setForm(emptyForm());
    setEditingId(null);
    setErrors({});
    setFormError(null);
  }

  function openEdit(machine: MachineDTO) {
    setForm(formFromMachine(machine));
    setEditingId(machine.id);
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

  function onCategoryChange(category: MachineCategory) {
    setForm((prev) =>
      prev
        ? { ...prev, category, catalogKey: "", make: "", model: "", isCustom: false, buildVolume: "" }
        : prev,
    );
  }

  function onCatalogChange(key: string) {
    if (key === CUSTOM_KEY) {
      setForm((prev) =>
        prev ? { ...prev, catalogKey: key, isCustom: true, make: "", model: "" } : prev,
      );
      return;
    }
    const [make, model] = key.split("|||");
    const entry = findCatalogEntry(make ?? "", model ?? "");
    setForm((prev) =>
      prev
        ? {
            ...prev,
            catalogKey: key,
            isCustom: false,
            make: make ?? "",
            model: model ?? "",
            buildVolume: entry?.buildVolume ?? prev.buildVolume,
          }
        : prev,
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSubmitting(true);
    setErrors({});
    setFormError(null);

    const payload = {
      category: form.category,
      make: form.make,
      model: form.model,
      isCustom: form.isCustom,
      nickname: form.nickname,
      buildVolume: form.buildVolume,
      quantity: form.quantity,
      hourlyRate: form.hourlyRate,
      perJobFee: form.perJobFee,
      notes: form.notes,
      isOperational: form.isOperational,
    };

    const result = editingId
      ? await apiRequest<MachineDTO>(`/api/machines/${editingId}`, { method: "PUT", body: payload })
      : await apiRequest<MachineDTO>("/api/machines", { method: "POST", body: payload });

    setSubmitting(false);

    if (!result.ok) {
      setErrors(result.error.fieldErrors);
      setFormError(result.error.formErrors[0] ?? result.error.message);
      return;
    }

    setMachines((prev) => {
      if (editingId) return prev.map((m) => (m.id === editingId ? result.data : m));
      return [...prev, result.data];
    });
    closeForm();
    router.refresh();
  }

  async function onDelete(machine: MachineDTO) {
    if (!window.confirm(`Delete ${machine.make} ${machine.model}? This can't be undone.`)) return;
    const result = await apiRequest(`/api/machines/${machine.id}`, { method: "DELETE" });
    if (result.ok) {
      setMachines((prev) => prev.filter((m) => m.id !== machine.id));
      router.refresh();
    } else {
      window.alert(result.error.message);
    }
  }

  return (
    <div className="space-y-6">
      {!form ? (
        <div className="flex justify-end">
          <Button onClick={openCreate}>Add machine</Button>
        </div>
      ) : null}

      {form ? (
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold text-ink">
            {editingId ? "Edit machine" : "Add a machine"}
          </h3>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="category" required error={firstError(errors, "category")}>
                <Select
                  id="category"
                  value={form.category}
                  onChange={(e) => onCategoryChange(e.target.value as MachineCategory)}
                >
                  {MACHINE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {MACHINE_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Machine" htmlFor="catalog" hint="Pick from the catalog or add a custom machine.">
                <Select id="catalog" value={form.catalogKey} onChange={(e) => onCatalogChange(e.target.value)}>
                  <option value="">Select a machine…</option>
                  {catalogOptions.map((entry) => (
                    <option key={`${entry.make}|||${entry.model}`} value={`${entry.make}|||${entry.model}`}>
                      {entry.make} — {entry.model}
                    </option>
                  ))}
                  <option value={CUSTOM_KEY}>Other / custom machine</option>
                </Select>
              </Field>
            </div>

            {form.isCustom ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Make" htmlFor="make" required error={firstError(errors, "make")}>
                  <Input id="make" value={form.make} maxLength={60} onChange={(e) => update("make", e.target.value)} />
                </Field>
                <Field label="Model" htmlFor="model" required error={firstError(errors, "model")}>
                  <Input id="model" value={form.model} maxLength={80} onChange={(e) => update("model", e.target.value)} />
                </Field>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nickname" htmlFor="nickname" error={firstError(errors, "nickname")} hint="Optional, e.g. “Big Bertha”.">
                <Input id="nickname" value={form.nickname} maxLength={60} onChange={(e) => update("nickname", e.target.value)} />
              </Field>
              <Field label="Build volume" htmlFor="buildVolume" error={firstError(errors, "buildVolume")} hint="Auto-filled from the catalog; editable.">
                <Input id="buildVolume" value={form.buildVolume} maxLength={80} onChange={(e) => update("buildVolume", e.target.value)} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Quantity" htmlFor="quantity" required error={firstError(errors, "quantity")}>
                <Input id="quantity" type="number" min={1} max={500} value={form.quantity} onChange={(e) => update("quantity", e.target.value)} />
              </Field>
              <Field label="Hourly rate (USD)" htmlFor="hourlyRate" error={firstError(errors, "hourlyRate")}>
                <Input id="hourlyRate" type="number" min={0} step="0.01" value={form.hourlyRate} onChange={(e) => update("hourlyRate", e.target.value)} />
              </Field>
              <Field label="Per-job fee (USD)" htmlFor="perJobFee" error={firstError(errors, "perJobFee")}>
                <Input id="perJobFee" type="number" min={0} step="0.01" value={form.perJobFee} onChange={(e) => update("perJobFee", e.target.value)} />
              </Field>
            </div>

            <Field label="Notes" htmlFor="notes" error={firstError(errors, "notes")}>
              <Textarea id="notes" value={form.notes} onChange={(e) => update("notes", e.target.value)} />
            </Field>

            <Checkbox
              label="Currently operational"
              checked={form.isOperational}
              onChange={(e) => update("isOperational", e.target.checked)}
            />

            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : editingId ? "Save machine" : "Add machine"}
              </Button>
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {machines.length === 0 && !form ? (
        <EmptyState
          title="No machines yet"
          description="Add the 3D printers, laser cutters or other equipment you offer."
          action={<Button onClick={openCreate}>Add your first machine</Button>}
        />
      ) : null}

      <div className="space-y-6">
        {MACHINE_CATEGORIES.filter((c) => grouped.has(c)).map((category) => (
          <div key={category}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
              {MACHINE_CATEGORY_LABELS[category]}
            </h3>
            <div className="space-y-3">
              {grouped.get(category)!.map((machine) => (
                <Card key={machine.id} className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">
                        {machine.make} {machine.model}
                      </p>
                      {machine.nickname ? <Badge tone="blueprint">{machine.nickname}</Badge> : null}
                      {machine.isCustom ? <Badge tone="neutral">Custom</Badge> : null}
                      {machine.isOperational ? (
                        <Badge tone="moss">Operational</Badge>
                      ) : (
                        <Badge tone="danger">Down</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      {machine.buildVolume ? `${machine.buildVolume} · ` : ""}
                      Qty {machine.quantity}
                      {machine.hourlyRate != null ? ` · ${formatMoney(machine.hourlyRate)}/hr` : ""}
                      {machine.perJobFee != null ? ` · ${formatMoney(machine.perJobFee)}/job` : ""}
                    </p>
                    {machine.notes ? <p className="mt-1 text-sm text-ink-muted">{machine.notes}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(machine)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => onDelete(machine)}>
                      Delete
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
