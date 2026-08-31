/**
 * Fabrication process catalog.
 *
 * The numbers here are conventional starting points drawn from slicer defaults
 * and published machine guidance (Prusa/Bambu/Cura profiles, Thunder/Trotec
 * material charts, common MSLA calibration guides). They are presented to users
 * as hints and sensible defaults — the maker always confirms before running a
 * job.
 */

export const PROCESSES = [
  "FDM",
  "RESIN",
  "LASER_CUT",
  "LASER_ENGRAVE",
  "CNC",
  "OTHER",
] as const;
export type Process = (typeof PROCESSES)[number];

export const PROCESS_LABELS: Record<Process, string> = {
  FDM: "FDM 3D printing (filament)",
  RESIN: "Resin 3D printing (SLA/MSLA)",
  LASER_CUT: "Laser cutting",
  LASER_ENGRAVE: "Laser engraving",
  CNC: "CNC machining",
  OTHER: "Something else",
};

export const PROCESS_DESCRIPTIONS: Record<Process, string> = {
  FDM: "Melted filament laid down layer by layer. Best for functional parts, prototypes and larger objects.",
  RESIN: "UV-cured liquid resin. Best for miniatures, jewellery and anything needing very fine detail.",
  LASER_CUT: "Cuts all the way through sheet material.",
  LASER_ENGRAVE: "Marks or etches a surface without cutting through.",
  CNC: "Subtractive machining from solid stock.",
  OTHER: "Describe what you need in your own words.",
};

/** Machine categories that can plausibly serve each process. */
export const PROCESS_MACHINE_CATEGORIES: Record<Process, string[]> = {
  FDM: ["FDM_3D_PRINTER"],
  RESIN: ["RESIN_3D_PRINTER"],
  LASER_CUT: ["LASER_CUTTER"],
  LASER_ENGRAVE: ["LASER_CUTTER", "UV_PRINTER"],
  CNC: ["CNC_ROUTER"],
  OTHER: [],
};

/** File types each process can actually consume. */
export const PROCESS_FILE_EXTENSIONS: Record<Process, string[]> = {
  FDM: [".stl", ".3mf", ".obj", ".step", ".stp", ".gcode", ".zip"],
  RESIN: [".stl", ".3mf", ".obj", ".ctb", ".chitubox", ".zip"],
  LASER_CUT: [".svg", ".dxf", ".ai", ".pdf", ".eps", ".zip"],
  LASER_ENGRAVE: [".svg", ".dxf", ".ai", ".pdf", ".eps", ".png", ".jpg", ".jpeg", ".zip"],
  CNC: [".dxf", ".svg", ".step", ".stp", ".stl", ".nc", ".tap", ".gcode", ".zip"],
  OTHER: [
    ".stl", ".3mf", ".obj", ".step", ".stp", ".svg", ".dxf", ".ai", ".pdf",
    ".png", ".jpg", ".jpeg", ".zip",
  ],
};

/** Every extension the upload endpoint will accept, across all processes. */
export const ALLOWED_UPLOAD_EXTENSIONS = Array.from(
  new Set(Object.values(PROCESS_FILE_EXTENSIONS).flat()),
).sort();

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_FILES_PER_REQUEST = 10;

// ---------------------------------------------------------------------------
// FDM
// ---------------------------------------------------------------------------

export type FilamentSpec = {
  id: string;
  label: string;
  nozzleC: [number, number];
  bedC: [number, number];
  enclosure: "no" | "recommended" | "required";
  notes: string;
};

/** Nozzle and bed ranges follow common manufacturer guidance. */
export const FILAMENTS: FilamentSpec[] = [
  { id: "PLA", label: "PLA", nozzleC: [190, 220], bedC: [50, 60], enclosure: "no", notes: "Easiest to print, crisp detail, but softens in a hot car." },
  { id: "PLA_PLUS", label: "PLA+", nozzleC: [205, 225], bedC: [50, 60], enclosure: "no", notes: "Tougher and less brittle than standard PLA." },
  { id: "PETG", label: "PETG", nozzleC: [220, 250], bedC: [70, 85], enclosure: "no", notes: "Good all-round functional material. Slightly stringy." },
  { id: "ABS", label: "ABS", nozzleC: [220, 250], bedC: [90, 110], enclosure: "required", notes: "Heat resistant and machinable, but warps without an enclosure." },
  { id: "ASA", label: "ASA", nozzleC: [240, 260], bedC: [90, 110], enclosure: "required", notes: "UV-stable ABS alternative — the usual choice for outdoor parts." },
  { id: "TPU", label: "TPU (flexible)", nozzleC: [210, 240], bedC: [40, 60], enclosure: "no", notes: "Rubber-like. Prints slowly and prefers a direct-drive extruder." },
  { id: "NYLON", label: "Nylon (PA)", nozzleC: [240, 270], bedC: [70, 90], enclosure: "recommended", notes: "Very tough and abrasion resistant. Must be dried before printing." },
  { id: "PC", label: "Polycarbonate", nozzleC: [260, 310], bedC: [100, 120], enclosure: "required", notes: "Extremely strong and heat resistant. Demanding to print." },
  { id: "PETG_CF", label: "PETG-CF (carbon fibre)", nozzleC: [230, 260], bedC: [70, 90], enclosure: "recommended", notes: "Stiff with a matte finish. Needs a hardened nozzle." },
  { id: "PLA_WOOD", label: "Wood-fill PLA", nozzleC: [190, 220], bedC: [50, 60], enclosure: "no", notes: "Sandable wood look. Use a 0.5 mm or larger nozzle." },
];

export const NOZZLE_SIZES_MM = [0.2, 0.25, 0.4, 0.6, 0.8, 1.0] as const;
export const LAYER_HEIGHTS_MM = [0.08, 0.12, 0.16, 0.2, 0.24, 0.28, 0.32] as const;

export const INFILL_PATTERNS = [
  "GRID",
  "GYROID",
  "CUBIC",
  "HONEYCOMB",
  "TRIANGLE",
  "RECTILINEAR",
  "CONCENTRIC",
] as const;
export type InfillPattern = (typeof INFILL_PATTERNS)[number];

export const INFILL_PATTERN_LABELS: Record<InfillPattern, string> = {
  GRID: "Grid — fast, general purpose",
  GYROID: "Gyroid — strong in every direction",
  CUBIC: "Cubic — good strength-to-weight",
  HONEYCOMB: "Honeycomb — strong but slower",
  TRIANGLE: "Triangle — rigid",
  RECTILINEAR: "Rectilinear — fastest",
  CONCENTRIC: "Concentric — for flexible parts",
};

export const SUPPORT_TYPES = ["NONE", "NORMAL", "TREE", "SOLUBLE"] as const;
export type SupportType = (typeof SUPPORT_TYPES)[number];

export const SUPPORT_TYPE_LABELS: Record<SupportType, string> = {
  NONE: "None — my model doesn't need them",
  NORMAL: "Normal — straight pillars",
  TREE: "Tree — branching, easier to remove",
  SOLUBLE: "Soluble — dissolves away (needs a dual extruder)",
};

export const BED_ADHESION_TYPES = ["NONE", "SKIRT", "BRIM", "RAFT"] as const;
export type BedAdhesion = (typeof BED_ADHESION_TYPES)[number];

export const BED_ADHESION_LABELS: Record<BedAdhesion, string> = {
  NONE: "None",
  SKIRT: "Skirt",
  BRIM: "Brim — better grip on small footprints",
  RAFT: "Raft — full platform under the part",
};

export type QualityPreset = {
  id: string;
  label: string;
  description: string;
  layerHeightMm: number;
  infillPercent: number;
  wallCount: number;
  topBottomLayers: number;
};

/** Mirrors the Draft/Standard/Quality profiles shipped by common slicers. */
export const FDM_QUALITY_PRESETS: QualityPreset[] = [
  {
    id: "DRAFT",
    label: "Draft",
    description: "Fastest and cheapest. Visible layers — good for test fits.",
    layerHeightMm: 0.28,
    infillPercent: 15,
    wallCount: 2,
    topBottomLayers: 3,
  },
  {
    id: "STANDARD",
    label: "Standard",
    description: "The usual balance of speed, strength and finish.",
    layerHeightMm: 0.2,
    infillPercent: 20,
    wallCount: 3,
    topBottomLayers: 4,
  },
  {
    id: "FINE",
    label: "Fine detail",
    description: "Smoother surfaces for display pieces. Slower.",
    layerHeightMm: 0.12,
    infillPercent: 20,
    wallCount: 3,
    topBottomLayers: 5,
  },
  {
    id: "STRONG",
    label: "Strong / functional",
    description: "Thick walls and dense infill for load-bearing parts.",
    layerHeightMm: 0.2,
    infillPercent: 50,
    wallCount: 5,
    topBottomLayers: 6,
  },
];

/**
 * Layer height should stay at or below roughly 80% of the nozzle diameter, or
 * the extruder cannot reliably push enough plastic to bond layers.
 */
export const MAX_LAYER_HEIGHT_RATIO = 0.8;

export function maxLayerHeightFor(nozzleMm: number) {
  return Math.round(nozzleMm * MAX_LAYER_HEIGHT_RATIO * 100) / 100;
}

// ---------------------------------------------------------------------------
// Resin
// ---------------------------------------------------------------------------

export const RESIN_TYPES = [
  { id: "STANDARD", label: "Standard resin", notes: "General display and prototype work." },
  { id: "TOUGH", label: "Tough / ABS-like resin", notes: "Less brittle, better for parts that flex." },
  { id: "WATER_WASHABLE", label: "Water-washable resin", notes: "Cleans up without isopropyl alcohol." },
  { id: "FLEXIBLE", label: "Flexible resin", notes: "Rubber-like, for gaskets and soft parts." },
  { id: "CASTABLE", label: "Castable resin", notes: "Burns out cleanly for jewellery casting." },
  { id: "DENTAL", label: "Dental / biocompatible", notes: "Certified resins for models and guides." },
] as const;

export const RESIN_LAYER_HEIGHTS_MM = [0.02, 0.03, 0.05, 0.075, 0.1] as const;

/** Typical mono-LCD exposure windows; always confirmed by a calibration print. */
export const RESIN_DEFAULTS = {
  layerHeightMm: 0.05,
  exposureSeconds: 2.5,
  exposureRange: [1.5, 10] as [number, number],
  bottomExposureSeconds: 30,
  bottomExposureRange: [15, 60] as [number, number],
  bottomLayers: 5,
  bottomLayersRange: [3, 10] as [number, number],
  antiAliasing: 4,
  minHollowWallMm: 1.5,
  drainHoleMm: 3,
};

// ---------------------------------------------------------------------------
// Laser
// ---------------------------------------------------------------------------

export const LASER_OPERATIONS = ["CUT", "ENGRAVE", "SCORE", "CUT_AND_ENGRAVE"] as const;
export type LaserOperation = (typeof LASER_OPERATIONS)[number];

export const LASER_OPERATION_LABELS: Record<LaserOperation, string> = {
  CUT: "Cut through",
  ENGRAVE: "Engrave / raster",
  SCORE: "Score — a light surface line",
  CUT_AND_ENGRAVE: "Cut and engrave",
};

export type LaserMaterialSpec = {
  id: string;
  label: string;
  thicknessesMm: number[];
  cutPowerPercent: [number, number];
  cutSpeedMmS: [number, number];
  kerfMm: number;
  airAssist: "on" | "low" | "off";
  notes: string;
  hazard?: string;
};

/**
 * Starting points for a 40-60 W CO2 laser. Power/speed always need a test cut
 * because plywood glue and acrylic batches vary.
 */
export const LASER_MATERIALS: LaserMaterialSpec[] = [
  {
    id: "PLYWOOD",
    label: "Plywood (birch/poplar)",
    thicknessesMm: [3, 4, 6, 9],
    cutPowerPercent: [60, 90],
    cutSpeedMmS: [10, 18],
    kerfMm: 0.2,
    airAssist: "on",
    notes: "Glue lines vary between sheets, so edge colour can differ.",
  },
  {
    id: "MDF",
    label: "MDF",
    thicknessesMm: [3, 6],
    cutPowerPercent: [65, 90],
    cutSpeedMmS: [8, 15],
    kerfMm: 0.22,
    airAssist: "on",
    notes: "Cuts cleanly but leaves darker edges than plywood.",
  },
  {
    id: "ACRYLIC_CAST",
    label: "Cast acrylic",
    thicknessesMm: [3, 5, 6, 10],
    cutPowerPercent: [40, 70],
    cutSpeedMmS: [10, 18],
    kerfMm: 0.15,
    airAssist: "low",
    notes: "Gives a flame-polished edge. Cast engraves white; extruded does not.",
  },
  {
    id: "HARDWOOD",
    label: "Hardwood",
    thicknessesMm: [3, 6, 9],
    cutPowerPercent: [70, 95],
    cutSpeedMmS: [6, 12],
    kerfMm: 0.22,
    airAssist: "on",
    notes: "Denser grain may need a second pass.",
  },
  {
    id: "CARDSTOCK",
    label: "Card / paper",
    thicknessesMm: [0.3, 0.5, 1],
    cutPowerPercent: [10, 25],
    cutSpeedMmS: [40, 90],
    kerfMm: 0.1,
    airAssist: "on",
    notes: "Very fast. Watch for scorching on light colours.",
  },
  {
    id: "LEATHER",
    label: "Veg-tan leather",
    thicknessesMm: [1, 2, 3],
    cutPowerPercent: [30, 60],
    cutSpeedMmS: [15, 30],
    kerfMm: 0.2,
    airAssist: "on",
    notes: "Only vegetable-tanned leather is safe to laser.",
    hazard: "Chrome-tanned leather releases hexavalent chromium and must never be lasered.",
  },
  {
    id: "ANODISED_ALU",
    label: "Anodised aluminium",
    thicknessesMm: [0.5, 1, 1.5],
    cutPowerPercent: [0, 0],
    cutSpeedMmS: [0, 0],
    kerfMm: 0,
    airAssist: "on",
    notes: "Marking only — a CO2 laser cannot cut metal.",
  },
];

/** Materials that must never be lasered, surfaced as a safety warning. */
export const LASER_FORBIDDEN_MATERIALS = [
  { id: "PVC", label: "PVC / vinyl", reason: "Releases chlorine gas, which destroys the machine and is toxic." },
  { id: "POLYCARBONATE", label: "Polycarbonate", reason: "Absorbs the beam, catches fire and yellows badly." },
  { id: "ABS_SHEET", label: "ABS sheet", reason: "Melts rather than cuts and emits cyanide gas." },
  { id: "FIBREGLASS", label: "Fibreglass", reason: "Emits fumes from the epoxy resin binder." },
  { id: "CHROME_LEATHER", label: "Chrome-tanned leather", reason: "Releases hexavalent chromium." },
];

export const LASER_ENGRAVE_DPI = [150, 250, 300, 500, 600, 1000] as const;

// ---------------------------------------------------------------------------
// CNC
// ---------------------------------------------------------------------------

export const CNC_BIT_DIAMETERS_MM = [1, 1.5, 2, 3, 3.175, 4, 6, 6.35, 8, 12] as const;

export const CNC_DEFAULTS = {
  spindleRpm: 16000,
  spindleRpmRange: [8000, 24000] as [number, number],
  feedRateMmMin: 1800,
  feedRateRange: [300, 6000] as [number, number],
  plungeRateMmMin: 600,
  depthPerPassMm: 2,
  stepoverPercent: 40,
};

export const CNC_STOCK_MATERIALS = [
  "Softwood",
  "Hardwood",
  "Plywood",
  "MDF",
  "Acrylic",
  "Aluminium",
  "Brass",
  "Machinable wax",
  "Foam",
] as const;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function filamentById(id: string): FilamentSpec | undefined {
  return FILAMENTS.find((filament) => filament.id === id);
}

export function laserMaterialById(id: string): LaserMaterialSpec | undefined {
  return LASER_MATERIALS.find((material) => material.id === id);
}

export function presetById(id: string): QualityPreset | undefined {
  return FDM_QUALITY_PRESETS.find((preset) => preset.id === id);
}

export type Dimensions = { x: number; y: number; z: number };

/**
 * Parses free-text build volumes such as "256 x 256 x 256 mm" or
 * "600 x 300 mm bed" into numbers so a request can be checked against the
 * machine it is aimed at. Returns null when the text cannot be understood.
 */
export function parseBuildVolume(text: string | null | undefined): Dimensions | null {
  if (!text) return null;
  const matches = text.match(/(\d+(?:\.\d+)?)/g);
  if (!matches || matches.length < 2) return null;

  const [x, y, z] = matches.map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y, z: Number.isFinite(z) ? z : 0 };
}

/**
 * Checks whether a part fits a build volume, allowing the part to be rotated
 * on the bed. Z is only compared when the machine reports a height.
 */
export function fitsInBuildVolume(part: Dimensions, volume: Dimensions): boolean {
  const partFootprint = [part.x, part.y].sort((a, b) => a - b);
  const volumeFootprint = [volume.x, volume.y].sort((a, b) => a - b);

  const footprintFits =
    partFootprint[0] <= volumeFootprint[0] && partFootprint[1] <= volumeFootprint[1];
  const heightFits = volume.z <= 0 || part.z <= volume.z;

  return footprintFits && heightFits;
}

export function formatDimensions(dimensions: Dimensions): string {
  const parts = [dimensions.x, dimensions.y];
  if (dimensions.z > 0) parts.push(dimensions.z);
  return `${parts.join(" × ")} mm`;
}
