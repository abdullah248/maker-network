"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  FULFILLMENT_LABELS,
  FULFILLMENT_OPTIONS,
  LIMITS,
  type Fulfillment,
} from "@/lib/constants";
import { formatPrice, parseColorList } from "@/lib/format";
import {
  CNC_STOCK_MATERIALS,
  FILAMENTS,
  LASER_FORBIDDEN_MATERIALS,
  LASER_MATERIALS,
  PROCESSES,
  PROCESS_MACHINE_CATEGORIES,
  RESIN_TYPES,
  fitsInBuildVolume,
  filamentById,
  formatDimensions,
  laserMaterialById,
  parseBuildVolume,
  type Process,
} from "@/lib/print-specs";
import { apiRequest, firstError, type FieldErrors } from "@/components/dashboard/client";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  Select,
  Textarea,
  cn,
} from "@/components/ui";
import { RequestSpecSheet, type SpecSheetRequest } from "@/components/requests/spec-sheet";
import { FileUploader } from "@/components/requests/file-uploader";
import { ProcessPicker } from "@/components/requests/process-picker";
import { SpecFields, defaultSpecsFor, type SpecsState } from "@/components/requests/spec-fields";

export type BuilderMachine = {
  id: string;
  category: string;
  make: string;
  model: string;
  buildVolume: string | null;
  isOperational: boolean;
};

export type BuilderMaterial = {
  id: string;
  category: string;
  name: string;
  unit: string;
  pricePerUnit: number;
  currency: string;
  colors: string | null;
  inStock: boolean;
  canCustomOrder: boolean;
};

type Props = {
  profileSlug: string;
  makerName: string;
  machines: BuilderMachine[];
  materials: BuilderMaterial[];
  offersShipping: boolean;
  offersLocalPickup: boolean;
  disabled?: boolean;
};

/** Maker stock categories worth surfacing for each process. */
const STOCK_CATEGORIES: Record<Process, string[]> = {
  FDM: ["FILAMENT"],
  RESIN: ["RESIN"],
  LASER_CUT: ["SHEET_WOOD", "SHEET_ACRYLIC", "SHEET_METAL", "PAPER_CARD", "OTHER"],
  LASER_ENGRAVE: ["SHEET_WOOD", "SHEET_ACRYLIC", "SHEET_METAL", "PAPER_CARD", "OTHER"],
  CNC: ["SHEET_WOOD", "SHEET_ACRYLIC", "SHEET_METAL", "OTHER"],
  OTHER: [],
};

function toNum(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function SectionCard({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ember-500 text-sm font-semibold text-white">
          {step}
        </span>
        <div>
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
        </div>
      </div>
      {children}
    </Card>
  );
}

export function RequestBuilder({
  profileSlug,
  makerName,
  machines,
  materials,
  offersShipping,
  offersLocalPickup,
  disabled,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"request" | "message">("request");

  // Shared submission state.
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  /**
   * Open on a process this maker can actually perform, so a laser-only shop
   * doesn't greet you with 3D printing settings.
   */
  const initialProcess: Process =
    PROCESSES.find((candidate) => {
      const categories = PROCESS_MACHINE_CATEGORIES[candidate];
      return (
        categories.length > 0 &&
        machines.some((machine) => categories.includes(machine.category))
      );
    }) ?? "FDM";

  // Builder state.
  const [process, setProcess] = useState<Process>(initialProcess);
  const [specs, setSpecs] = useState<SpecsState>(() => defaultSpecsFor(initialProcess));
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [fileUrl, setFileUrl] = useState("");
  const [machineId, setMachineId] = useState("");
  const [materialType, setMaterialType] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [materialColor, setMaterialColor] = useState("");
  const [dimX, setDimX] = useState("");
  const [dimY, setDimY] = useState("");
  const [dimZ, setDimZ] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [budget, setBudget] = useState("");
  const [deadline, setDeadline] = useState("");

  const fulfillmentOptions = useMemo(
    () =>
      FULFILLMENT_OPTIONS.filter((option) => {
        if (option === "SHIPPING") return offersShipping;
        if (option === "PICKUP") return offersLocalPickup;
        return offersShipping && offersLocalPickup;
      }),
    [offersShipping, offersLocalPickup],
  );
  const [fulfillment, setFulfillment] = useState<Fulfillment>(
    () => fulfillmentOptions[0] ?? "PICKUP",
  );

  // Message-tab state.
  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");

  const eligibleMachines = useMemo(() => {
    const categories = PROCESS_MACHINE_CATEGORIES[process];
    return machines.filter(
      (machine) =>
        machine.isOperational &&
        (categories.length === 0 || categories.includes(machine.category)),
    );
  }, [machines, process]);

  const eligibleStock = useMemo(() => {
    const categories = STOCK_CATEGORIES[process];
    if (categories.length === 0) return materials;
    return materials.filter((material) => categories.includes(material.category));
  }, [materials, process]);

  const selectedMachine = eligibleMachines.find((machine) => machine.id === machineId);
  const selectedStock = materials.find((material) => material.id === materialId);
  const selectedFilament =
    process === "FDM" && materialType ? filamentById(materialType) : undefined;

  // Build-volume fit check.
  const partDims = useMemo(() => {
    const x = toNum(dimX);
    const y = toNum(dimY);
    const z = toNum(dimZ);
    if (x === null || y === null) return null;
    return { x, y, z: z ?? 0 };
  }, [dimX, dimY, dimZ]);

  const machineVolume = selectedMachine ? parseBuildVolume(selectedMachine.buildVolume) : null;
  const partFits =
    partDims && machineVolume ? fitsInBuildVolume(partDims, machineVolume) : true;

  function changeProcess(next: Process) {
    setProcess(next);
    setSpecs(defaultSpecsFor(next));
    setMachineId("");
    setMaterialType("");
    setMaterialId("");
    setFieldErrors({});
  }

  function patchSpecs(patch: Record<string, string | number | boolean>) {
    setSpecs((prev) => ({ ...prev, ...patch }) as SpecsState);
  }

  function changeMaterialType(value: string) {
    setMaterialType(value);
    if (process === "LASER_CUT" || process === "LASER_ENGRAVE") {
      const material = laserMaterialById(value);
      if (material) {
        const midPower = Math.round((material.cutPowerPercent[0] + material.cutPowerPercent[1]) / 2);
        const midSpeed = Math.round((material.cutSpeedMmS[0] + material.cutSpeedMmS[1]) / 2);
        patchSpecs({
          powerPercent: midPower ? String(midPower) : "",
          speedMmS: midSpeed ? String(midSpeed) : "",
          kerfCompensationMm: material.kerfMm ? String(material.kerfMm) : "",
          airAssist: material.airAssist !== "off",
          materialThicknessMm: material.thicknessesMm[0] ?? 3,
        });
      }
    }
    if (process === "CNC") {
      patchSpecs({ stockMaterial: value });
    }
  }

  const catalogMaterials = useMemo(() => {
    if (process === "FDM") {
      return FILAMENTS.map((item) => ({ id: item.id, label: item.label }));
    }
    if (process === "RESIN") {
      return RESIN_TYPES.map((item) => ({ id: item.id, label: item.label }));
    }
    if (process === "LASER_CUT" || process === "LASER_ENGRAVE") {
      return LASER_MATERIALS.map((item) => ({ id: item.id, label: item.label }));
    }
    if (process === "CNC") {
      return CNC_STOCK_MATERIALS.map((name) => ({ id: name, label: name }));
    }
    return [];
  }, [process]);

  const stockColors = selectedStock ? parseColorList(selectedStock.colors) : [];

  async function submitRequest() {
    if (submitting || disabled) return;
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const payload = {
      profileSlug,
      title,
      description,
      process,
      machineId: machineId || undefined,
      materialId: materialId || undefined,
      materialType: materialType || undefined,
      materialColor: materialColor || undefined,
      quantity: Number(quantity) || 1,
      fulfillment,
      budget: budget.trim() === "" ? undefined : Number(budget),
      deadline: deadline || undefined,
      dimensionsX: dimX || undefined,
      dimensionsY: dimY || undefined,
      dimensionsZ: dimZ || undefined,
      fileUrl: fileUrl || undefined,
      fileIds,
      specs,
    };

    const result = await apiRequest<{ id: string }>("/api/requests", {
      method: "POST",
      body: payload,
    });
    setSubmitting(false);

    if (!result.ok) {
      setFormError(result.error.formErrors[0] ?? result.error.message);
      setFieldErrors(result.error.fieldErrors);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    router.push(`/messages/${result.data.id}`);
  }

  async function submitMessage() {
    if (submitting || disabled) return;
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const result = await apiRequest<{ id: string }>("/api/conversations", {
      method: "POST",
      body: { profileSlug, subject, message: messageBody },
    });
    setSubmitting(false);

    if (!result.ok) {
      setFormError(result.error.formErrors[0] ?? result.error.message);
      setFieldErrors(result.error.fieldErrors);
      return;
    }
    router.push(`/messages/${result.data.id}`);
  }

  const reviewRequest: SpecSheetRequest = {
    id: "preview",
    title: title || "Untitled request",
    description: description || "—",
    process,
    status: "OPEN",
    quantity: Number(quantity) || 1,
    fulfillment,
    materialType: materialType || null,
    materialColor: materialColor || null,
    budgetCents: budget.trim() === "" ? null : Math.round((Number(budget) || 0) * 100),
    deadline: deadline ? new Date(deadline) : null,
    dimensionsX: toNum(dimX),
    dimensionsY: toNum(dimY),
    dimensionsZ: toNum(dimZ),
    specs: JSON.stringify(specs),
    fileUrl: fileUrl || null,
    declineReason: null,
    quotedPriceCents: null,
    quotedLeadDays: null,
    machine: selectedMachine
      ? {
          make: selectedMachine.make,
          model: selectedMachine.model,
          buildVolume: selectedMachine.buildVolume,
        }
      : null,
    material: selectedStock
      ? {
          name: selectedStock.name,
          unit: selectedStock.unit,
          pricePerUnit: selectedStock.pricePerUnit,
          currency: selectedStock.currency,
        }
      : null,
  };

  const tabClass = (active: boolean) =>
    cn(
      "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
      active
        ? "bg-ember-50 text-ember-700"
        : "text-ink-muted hover:bg-surface-muted hover:text-ink",
    );

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Contact mode" className="flex gap-1">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "request"}
          className={tabClass(mode === "request")}
          onClick={() => setMode("request")}
        >
          Fabrication request
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "message"}
          className={tabClass(mode === "message")}
          onClick={() => setMode("message")}
        >
          Just send a message
        </button>
      </div>

      {formError ? <Alert tone="error">{formError}</Alert> : null}

      {mode === "message" ? (
        <Card className="space-y-4">
          <Field label="Subject" htmlFor="subject" required error={firstError(fieldErrors, "subject")}>
            <Input
              id="subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={120}
              disabled={disabled}
              placeholder={`Question for ${makerName}`}
            />
          </Field>
          <Field label="Message" htmlFor="message" required error={firstError(fieldErrors, "message")}>
            <Textarea
              id="message"
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
              rows={6}
              maxLength={LIMITS.messageBody}
              disabled={disabled}
            />
          </Field>
          <div className="flex justify-end">
            <Button type="button" onClick={submitMessage} disabled={submitting || disabled}>
              {submitting ? "Sending…" : "Send message"}
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <SectionCard
            step={1}
            title="Design files"
            description="Upload the models or vector files you want made. You can add an external link too."
          >
            <FileUploader process={process} onIdsChange={setFileIds} />
            <Field
              label="External file link"
              htmlFor="fileUrl"
              error={firstError(fieldErrors, "fileUrl")}
              hint="Optional — a Drive, Dropbox or Printables URL if you host files elsewhere."
            >
              <Input
                id="fileUrl"
                type="url"
                value={fileUrl}
                onChange={(event) => setFileUrl(event.target.value)}
                placeholder="https://…"
                disabled={disabled}
              />
            </Field>
          </SectionCard>

          <SectionCard
            step={2}
            title="Process"
            description="How should this be made? This tailors the settings below."
          >
            <ProcessPicker value={process} onChange={changeProcess} />
          </SectionCard>

          <SectionCard
            step={3}
            title="Machine & material"
            description="Optionally target a specific machine, and tell the maker what to make it from."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Preferred machine"
                htmlFor="machineId"
                error={firstError(fieldErrors, "machineId")}
                hint={
                  eligibleMachines.length === 0
                    ? "This maker has no listed machine for this process — they may still be able to help."
                    : undefined
                }
              >
                <Select
                  id="machineId"
                  value={machineId}
                  onChange={(event) => setMachineId(event.target.value)}
                  disabled={disabled}
                >
                  <option value="">No preference</option>
                  {eligibleMachines.map((machine) => (
                    <option key={machine.id} value={machine.id}>
                      {machine.make} {machine.model}
                      {machine.buildVolume ? ` — ${machine.buildVolume}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>

              {catalogMaterials.length > 0 ? (
                <Field
                  label={process === "CNC" ? "Stock material" : "Material"}
                  htmlFor="materialType"
                  error={firstError(fieldErrors, "materialType")}
                >
                  <Select
                    id="materialType"
                    value={materialType}
                    onChange={(event) => changeMaterialType(event.target.value)}
                    disabled={disabled}
                  >
                    <option value="">No preference</option>
                    {catalogMaterials.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {eligibleStock.length > 0 ? (
                <Field
                  label="Use the maker's stock (optional)"
                  htmlFor="materialId"
                  error={firstError(fieldErrors, "materialId")}
                >
                  <Select
                    id="materialId"
                    value={materialId}
                    onChange={(event) => setMaterialId(event.target.value)}
                    disabled={disabled}
                  >
                    <option value="">No preference</option>
                    {eligibleStock.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.name} —{" "}
                        {formatPrice(material.pricePerUnit, material.unit, material.currency)}
                        {material.inStock ? "" : " (out of stock)"}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}

              <Field
                label="Colour / finish"
                htmlFor="materialColor"
                error={firstError(fieldErrors, "materialColor")}
                hint={
                  stockColors.length > 0
                    ? `Maker stocks: ${stockColors.join(", ")}`
                    : "Optional — e.g. matte black, natural, safety orange."
                }
              >
                <Input
                  id="materialColor"
                  value={materialColor}
                  onChange={(event) => setMaterialColor(event.target.value)}
                  maxLength={60}
                  disabled={disabled}
                  list={stockColors.length > 0 ? "stock-colors" : undefined}
                />
                {stockColors.length > 0 ? (
                  <datalist id="stock-colors">
                    {stockColors.map((color) => (
                      <option key={color} value={color} />
                    ))}
                  </datalist>
                ) : null}
              </Field>
            </div>

            {selectedFilament ? (
              <div className="rounded-xl border border-line bg-surface-muted p-3 text-xs text-ink-muted">
                <p className="text-sm font-semibold text-ink">{selectedFilament.label}</p>
                <p className="mt-1">
                  Nozzle {selectedFilament.nozzleC[0]}–{selectedFilament.nozzleC[1]} °C · bed{" "}
                  {selectedFilament.bedC[0]}–{selectedFilament.bedC[1]} °C. {selectedFilament.notes}
                </p>
                {selectedFilament.enclosure === "required" ? (
                  <div className="mt-2">
                    <Alert tone="error">
                      {selectedFilament.label} warps badly without an enclosed printer. Make sure
                      this maker has an enclosure before choosing it.
                    </Alert>
                  </div>
                ) : selectedFilament.enclosure === "recommended" ? (
                  <p className="mt-2 font-medium text-clay-600">
                    An enclosure is recommended for reliable results.
                  </p>
                ) : null}
              </div>
            ) : null}

            {process === "LASER_CUT" || process === "LASER_ENGRAVE" ? (
              <>
                <Alert tone="error" title="Laser safety — never cut these">
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {LASER_FORBIDDEN_MATERIALS.map((item) => (
                      <li key={item.id}>
                        <strong>{item.label}</strong> — {item.reason}
                      </li>
                    ))}
                  </ul>
                </Alert>
                {(() => {
                  const material = laserMaterialById(materialType);
                  return material?.hazard ? (
                    <Alert tone="error" title={`${material.label} hazard`}>
                      {material.hazard}
                    </Alert>
                  ) : null;
                })()}
              </>
            ) : null}
          </SectionCard>

          <SectionCard
            step={4}
            title="Part dimensions"
            description="Rough bounding box of your part, in millimetres. Helps the maker check it fits."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Width (X)" htmlFor="dimX" error={firstError(fieldErrors, "dimensionsX")}>
                <Input
                  id="dimX"
                  type="number"
                  min={0}
                  step="0.1"
                  value={dimX}
                  onChange={(event) => setDimX(event.target.value)}
                  disabled={disabled}
                />
              </Field>
              <Field label="Depth (Y)" htmlFor="dimY" error={firstError(fieldErrors, "dimensionsY")}>
                <Input
                  id="dimY"
                  type="number"
                  min={0}
                  step="0.1"
                  value={dimY}
                  onChange={(event) => setDimY(event.target.value)}
                  disabled={disabled}
                />
              </Field>
              <Field label="Height (Z)" htmlFor="dimZ" error={firstError(fieldErrors, "dimensionsZ")}>
                <Input
                  id="dimZ"
                  type="number"
                  min={0}
                  step="0.1"
                  value={dimZ}
                  onChange={(event) => setDimZ(event.target.value)}
                  disabled={disabled}
                />
              </Field>
            </div>
            {!partFits && machineVolume && partDims ? (
              <Alert tone="error">
                Your part ({formatDimensions(partDims)}) won&apos;t fit the{" "}
                {selectedMachine?.make} {selectedMachine?.model} build volume (
                {formatDimensions(machineVolume)}). Choose another machine or split the part.
              </Alert>
            ) : null}
          </SectionCard>

          <SectionCard
            step={5}
            title="Settings"
            description="Dial in the process-specific settings you'd like."
          >
            <SpecFields
              specs={specs}
              materialTypeId={materialType}
              onChange={patchSpecs}
              error={firstError(fieldErrors, "specs")}
            />
          </SectionCard>

          <SectionCard
            step={6}
            title="Job details"
            description="Tell the maker what you need and when."
          >
            <Field label="Title" htmlFor="title" required error={firstError(fieldErrors, "title")}>
              <Input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                disabled={disabled}
                placeholder="e.g. Replacement drone frame in PETG"
              />
            </Field>
            <Field
              label="Description"
              htmlFor="description"
              required
              error={firstError(fieldErrors, "description")}
              hint="Anything the maker should know: finish, tolerances, use case, references."
            >
              <Textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                maxLength={4000}
                disabled={disabled}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Quantity" htmlFor="quantity" error={firstError(fieldErrors, "quantity")}>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  max={10000}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  disabled={disabled}
                />
              </Field>
              <Field
                label="Fulfilment"
                htmlFor="fulfillment"
                error={firstError(fieldErrors, "fulfillment")}
              >
                <Select
                  id="fulfillment"
                  value={fulfillment}
                  onChange={(event) => setFulfillment(event.target.value as Fulfillment)}
                  disabled={disabled}
                >
                  {fulfillmentOptions.map((option) => (
                    <option key={option} value={option}>
                      {FULFILLMENT_LABELS[option]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Budget (USD)"
                htmlFor="budget"
                error={firstError(fieldErrors, "budget")}
                hint="Optional — helps the maker gauge scope."
              >
                <Input
                  id="budget"
                  type="number"
                  min={0}
                  step="0.01"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  placeholder="0.00"
                  disabled={disabled}
                />
              </Field>
              <Field
                label="Deadline"
                htmlFor="deadline"
                error={firstError(fieldErrors, "deadline")}
                hint="Optional — when do you need it by?"
              >
                <Input
                  id="deadline"
                  type="date"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                  disabled={disabled}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            step={7}
            title="Review & send"
            description="Check the spec sheet the maker will receive, then send it over."
          >
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              <Badge tone="blueprint">{fileIds.length} file(s) attached</Badge>
              {fileUrl ? <Badge tone="neutral">External link</Badge> : null}
            </div>
            <RequestSpecSheet request={reviewRequest} showFiles={false} />
            <div className="flex justify-end">
              <Button type="button" onClick={submitRequest} disabled={submitting || disabled}>
                {submitting ? "Sending…" : "Send fabrication request"}
              </Button>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
