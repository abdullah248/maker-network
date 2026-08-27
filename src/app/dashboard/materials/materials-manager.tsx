"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  MATERIAL_CATEGORIES,
  MATERIAL_CATEGORY_LABELS,
  MATERIAL_UNITS,
  MATERIAL_UNIT_LABELS,
  type MaterialCategory,
  type MaterialUnit,
} from "@/lib/constants";
import { MATERIAL_PRESETS } from "@/lib/machine-catalog";
import { formatPrice, parseColorList } from "@/lib/format";
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

export type MaterialDTO = {
  id: string;
  category: string;
  name: string;
  brand: string | null;
  colors: string | null;
  specs: string | null;
  unit: string;
  pricePerUnit: number;
  currency: string;
  stockQuantity: number | null;
  inStock: boolean;
  canCustomOrder: boolean;
  customOrderLeadDays: number | null;
  notes: string | null;
};

type FormState = {
  category: MaterialCategory;
  presetKey: string;
  name: string;
  brand: string;
  colors: string;
  specs: string;
  unit: MaterialUnit;
  pricePerUnit: string;
  currency: string;
  stockQuantity: string;
  inStock: boolean;
  canCustomOrder: boolean;
  customOrderLeadDays: string;
  notes: string;
};

const CUSTOM_KEY = "__custom__";

function emptyForm(): FormState {
  return {
    category: "FILAMENT",
    presetKey: "",
    name: "",
    brand: "",
    colors: "",
    specs: "",
    unit: "KG",
    pricePerUnit: "",
    currency: "USD",
    stockQuantity: "",
    inStock: true,
    canCustomOrder: false,
    customOrderLeadDays: "",
    notes: "",
  };
}

function formFromMaterial(material: MaterialDTO): FormState {
  return {
    category: material.category as MaterialCategory,
    presetKey: CUSTOM_KEY,
    name: material.name,
    brand: material.brand ?? "",
    colors: material.colors ?? "",
    specs: material.specs ?? "",
    unit: material.unit as MaterialUnit,
    pricePerUnit: String(material.pricePerUnit),
    currency: material.currency,
    stockQuantity: material.stockQuantity != null ? String(material.stockQuantity) : "",
    inStock: material.inStock,
    canCustomOrder: material.canCustomOrder,
    customOrderLeadDays: material.customOrderLeadDays != null ? String(material.customOrderLeadDays) : "",
    notes: material.notes ?? "",
  };
}

export function MaterialsManager({ initialMaterials }: { initialMaterials: MaterialDTO[] }) {
  const router = useRouter();
  const [materials, setMaterials] = useState<MaterialDTO[]>(initialMaterials);
  const [form, setForm] = useState<FormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, MaterialDTO[]>();
    for (const material of materials) {
      const list = map.get(material.category) ?? [];
      list.push(material);
      map.set(material.category, list);
    }
    return map;
  }, [materials]);

  const presets = form
    ? MATERIAL_PRESETS.filter((preset) => preset.category === form.category)
    : [];

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function openCreate() {
    setForm(emptyForm());
    setEditingId(null);
    setErrors({});
    setFormError(null);
  }

  function openEdit(material: MaterialDTO) {
    setForm(formFromMaterial(material));
    setEditingId(material.id);
    setErrors({});
    setFormError(null);
  }

  function closeForm() {
    setForm(null);
    setEditingId(null);
    setErrors({});
    setFormError(null);
  }

  function onCategoryChange(category: MaterialCategory) {
    setForm((prev) => (prev ? { ...prev, category, presetKey: "" } : prev));
  }

  function onPresetChange(key: string) {
    if (key === CUSTOM_KEY || key === "") {
      update("presetKey", key);
      return;
    }
    const preset = MATERIAL_PRESETS.find((p) => `${p.category}:${p.name}` === key);
    if (!preset) return;
    setForm((prev) =>
      prev
        ? {
            ...prev,
            presetKey: key,
            name: preset.name,
            unit: preset.unit as MaterialUnit,
            specs: preset.specs,
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
      name: form.name,
      brand: form.brand,
      colors: form.colors,
      specs: form.specs,
      unit: form.unit,
      pricePerUnit: form.pricePerUnit,
      currency: form.currency,
      stockQuantity: form.stockQuantity,
      inStock: form.inStock,
      canCustomOrder: form.canCustomOrder,
      customOrderLeadDays: form.customOrderLeadDays,
      notes: form.notes,
    };

    const result = editingId
      ? await apiRequest<MaterialDTO>(`/api/materials/${editingId}`, { method: "PUT", body: payload })
      : await apiRequest<MaterialDTO>("/api/materials", { method: "POST", body: payload });

    setSubmitting(false);

    if (!result.ok) {
      setErrors(result.error.fieldErrors);
      setFormError(result.error.formErrors[0] ?? result.error.message);
      return;
    }

    setMaterials((prev) => {
      if (editingId) return prev.map((m) => (m.id === editingId ? result.data : m));
      return [...prev, result.data];
    });
    closeForm();
    router.refresh();
  }

  async function onDelete(material: MaterialDTO) {
    if (!window.confirm(`Delete ${material.name}? This can't be undone.`)) return;
    const result = await apiRequest(`/api/materials/${material.id}`, { method: "DELETE" });
    if (result.ok) {
      setMaterials((prev) => prev.filter((m) => m.id !== material.id));
      router.refresh();
    } else {
      window.alert(result.error.message);
    }
  }

  return (
    <div className="space-y-6">
      {!form ? (
        <div className="flex justify-end">
          <Button onClick={openCreate}>Add material</Button>
        </div>
      ) : null}

      {form ? (
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold text-ink">
            {editingId ? "Edit material" : "Add a material"}
          </h3>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="category" required error={firstError(errors, "category")}>
                <Select
                  id="category"
                  value={form.category}
                  onChange={(e) => onCategoryChange(e.target.value as MaterialCategory)}
                >
                  {MATERIAL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {MATERIAL_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Preset" htmlFor="preset" hint="Pre-fills name, unit and specs. Choose custom to enter your own.">
                <Select id="preset" value={form.presetKey} onChange={(e) => onPresetChange(e.target.value)}>
                  <option value="">Select a preset…</option>
                  {presets.map((preset) => (
                    <option key={`${preset.category}:${preset.name}`} value={`${preset.category}:${preset.name}`}>
                      {preset.name}
                    </option>
                  ))}
                  <option value={CUSTOM_KEY}>Custom material</option>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="name" required error={firstError(errors, "name")}>
                <Input id="name" value={form.name} maxLength={80} onChange={(e) => update("name", e.target.value)} />
              </Field>
              <Field label="Brand" htmlFor="brand" error={firstError(errors, "brand")}>
                <Input id="brand" value={form.brand} maxLength={60} onChange={(e) => update("brand", e.target.value)} />
              </Field>
            </div>

            <Field
              label="Colours"
              htmlFor="colors"
              error={firstError(errors, "colors")}
              hint="Comma-separated list, e.g. “Black, White, Galaxy Blue”."
            >
              <Input id="colors" value={form.colors} maxLength={200} onChange={(e) => update("colors", e.target.value)} />
            </Field>

            <Field label="Specs" htmlFor="specs" error={firstError(errors, "specs")} hint="Diameter, thickness, temperatures, tolerances…">
              <Textarea id="specs" value={form.specs} onChange={(e) => update("specs", e.target.value)} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Unit" htmlFor="unit" required error={firstError(errors, "unit")}>
                <Select id="unit" value={form.unit} onChange={(e) => update("unit", e.target.value as MaterialUnit)}>
                  {MATERIAL_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {MATERIAL_UNIT_LABELS[u]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Price per unit" htmlFor="pricePerUnit" required error={firstError(errors, "pricePerUnit")}>
                <Input id="pricePerUnit" type="number" min={0} step="0.01" value={form.pricePerUnit} onChange={(e) => update("pricePerUnit", e.target.value)} />
              </Field>
              <Field label="Currency" htmlFor="currency" error={firstError(errors, "currency")}>
                <Input id="currency" value={form.currency} maxLength={3} onChange={(e) => update("currency", e.target.value.toUpperCase())} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Stock quantity" htmlFor="stockQuantity" error={firstError(errors, "stockQuantity")}>
                <Input id="stockQuantity" type="number" min={0} value={form.stockQuantity} onChange={(e) => update("stockQuantity", e.target.value)} />
              </Field>
            </div>

            <div className="space-y-2">
              <Checkbox label="In stock" checked={form.inStock} onChange={(e) => update("inStock", e.target.checked)} />
              <Checkbox
                label="Can custom order"
                description="You can source this on request even if it's not in stock."
                checked={form.canCustomOrder}
                onChange={(e) => update("canCustomOrder", e.target.checked)}
              />
            </div>

            {form.canCustomOrder ? (
              <Field label="Custom order lead time (days)" htmlFor="customOrderLeadDays" error={firstError(errors, "customOrderLeadDays")}>
                <Input
                  id="customOrderLeadDays"
                  type="number"
                  min={0}
                  max={365}
                  value={form.customOrderLeadDays}
                  onChange={(e) => update("customOrderLeadDays", e.target.value)}
                />
              </Field>
            ) : null}

            <Field label="Notes" htmlFor="notes" error={firstError(errors, "notes")}>
              <Textarea id="notes" value={form.notes} onChange={(e) => update("notes", e.target.value)} />
            </Field>

            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : editingId ? "Save material" : "Add material"}
              </Button>
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {materials.length === 0 && !form ? (
        <EmptyState
          title="No materials yet"
          description="Add the filaments, resins, sheets and other materials you stock or can source."
          action={<Button onClick={openCreate}>Add your first material</Button>}
        />
      ) : null}

      <div className="space-y-6">
        {MATERIAL_CATEGORIES.filter((c) => grouped.has(c)).map((category) => (
          <div key={category}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
              {MATERIAL_CATEGORY_LABELS[category]}
            </h3>
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-surface-muted text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Brand</th>
                    <th className="px-4 py-2 font-medium">Specs</th>
                    <th className="px-4 py-2 font-medium">Colours</th>
                    <th className="px-4 py-2 font-medium">Price</th>
                    <th className="px-4 py-2 font-medium">Stock</th>
                    <th className="px-4 py-2 font-medium">Custom</th>
                    <th className="px-4 py-2 font-medium sr-only">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {grouped.get(category)!.map((material) => (
                    <tr key={material.id} className="align-top">
                      <td className="px-4 py-3 font-medium text-ink">{material.name}</td>
                      <td className="px-4 py-3 text-ink-muted">{material.brand ?? "—"}</td>
                      <td className="px-4 py-3 text-ink-muted">{material.specs ?? "—"}</td>
                      <td className="px-4 py-3">
                        {parseColorList(material.colors).length ? (
                          <span className="flex flex-wrap gap-1">
                            {parseColorList(material.colors).map((color) => (
                              <Badge key={color} tone="neutral">
                                {color}
                              </Badge>
                            ))}
                          </span>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">
                        {formatPrice(material.pricePerUnit, material.unit, material.currency)}
                      </td>
                      <td className="px-4 py-3">
                        {material.inStock ? (
                          <Badge tone="moss">
                            {material.stockQuantity != null ? `${material.stockQuantity} in stock` : "In stock"}
                          </Badge>
                        ) : (
                          <Badge tone="danger">Out of stock</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {material.canCustomOrder ? (
                          <Badge tone="blueprint">
                            {material.customOrderLeadDays != null
                              ? `${material.customOrderLeadDays}d lead`
                              : "Custom"}
                          </Badge>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(material)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => onDelete(material)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
