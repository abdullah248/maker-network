"use client";

import {
  BED_ADHESION_LABELS,
  BED_ADHESION_TYPES,
  CNC_BIT_DIAMETERS_MM,
  CNC_DEFAULTS,
  FDM_QUALITY_PRESETS,
  INFILL_PATTERNS,
  INFILL_PATTERN_LABELS,
  LASER_ENGRAVE_DPI,
  LASER_OPERATIONS,
  LASER_OPERATION_LABELS,
  LAYER_HEIGHTS_MM,
  NOZZLE_SIZES_MM,
  RESIN_DEFAULTS,
  RESIN_LAYER_HEIGHTS_MM,
  SUPPORT_TYPES,
  SUPPORT_TYPE_LABELS,
  laserMaterialById,
  maxLayerHeightFor,
  type BedAdhesion,
  type InfillPattern,
  type LaserOperation,
  type Process,
  type SupportType,
} from "@/lib/print-specs";
import { Alert, Card, Checkbox, Field, Input, Select, cn } from "@/components/ui";

// ---------------------------------------------------------------------------
// Spec state shapes — one per process. Optional numeric fields are kept as
// strings so the inputs can be cleared; the server schema coerces "" to
// undefined. Everything here maps 1:1 to the strict Zod spec schemas.
// ---------------------------------------------------------------------------

export type FdmSpecState = {
  process: "FDM";
  qualityPreset: string;
  layerHeightMm: number;
  nozzleMm: number;
  infillPercent: number;
  infillPattern: InfillPattern;
  wallCount: number;
  topBottomLayers: number;
  supportType: SupportType;
  supportOverhangDeg: string;
  bedAdhesion: BedAdhesion;
  nozzleTempC: string;
  bedTempC: string;
  ironing: boolean;
  watertight: boolean;
};

export type ResinSpecState = {
  process: "RESIN";
  layerHeightMm: number;
  exposureSeconds: string;
  bottomExposureSeconds: string;
  bottomLayers: string;
  antiAliasing: string;
  hollow: boolean;
  hollowWallMm: string;
  drainHoles: boolean;
  supportsRequired: boolean;
  postCure: boolean;
};

export type LaserSpecState = {
  process: "LASER_CUT" | "LASER_ENGRAVE";
  operation: LaserOperation;
  materialThicknessMm: number;
  passes: number;
  powerPercent: string;
  speedMmS: string;
  frequencyHz: string;
  engraveDpi: string;
  kerfCompensationMm: string;
  airAssist: boolean;
  focusOffsetMm: string;
  materialSuppliedByCustomer: boolean;
};

export type CncSpecState = {
  process: "CNC";
  stockMaterial: string;
  stockThicknessMm: number;
  bitDiameterMm: number;
  spindleRpm: string;
  feedRateMmMin: string;
  depthPerPassMm: string;
  stepoverPercent: string;
  tabs: boolean;
  toleranceMm: string;
};

export type OtherSpecState = {
  process: "OTHER";
  details: string;
};

export type SpecsState =
  | FdmSpecState
  | ResinSpecState
  | LaserSpecState
  | CncSpecState
  | OtherSpecState;

const STANDARD = FDM_QUALITY_PRESETS.find((preset) => preset.id === "STANDARD")!;

/** Builds a fresh spec block seeded with sensible defaults for a process. */
export function defaultSpecsFor(process: Process): SpecsState {
  switch (process) {
    case "FDM":
      return {
        process: "FDM",
        qualityPreset: STANDARD.id,
        layerHeightMm: STANDARD.layerHeightMm,
        nozzleMm: 0.4,
        infillPercent: STANDARD.infillPercent,
        infillPattern: "GRID",
        wallCount: STANDARD.wallCount,
        topBottomLayers: STANDARD.topBottomLayers,
        supportType: "NONE",
        supportOverhangDeg: "",
        bedAdhesion: "SKIRT",
        nozzleTempC: "",
        bedTempC: "",
        ironing: false,
        watertight: false,
      };
    case "RESIN":
      return {
        process: "RESIN",
        layerHeightMm: RESIN_DEFAULTS.layerHeightMm,
        exposureSeconds: String(RESIN_DEFAULTS.exposureSeconds),
        bottomExposureSeconds: String(RESIN_DEFAULTS.bottomExposureSeconds),
        bottomLayers: String(RESIN_DEFAULTS.bottomLayers),
        antiAliasing: String(RESIN_DEFAULTS.antiAliasing),
        hollow: false,
        hollowWallMm: "",
        drainHoles: false,
        supportsRequired: true,
        postCure: true,
      };
    case "LASER_CUT":
    case "LASER_ENGRAVE":
      return {
        process,
        operation: process === "LASER_ENGRAVE" ? "ENGRAVE" : "CUT",
        materialThicknessMm: 3,
        passes: 1,
        powerPercent: "",
        speedMmS: "",
        frequencyHz: "",
        engraveDpi: process === "LASER_ENGRAVE" ? "300" : "",
        kerfCompensationMm: "",
        airAssist: true,
        focusOffsetMm: "",
        materialSuppliedByCustomer: false,
      };
    case "CNC":
      return {
        process: "CNC",
        stockMaterial: "Plywood",
        stockThicknessMm: 12,
        bitDiameterMm: 3.175,
        spindleRpm: String(CNC_DEFAULTS.spindleRpm),
        feedRateMmMin: String(CNC_DEFAULTS.feedRateMmMin),
        depthPerPassMm: String(CNC_DEFAULTS.depthPerPassMm),
        stepoverPercent: String(CNC_DEFAULTS.stepoverPercent),
        tabs: true,
        toleranceMm: "",
      };
    case "OTHER":
    default:
      return { process: "OTHER", details: "" };
  }
}

type SpecPatch = Record<string, string | number | boolean>;

function PresetChip({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-xl border p-3 text-left transition-colors",
        active
          ? "border-ember-500 bg-ember-50"
          : "border-line bg-surface hover:bg-surface-muted",
      )}
    >
      <span className="block text-sm font-semibold text-ink">{title}</span>
      <span className="mt-0.5 block text-xs text-ink-muted">{description}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// FDM
// ---------------------------------------------------------------------------

function FdmFields({
  specs,
  onChange,
}: {
  specs: FdmSpecState;
  onChange: (patch: SpecPatch) => void;
}) {
  const maxLayer = maxLayerHeightFor(specs.nozzleMm);
  const layerTooTall = specs.layerHeightMm > maxLayer;

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium text-ink">Quality preset</p>
        <p className="mb-3 text-xs text-ink-muted">
          A one-click starting point. You can fine-tune every value below.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {FDM_QUALITY_PRESETS.map((preset) => (
            <PresetChip
              key={preset.id}
              active={specs.qualityPreset === preset.id}
              title={preset.label}
              description={preset.description}
              onClick={() =>
                onChange({
                  qualityPreset: preset.id,
                  layerHeightMm: preset.layerHeightMm,
                  infillPercent: preset.infillPercent,
                  wallCount: preset.wallCount,
                  topBottomLayers: preset.topBottomLayers,
                })
              }
            />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Layer height"
          htmlFor="fdm-layer"
          error={
            layerTooTall
              ? `Layer height must be at most 80% of the nozzle (≤ ${maxLayer} mm for a ${specs.nozzleMm} mm nozzle).`
              : undefined
          }
          hint={`Finer layers look smoother but print slower. Max ${maxLayer} mm for this nozzle.`}
        >
          <Select
            id="fdm-layer"
            value={specs.layerHeightMm}
            onChange={(event) =>
              onChange({ layerHeightMm: Number(event.target.value), qualityPreset: "" })
            }
          >
            {LAYER_HEIGHTS_MM.map((value) => (
              <option key={value} value={value}>
                {value.toFixed(2)} mm
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Nozzle size" htmlFor="fdm-nozzle">
          <Select
            id="fdm-nozzle"
            value={specs.nozzleMm}
            onChange={(event) => onChange({ nozzleMm: Number(event.target.value) })}
          >
            {NOZZLE_SIZES_MM.map((value) => (
              <option key={value} value={value}>
                {value.toFixed(2)} mm
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label={`Infill — ${specs.infillPercent}%`} htmlFor="fdm-infill">
        <div className="flex items-center gap-3">
          <input
            id="fdm-infill"
            type="range"
            min={0}
            max={100}
            step={5}
            value={specs.infillPercent}
            onChange={(event) =>
              onChange({ infillPercent: Number(event.target.value), qualityPreset: "" })
            }
            className="h-2 w-full cursor-pointer accent-[var(--color-ember-500)]"
          />
          <Input
            type="number"
            min={0}
            max={100}
            value={specs.infillPercent}
            onChange={(event) =>
              onChange({ infillPercent: Number(event.target.value), qualityPreset: "" })
            }
            className="w-20"
          />
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Infill pattern" htmlFor="fdm-pattern">
          <Select
            id="fdm-pattern"
            value={specs.infillPattern}
            onChange={(event) => onChange({ infillPattern: event.target.value })}
          >
            {INFILL_PATTERNS.map((pattern) => (
              <option key={pattern} value={pattern}>
                {INFILL_PATTERN_LABELS[pattern]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Bed adhesion" htmlFor="fdm-adhesion">
          <Select
            id="fdm-adhesion"
            value={specs.bedAdhesion}
            onChange={(event) => onChange({ bedAdhesion: event.target.value })}
          >
            {BED_ADHESION_TYPES.map((type) => (
              <option key={type} value={type}>
                {BED_ADHESION_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Wall / perimeter count" htmlFor="fdm-walls">
          <Input
            id="fdm-walls"
            type="number"
            min={1}
            max={20}
            value={specs.wallCount}
            onChange={(event) =>
              onChange({ wallCount: Number(event.target.value), qualityPreset: "" })
            }
          />
        </Field>

        <Field label="Top / bottom layers" htmlFor="fdm-topbottom">
          <Input
            id="fdm-topbottom"
            type="number"
            min={1}
            max={30}
            value={specs.topBottomLayers}
            onChange={(event) =>
              onChange({ topBottomLayers: Number(event.target.value), qualityPreset: "" })
            }
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Support type" htmlFor="fdm-support">
          <Select
            id="fdm-support"
            value={specs.supportType}
            onChange={(event) => onChange({ supportType: event.target.value })}
          >
            {SUPPORT_TYPES.map((type) => (
              <option key={type} value={type}>
                {SUPPORT_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Support overhang angle"
          htmlFor="fdm-overhang"
          hint="Optional — degrees from vertical before supports kick in (e.g. 50)."
        >
          <Input
            id="fdm-overhang"
            type="number"
            min={0}
            max={90}
            placeholder="Auto"
            value={specs.supportOverhangDeg}
            disabled={specs.supportType === "NONE"}
            onChange={(event) => onChange({ supportOverhangDeg: event.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nozzle temperature override"
          htmlFor="fdm-nozzle-temp"
          hint="Optional — leave blank to let the maker use the material default (°C)."
        >
          <Input
            id="fdm-nozzle-temp"
            type="number"
            min={0}
            max={500}
            placeholder="Maker default"
            value={specs.nozzleTempC}
            onChange={(event) => onChange({ nozzleTempC: event.target.value })}
          />
        </Field>

        <Field
          label="Bed temperature override"
          htmlFor="fdm-bed-temp"
          hint="Optional — leave blank for the material default (°C)."
        >
          <Input
            id="fdm-bed-temp"
            type="number"
            min={0}
            max={200}
            placeholder="Maker default"
            value={specs.bedTempC}
            onChange={(event) => onChange({ bedTempC: event.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Checkbox
          label="Ironing"
          description="Smooths flat top surfaces. Adds print time."
          checked={specs.ironing}
          onChange={(event) => onChange({ ironing: event.target.checked })}
        />
        <Checkbox
          label="Must be watertight"
          description="Ask the maker to tune walls so the part holds liquid or air."
          checked={specs.watertight}
          onChange={(event) => onChange({ watertight: event.target.checked })}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resin
// ---------------------------------------------------------------------------

function ResinFields({
  specs,
  onChange,
}: {
  specs: ResinSpecState;
  onChange: (patch: SpecPatch) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Layer height"
          htmlFor="resin-layer"
          hint="Thinner layers reveal finer detail on miniatures."
        >
          <Select
            id="resin-layer"
            value={specs.layerHeightMm}
            onChange={(event) => onChange({ layerHeightMm: Number(event.target.value) })}
          >
            {RESIN_LAYER_HEIGHTS_MM.map((value) => (
              <option key={value} value={value}>
                {value.toFixed(3)} mm
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Anti-aliasing"
          htmlFor="resin-aa"
          hint="Optional — softens stair-stepping (1–16)."
        >
          <Input
            id="resin-aa"
            type="number"
            min={1}
            max={16}
            value={specs.antiAliasing}
            onChange={(event) => onChange({ antiAliasing: event.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Exposure"
          htmlFor="resin-exposure"
          hint="Seconds per layer."
        >
          <Input
            id="resin-exposure"
            type="number"
            min={0}
            max={60}
            step="0.1"
            value={specs.exposureSeconds}
            onChange={(event) => onChange({ exposureSeconds: event.target.value })}
          />
        </Field>

        <Field label="Bottom exposure" htmlFor="resin-bottom-exposure" hint="Seconds.">
          <Input
            id="resin-bottom-exposure"
            type="number"
            min={0}
            max={180}
            step="0.5"
            value={specs.bottomExposureSeconds}
            onChange={(event) => onChange({ bottomExposureSeconds: event.target.value })}
          />
        </Field>

        <Field label="Bottom layers" htmlFor="resin-bottom-layers">
          <Input
            id="resin-bottom-layers"
            type="number"
            min={1}
            max={30}
            value={specs.bottomLayers}
            onChange={(event) => onChange({ bottomLayers: event.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Checkbox
          label="Supports required"
          description="Maker adds and removes supports for you."
          checked={specs.supportsRequired}
          onChange={(event) => onChange({ supportsRequired: event.target.checked })}
        />
        <Checkbox
          label="Post-cure"
          description="UV cure after printing for full strength."
          checked={specs.postCure}
          onChange={(event) => onChange({ postCure: event.target.checked })}
        />
        <Checkbox
          label="Hollow the model"
          description="Saves resin on solid models. Needs a wall thickness."
          checked={specs.hollow}
          onChange={(event) => onChange({ hollow: event.target.checked })}
        />
        <Checkbox
          label="Add drain holes"
          description="Lets trapped resin escape from hollowed parts."
          checked={specs.drainHoles}
          onChange={(event) => onChange({ drainHoles: event.target.checked })}
        />
      </div>

      {specs.hollow ? (
        <Field
          label="Wall thickness"
          htmlFor="resin-wall"
          hint="At least 1 mm, or a hollowed part will collapse (mm)."
        >
          <Input
            id="resin-wall"
            type="number"
            min={1}
            max={10}
            step="0.1"
            placeholder={String(RESIN_DEFAULTS.minHollowWallMm)}
            value={specs.hollowWallMm}
            onChange={(event) => onChange({ hollowWallMm: event.target.value })}
          />
        </Field>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Laser
// ---------------------------------------------------------------------------

function LaserFields({
  specs,
  materialTypeId,
  onChange,
}: {
  specs: LaserSpecState;
  materialTypeId: string;
  onChange: (patch: SpecPatch) => void;
}) {
  const material = laserMaterialById(materialTypeId);

  return (
    <div className="space-y-5">
      {material ? (
        <div className="rounded-xl border border-blueprint-100 bg-blueprint-50 p-3 text-xs text-blueprint-700">
          <p className="font-semibold">{material.label} — suggested starting points</p>
          <p className="mt-1">
            Cut power {material.cutPowerPercent[0]}–{material.cutPowerPercent[1]}% · speed{" "}
            {material.cutSpeedMmS[0]}–{material.cutSpeedMmS[1]} mm/s · kerf ≈ {material.kerfMm} mm ·
            air assist {material.airAssist}. {material.notes}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Operation" htmlFor="laser-operation">
          <Select
            id="laser-operation"
            value={specs.operation}
            onChange={(event) => onChange({ operation: event.target.value })}
          >
            {LASER_OPERATIONS.map((operation) => (
              <option key={operation} value={operation}>
                {LASER_OPERATION_LABELS[operation]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Material thickness" htmlFor="laser-thickness" hint="Millimetres.">
          {material && material.thicknessesMm.length > 0 ? (
            <Select
              id="laser-thickness"
              value={specs.materialThicknessMm}
              onChange={(event) =>
                onChange({ materialThicknessMm: Number(event.target.value) })
              }
            >
              {material.thicknessesMm.map((value) => (
                <option key={value} value={value}>
                  {value} mm
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id="laser-thickness"
              type="number"
              min={0.05}
              max={50}
              step="0.1"
              value={specs.materialThicknessMm}
              onChange={(event) =>
                onChange({ materialThicknessMm: Number(event.target.value) })
              }
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Passes" htmlFor="laser-passes">
          <Input
            id="laser-passes"
            type="number"
            min={1}
            max={10}
            value={specs.passes}
            onChange={(event) => onChange({ passes: Number(event.target.value) })}
          />
        </Field>

        <Field label="Power" htmlFor="laser-power" hint="Optional — % of max.">
          <Input
            id="laser-power"
            type="number"
            min={0}
            max={100}
            placeholder="Maker default"
            value={specs.powerPercent}
            onChange={(event) => onChange({ powerPercent: event.target.value })}
          />
        </Field>

        <Field label="Speed" htmlFor="laser-speed" hint="Optional — mm/s.">
          <Input
            id="laser-speed"
            type="number"
            min={0}
            max={1000}
            placeholder="Maker default"
            value={specs.speedMmS}
            onChange={(event) => onChange({ speedMmS: event.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Frequency"
          htmlFor="laser-frequency"
          hint="Optional — Hz, for fibre/galvo lasers."
        >
          <Input
            id="laser-frequency"
            type="number"
            min={0}
            placeholder="Maker default"
            value={specs.frequencyHz}
            onChange={(event) => onChange({ frequencyHz: event.target.value })}
          />
        </Field>

        <Field
          label="Engrave resolution"
          htmlFor="laser-dpi"
          hint="Optional — DPI for raster engraving."
        >
          <Select
            id="laser-dpi"
            value={specs.engraveDpi}
            disabled={specs.operation === "CUT"}
            onChange={(event) => onChange({ engraveDpi: event.target.value })}
          >
            <option value="">Maker default</option>
            {LASER_ENGRAVE_DPI.map((dpi) => (
              <option key={dpi} value={dpi}>
                {dpi} DPI
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Kerf compensation"
          htmlFor="laser-kerf"
          hint="Optional — mm to offset for beam width."
        >
          <Input
            id="laser-kerf"
            type="number"
            min={0}
            max={2}
            step="0.01"
            placeholder={material ? String(material.kerfMm) : "0"}
            value={specs.kerfCompensationMm}
            onChange={(event) => onChange({ kerfCompensationMm: event.target.value })}
          />
        </Field>
      </div>

      <Field
        label="Focus offset"
        htmlFor="laser-focus"
        hint="Optional — mm above/below the surface (-20 to 20)."
      >
        <Input
          id="laser-focus"
          type="number"
          min={-20}
          max={20}
          step="0.1"
          placeholder="0"
          value={specs.focusOffsetMm}
          onChange={(event) => onChange({ focusOffsetMm: event.target.value })}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Checkbox
          label="Air assist"
          description="Blows away smoke for a cleaner edge."
          checked={specs.airAssist}
          onChange={(event) => onChange({ airAssist: event.target.checked })}
        />
        <Checkbox
          label="I'm supplying the material"
          description="You'll provide the sheet stock to cut."
          checked={specs.materialSuppliedByCustomer}
          onChange={(event) =>
            onChange({ materialSuppliedByCustomer: event.target.checked })
          }
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CNC
// ---------------------------------------------------------------------------

function CncFields({
  specs,
  onChange,
}: {
  specs: CncSpecState;
  onChange: (patch: SpecPatch) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Stock thickness"
          htmlFor="cnc-thickness"
          hint="Thickness of the stock you're machining from (mm)."
        >
          <Input
            id="cnc-thickness"
            type="number"
            min={0.1}
            max={500}
            step="0.5"
            value={specs.stockThicknessMm}
            onChange={(event) => onChange({ stockThicknessMm: Number(event.target.value) })}
          />
        </Field>

        <Field label="Bit / tool diameter" htmlFor="cnc-bit" hint="Millimetres.">
          <Select
            id="cnc-bit"
            value={specs.bitDiameterMm}
            onChange={(event) => onChange({ bitDiameterMm: Number(event.target.value) })}
          >
            {CNC_BIT_DIAMETERS_MM.map((value) => (
              <option key={value} value={value}>
                {value} mm
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Spindle speed" htmlFor="cnc-rpm" hint="Optional — RPM.">
          <Input
            id="cnc-rpm"
            type="number"
            min={1000}
            max={60000}
            placeholder={String(CNC_DEFAULTS.spindleRpm)}
            value={specs.spindleRpm}
            onChange={(event) => onChange({ spindleRpm: event.target.value })}
          />
        </Field>

        <Field label="Feed rate" htmlFor="cnc-feed" hint="Optional — mm/min.">
          <Input
            id="cnc-feed"
            type="number"
            min={0}
            max={20000}
            placeholder={String(CNC_DEFAULTS.feedRateMmMin)}
            value={specs.feedRateMmMin}
            onChange={(event) => onChange({ feedRateMmMin: event.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Depth per pass" htmlFor="cnc-depth" hint="Optional — mm.">
          <Input
            id="cnc-depth"
            type="number"
            min={0}
            max={50}
            step="0.1"
            placeholder={String(CNC_DEFAULTS.depthPerPassMm)}
            value={specs.depthPerPassMm}
            onChange={(event) => onChange({ depthPerPassMm: event.target.value })}
          />
        </Field>

        <Field label="Stepover" htmlFor="cnc-stepover" hint="Optional — % of bit.">
          <Input
            id="cnc-stepover"
            type="number"
            min={0}
            max={100}
            placeholder={String(CNC_DEFAULTS.stepoverPercent)}
            value={specs.stepoverPercent}
            onChange={(event) => onChange({ stepoverPercent: event.target.value })}
          />
        </Field>

        <Field label="Tolerance" htmlFor="cnc-tolerance" hint="Optional — ± mm.">
          <Input
            id="cnc-tolerance"
            type="number"
            min={0}
            max={10}
            step="0.01"
            placeholder="0.1"
            value={specs.toleranceMm}
            onChange={(event) => onChange({ toleranceMm: event.target.value })}
          />
        </Field>
      </div>

      <Checkbox
        label="Add hold-down tabs"
        description="Small tabs keep the part attached to the stock until you cut it free."
        checked={specs.tabs}
        onChange={(event) => onChange({ tabs: event.target.checked })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public dispatcher
// ---------------------------------------------------------------------------

export function SpecFields({
  specs,
  materialTypeId,
  onChange,
  error,
}: {
  specs: SpecsState;
  materialTypeId: string;
  onChange: (patch: SpecPatch) => void;
  error?: string;
}) {
  return (
    <div className="space-y-4">
      <Alert tone="info">
        These are the settings you&apos;re <strong>requesting</strong>. The maker reviews and
        confirms every value before running your job.
      </Alert>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {specs.process === "FDM" ? <FdmFields specs={specs} onChange={onChange} /> : null}
      {specs.process === "RESIN" ? <ResinFields specs={specs} onChange={onChange} /> : null}
      {specs.process === "LASER_CUT" || specs.process === "LASER_ENGRAVE" ? (
        <LaserFields specs={specs} materialTypeId={materialTypeId} onChange={onChange} />
      ) : null}
      {specs.process === "CNC" ? <CncFields specs={specs} onChange={onChange} /> : null}
      {specs.process === "OTHER" ? (
        <Field
          label="What do you need made?"
          htmlFor="other-details"
          error={error}
          hint="Describe the process, materials, dimensions and finish in your own words."
        >
          <Card className="p-0">
            <textarea
              id="other-details"
              rows={5}
              maxLength={2000}
              value={specs.details}
              onChange={(event) => onChange({ details: event.target.value })}
              className="w-full rounded-2xl bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted/70 focus:outline-none"
              placeholder="e.g. Vinyl-cut vehicle decals, 300 mm wide, matte black outdoor vinyl."
            />
          </Card>
        </Field>
      ) : null}
    </div>
  );
}
