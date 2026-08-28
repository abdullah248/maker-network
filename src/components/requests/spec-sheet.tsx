import { Badge, Card, cn } from "@/components/ui";
import { FULFILLMENT_LABELS, type Fulfillment } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import {
  BED_ADHESION_LABELS,
  INFILL_PATTERN_LABELS,
  LASER_OPERATION_LABELS,
  PROCESS_LABELS,
  SUPPORT_TYPE_LABELS,
  filamentById,
  type BedAdhesion,
  type InfillPattern,
  type LaserOperation,
  type Process,
  type SupportType,
} from "@/lib/print-specs";
import { parseStoredSpecs, type Specs } from "@/lib/validation";
import { formatBytes } from "@/lib/services/uploads";

export type SpecSheetRequest = {
  id: string;
  title: string;
  description: string;
  process: string;
  status: string;
  quantity: number;
  fulfillment: string;
  materialType: string | null;
  materialColor: string | null;
  budgetCents: number | null;
  deadline: Date | null;
  dimensionsX: number | null;
  dimensionsY: number | null;
  dimensionsZ: number | null;
  specs: string | null;
  fileUrl: string | null;
  declineReason: string | null;
  quotedPriceCents: number | null;
  quotedLeadDays: number | null;
  machine?: { make: string; model: string; buildVolume?: string | null } | null;
  material?: { name: string; unit: string; pricePerUnit: number; currency: string } | null;
  files?: Array<{ id: string; filename: string; sizeBytes: number }>;
};

const STATUS_TONES: Record<string, "neutral" | "ember" | "moss" | "danger" | "blueprint"> = {
  OPEN: "ember",
  ACCEPTED: "blueprint",
  COMPLETED: "moss",
  DECLINED: "danger",
  CANCELLED: "neutral",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Awaiting review",
  ACCEPTED: "Accepted",
  COMPLETED: "Completed",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
};

export function RequestStatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "neutral"}>{STATUS_LABELS[status] ?? status}</Badge>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-b-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="text-right text-sm text-ink">{value}</dd>
    </div>
  );
}

function yesNo(value: boolean | undefined) {
  return value ? "Yes" : "No";
}

/** Renders the process-specific settings block. */
function ProcessSpecs({ specs }: { specs: Specs }) {
  if (specs.process === "FDM") {
    return (
      <dl>
        <Row label="Layer height" value={`${specs.layerHeightMm} mm`} />
        <Row label="Nozzle" value={`${specs.nozzleMm} mm`} />
        <Row label="Infill" value={`${specs.infillPercent}%`} />
        <Row
          label="Infill pattern"
          value={INFILL_PATTERN_LABELS[specs.infillPattern as InfillPattern] ?? specs.infillPattern}
        />
        <Row label="Walls" value={specs.wallCount} />
        <Row label="Top / bottom layers" value={specs.topBottomLayers} />
        <Row
          label="Supports"
          value={SUPPORT_TYPE_LABELS[specs.supportType as SupportType] ?? specs.supportType}
        />
        <Row
          label="Support overhang"
          value={specs.supportOverhangDeg ? `${specs.supportOverhangDeg}°` : null}
        />
        <Row
          label="Bed adhesion"
          value={BED_ADHESION_LABELS[specs.bedAdhesion as BedAdhesion] ?? specs.bedAdhesion}
        />
        <Row label="Nozzle temp" value={specs.nozzleTempC ? `${specs.nozzleTempC} °C` : null} />
        <Row label="Bed temp" value={specs.bedTempC ? `${specs.bedTempC} °C` : null} />
        <Row label="Ironing" value={specs.ironing ? "Yes" : null} />
        <Row label="Must be watertight" value={specs.watertight ? "Yes" : null} />
      </dl>
    );
  }

  if (specs.process === "RESIN") {
    return (
      <dl>
        <Row label="Layer height" value={`${specs.layerHeightMm} mm`} />
        <Row label="Exposure" value={specs.exposureSeconds ? `${specs.exposureSeconds} s` : null} />
        <Row
          label="Bottom exposure"
          value={specs.bottomExposureSeconds ? `${specs.bottomExposureSeconds} s` : null}
        />
        <Row label="Bottom layers" value={specs.bottomLayers ?? null} />
        <Row label="Anti-aliasing" value={specs.antiAliasing ? `${specs.antiAliasing}x` : null} />
        <Row label="Hollowed" value={yesNo(specs.hollow)} />
        <Row label="Wall thickness" value={specs.hollowWallMm ? `${specs.hollowWallMm} mm` : null} />
        <Row label="Drain holes" value={yesNo(specs.drainHoles)} />
        <Row label="Supports needed" value={yesNo(specs.supportsRequired)} />
        <Row label="Post-cure" value={yesNo(specs.postCure)} />
      </dl>
    );
  }

  if (specs.process === "LASER_CUT" || specs.process === "LASER_ENGRAVE") {
    return (
      <dl>
        <Row
          label="Operation"
          value={LASER_OPERATION_LABELS[specs.operation as LaserOperation] ?? specs.operation}
        />
        <Row label="Material thickness" value={`${specs.materialThicknessMm} mm`} />
        <Row label="Passes" value={specs.passes} />
        <Row label="Power" value={specs.powerPercent ? `${specs.powerPercent}%` : null} />
        <Row label="Speed" value={specs.speedMmS ? `${specs.speedMmS} mm/s` : null} />
        <Row label="Frequency" value={specs.frequencyHz ? `${specs.frequencyHz} Hz` : null} />
        <Row
          label="Engrave resolution"
          value={specs.engraveDpi ? `${specs.engraveDpi} DPI` : null}
        />
        <Row
          label="Kerf compensation"
          value={specs.kerfCompensationMm ? `${specs.kerfCompensationMm} mm` : null}
        />
        <Row label="Air assist" value={yesNo(specs.airAssist)} />
        <Row
          label="Focus offset"
          value={specs.focusOffsetMm !== undefined ? `${specs.focusOffsetMm} mm` : null}
        />
        <Row
          label="Material supplied by"
          value={specs.materialSuppliedByCustomer ? "Customer" : "Maker"}
        />
      </dl>
    );
  }

  if (specs.process === "CNC") {
    return (
      <dl>
        <Row label="Stock material" value={specs.stockMaterial} />
        <Row label="Stock thickness" value={`${specs.stockThicknessMm} mm`} />
        <Row label="Bit diameter" value={`${specs.bitDiameterMm} mm`} />
        <Row label="Spindle" value={specs.spindleRpm ? `${specs.spindleRpm} rpm` : null} />
        <Row
          label="Feed rate"
          value={specs.feedRateMmMin ? `${specs.feedRateMmMin} mm/min` : null}
        />
        <Row
          label="Depth per pass"
          value={specs.depthPerPassMm ? `${specs.depthPerPassMm} mm` : null}
        />
        <Row label="Stepover" value={specs.stepoverPercent ? `${specs.stepoverPercent}%` : null} />
        <Row label="Hold-down tabs" value={yesNo(specs.tabs)} />
        <Row label="Tolerance" value={specs.toleranceMm ? `±${specs.toleranceMm} mm` : null} />
      </dl>
    );
  }

  if (specs.process === "OTHER") {
    return <p className="whitespace-pre-wrap text-sm text-ink">{specs.details}</p>;
  }

  return null;
}

/** Full specification sheet, shown to the maker and echoed back to the customer. */
export function RequestSpecSheet({
  request,
  className,
  showFiles = true,
}: {
  request: SpecSheetRequest;
  className?: string;
  showFiles?: boolean;
}) {
  const specs = parseStoredSpecs(request.specs);
  const filament = request.materialType ? filamentById(request.materialType) : undefined;

  const dimensionParts = [request.dimensionsX, request.dimensionsY, request.dimensionsZ].filter(
    (value): value is number => typeof value === "number" && value > 0,
  );
  const dimensions = dimensionParts.length >= 2 ? `${dimensionParts.join(" × ")} mm` : null;

  return (
    <Card className={cn("space-y-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ember-600">
            Specification
          </p>
          <h3 className="mt-1 text-lg font-semibold text-ink">{request.title}</h3>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>

      <p className="whitespace-pre-wrap text-sm text-ink-muted">{request.description}</p>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-ink">Job</h4>
          <dl>
            <Row
              label="Process"
              value={PROCESS_LABELS[request.process as Process] ?? request.process}
            />
            <Row label="Quantity" value={request.quantity} />
            <Row
              label="Fulfilment"
              value={FULFILLMENT_LABELS[request.fulfillment as Fulfillment] ?? request.fulfillment}
            />
            <Row label="Part size" value={dimensions} />
            <Row
              label="Machine"
              value={request.machine ? `${request.machine.make} ${request.machine.model}` : null}
            />
            <Row
              label="Budget"
              value={request.budgetCents !== null ? formatMoney(request.budgetCents / 100) : null}
            />
            <Row label="Needed by" value={request.deadline ? formatDate(request.deadline) : null} />
          </dl>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-ink">Material</h4>
          <dl>
            <Row label="Requested" value={filament?.label ?? request.materialType} />
            <Row label="Colour" value={request.materialColor} />
            <Row label="From maker's stock" value={request.material?.name ?? null} />
            {filament ? (
              <>
                <Row
                  label="Typical nozzle temp"
                  value={`${filament.nozzleC[0]}–${filament.nozzleC[1]} °C`}
                />
                <Row
                  label="Typical bed temp"
                  value={`${filament.bedC[0]}–${filament.bedC[1]} °C`}
                />
                <Row
                  label="Enclosure"
                  value={
                    filament.enclosure === "required"
                      ? "Required"
                      : filament.enclosure === "recommended"
                        ? "Recommended"
                        : "Not needed"
                  }
                />
              </>
            ) : null}
          </dl>
        </div>
      </div>

      {specs ? (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-ink">Settings</h4>
          <ProcessSpecs specs={specs} />
        </div>
      ) : null}

      {showFiles && ((request.files?.length ?? 0) > 0 || request.fileUrl) ? (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-ink">Files</h4>
          <ul className="space-y-2">
            {request.files?.map((file) => (
              <li
                key={file.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-muted px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{file.filename}</span>
                <span className="shrink-0 text-xs text-ink-muted">
                  {formatBytes(file.sizeBytes)}
                </span>
                <a
                  href={`/api/uploads/${file.id}`}
                  className="shrink-0 text-sm font-medium text-blueprint-600 hover:underline"
                >
                  Download
                </a>
              </li>
            ))}
            {request.fileUrl ? (
              <li className="rounded-lg border border-line px-3 py-2 text-sm">
                <a
                  href={request.fileUrl}
                  rel="noopener noreferrer nofollow"
                  target="_blank"
                  className="text-blueprint-600 hover:underline"
                >
                  External file link
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {request.quotedPriceCents !== null || request.quotedLeadDays !== null ? (
        <div className="rounded-lg border border-blueprint-100 bg-blueprint-50 p-3">
          <p className="text-sm font-semibold text-blueprint-700">Maker&apos;s quote</p>
          <p className="mt-1 text-sm text-blueprint-700">
            {request.quotedPriceCents !== null
              ? formatMoney(request.quotedPriceCents / 100)
              : "Price to be confirmed"}
            {request.quotedLeadDays !== null
              ? ` · about ${request.quotedLeadDays} day${request.quotedLeadDays === 1 ? "" : "s"}`
              : ""}
          </p>
        </div>
      ) : null}

      {request.declineReason ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-semibold text-red-700">Declined</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-red-700">{request.declineReason}</p>
        </div>
      ) : null}
    </Card>
  );
}
