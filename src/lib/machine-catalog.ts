import type { MachineCategory } from "./constants";

export type CatalogEntry = {
  make: string;
  model: string;
  category: MachineCategory;
  buildVolume?: string;
};

/**
 * Curated list of commonly owned machines used to populate the "pick your
 * machine" dropdown. Anything missing can still be entered as a custom machine.
 */
export const MACHINE_CATALOG: CatalogEntry[] = [
  // FDM 3D printers
  { make: "Bambu Lab", model: "X1 Carbon", category: "FDM_3D_PRINTER", buildVolume: "256 x 256 x 256 mm" },
  { make: "Bambu Lab", model: "P1S", category: "FDM_3D_PRINTER", buildVolume: "256 x 256 x 256 mm" },
  { make: "Bambu Lab", model: "P1P", category: "FDM_3D_PRINTER", buildVolume: "256 x 256 x 256 mm" },
  { make: "Bambu Lab", model: "A1", category: "FDM_3D_PRINTER", buildVolume: "256 x 256 x 256 mm" },
  { make: "Bambu Lab", model: "A1 mini", category: "FDM_3D_PRINTER", buildVolume: "180 x 180 x 180 mm" },
  { make: "Bambu Lab", model: "H2D", category: "FDM_3D_PRINTER", buildVolume: "350 x 320 x 325 mm" },
  { make: "Prusa Research", model: "MK4S", category: "FDM_3D_PRINTER", buildVolume: "250 x 210 x 220 mm" },
  { make: "Prusa Research", model: "MK3S+", category: "FDM_3D_PRINTER", buildVolume: "250 x 210 x 210 mm" },
  { make: "Prusa Research", model: "CORE One", category: "FDM_3D_PRINTER", buildVolume: "250 x 220 x 270 mm" },
  { make: "Prusa Research", model: "XL", category: "FDM_3D_PRINTER", buildVolume: "360 x 360 x 360 mm" },
  { make: "Prusa Research", model: "MINI+", category: "FDM_3D_PRINTER", buildVolume: "180 x 180 x 180 mm" },
  { make: "Creality", model: "Ender 3 V3 SE", category: "FDM_3D_PRINTER", buildVolume: "220 x 220 x 250 mm" },
  { make: "Creality", model: "Ender 3 S1 Pro", category: "FDM_3D_PRINTER", buildVolume: "220 x 220 x 270 mm" },
  { make: "Creality", model: "K1 Max", category: "FDM_3D_PRINTER", buildVolume: "300 x 300 x 300 mm" },
  { make: "Creality", model: "CR-10 Smart Pro", category: "FDM_3D_PRINTER", buildVolume: "300 x 300 x 400 mm" },
  { make: "Elegoo", model: "Neptune 4 Pro", category: "FDM_3D_PRINTER", buildVolume: "225 x 225 x 265 mm" },
  { make: "Elegoo", model: "Centauri Carbon", category: "FDM_3D_PRINTER", buildVolume: "256 x 256 x 256 mm" },
  { make: "Anycubic", model: "Kobra 3", category: "FDM_3D_PRINTER", buildVolume: "250 x 250 x 260 mm" },
  { make: "Ultimaker", model: "S5", category: "FDM_3D_PRINTER", buildVolume: "330 x 240 x 300 mm" },
  { make: "Ultimaker", model: "S3", category: "FDM_3D_PRINTER", buildVolume: "230 x 190 x 200 mm" },
  { make: "MakerBot", model: "Method X", category: "FDM_3D_PRINTER", buildVolume: "190 x 190 x 196 mm" },
  { make: "Raise3D", model: "Pro3", category: "FDM_3D_PRINTER", buildVolume: "300 x 300 x 300 mm" },
  { make: "LulzBot", model: "TAZ Workhorse", category: "FDM_3D_PRINTER", buildVolume: "280 x 280 x 285 mm" },
  { make: "Voron", model: "2.4 (self-built)", category: "FDM_3D_PRINTER", buildVolume: "350 x 350 x 350 mm" },

  // Resin 3D printers
  { make: "Elegoo", model: "Saturn 4 Ultra", category: "RESIN_3D_PRINTER", buildVolume: "218 x 123 x 220 mm" },
  { make: "Elegoo", model: "Mars 5 Ultra", category: "RESIN_3D_PRINTER", buildVolume: "153 x 77 x 165 mm" },
  { make: "Anycubic", model: "Photon Mono M5s", category: "RESIN_3D_PRINTER", buildVolume: "218 x 123 x 200 mm" },
  { make: "Phrozen", model: "Sonic Mighty 8K", category: "RESIN_3D_PRINTER", buildVolume: "218 x 123 x 235 mm" },
  { make: "Formlabs", model: "Form 4", category: "RESIN_3D_PRINTER", buildVolume: "200 x 125 x 210 mm" },
  { make: "Formlabs", model: "Form 3+", category: "RESIN_3D_PRINTER", buildVolume: "145 x 145 x 185 mm" },

  // Laser cutters
  { make: "Glowforge", model: "Pro", category: "LASER_CUTTER", buildVolume: "515 x 279 mm bed" },
  { make: "Glowforge", model: "Plus", category: "LASER_CUTTER", buildVolume: "495 x 279 mm bed" },
  { make: "Glowforge", model: "Aura", category: "LASER_CUTTER", buildVolume: "304 x 292 mm bed" },
  { make: "Epilog", model: "Fusion Pro 36", category: "LASER_CUTTER", buildVolume: "914 x 610 mm bed" },
  { make: "Epilog", model: "Zing 24", category: "LASER_CUTTER", buildVolume: "610 x 305 mm bed" },
  { make: "Trotec", model: "Speedy 400", category: "LASER_CUTTER", buildVolume: "1000 x 610 mm bed" },
  { make: "Universal Laser Systems", model: "VLS4.60", category: "LASER_CUTTER", buildVolume: "610 x 305 mm bed" },
  { make: "xTool", model: "P2S", category: "LASER_CUTTER", buildVolume: "600 x 308 mm bed" },
  { make: "xTool", model: "S1", category: "LASER_CUTTER", buildVolume: "498 x 319 mm bed" },
  { make: "xTool", model: "F1 Ultra", category: "LASER_CUTTER", buildVolume: "220 x 220 mm bed" },
  { make: "OMTech", model: "Polar 350", category: "LASER_CUTTER", buildVolume: "500 x 300 mm bed" },
  { make: "Boss Laser", model: "LS-1416", category: "LASER_CUTTER", buildVolume: "356 x 406 mm bed" },
  { make: "Thunder Laser", model: "Nova 35", category: "LASER_CUTTER", buildVolume: "900 x 600 mm bed" },

  // CNC
  { make: "Shapeoko", model: "4 XXL", category: "CNC_ROUTER", buildVolume: "838 x 838 x 101 mm" },
  { make: "Carbide 3D", model: "Nomad 3", category: "CNC_ROUTER", buildVolume: "203 x 203 x 76 mm" },
  { make: "Onefinity", model: "Woodworker X-50", category: "CNC_ROUTER", buildVolume: "812 x 812 x 133 mm" },
  { make: "Inventables", model: "X-Carve", category: "CNC_ROUTER", buildVolume: "750 x 750 x 65 mm" },
  { make: "Axiom", model: "Iconic 8", category: "CNC_ROUTER", buildVolume: "610 x 813 x 152 mm" },
  { make: "Tormach", model: "1100MX", category: "CNC_ROUTER", buildVolume: "864 x 483 x 419 mm" },
  { make: "Bantam Tools", model: "Desktop CNC", category: "CNC_ROUTER", buildVolume: "228 x 152 x 40 mm" },

  // Vinyl / textiles / other
  { make: "Cricut", model: "Maker 3", category: "VINYL_CUTTER", buildVolume: "300 mm width" },
  { make: "Cricut", model: "Explore 3", category: "VINYL_CUTTER", buildVolume: "300 mm width" },
  { make: "Silhouette", model: "Cameo 5", category: "VINYL_CUTTER", buildVolume: "305 mm width" },
  { make: "Roland", model: "GS-24", category: "VINYL_CUTTER", buildVolume: "584 mm width" },
  { make: "Brother", model: "PE800", category: "EMBROIDERY_MACHINE", buildVolume: "127 x 178 mm hoop" },
  { make: "Brother", model: "SE700", category: "EMBROIDERY_MACHINE", buildVolume: "101 x 101 mm hoop" },
  { make: "Janome", model: "MB-7", category: "EMBROIDERY_MACHINE", buildVolume: "230 x 200 mm hoop" },
  { make: "Juki", model: "TL-2010Q", category: "SEWING_MACHINE" },
  { make: "Roland", model: "VersaUV LEF2-200", category: "UV_PRINTER", buildVolume: "508 x 330 x 100 mm" },
];

export const MACHINE_MAKES = Array.from(
  new Set(MACHINE_CATALOG.map((entry) => entry.make)),
).sort();

export function catalogForCategory(category: MachineCategory): CatalogEntry[] {
  return MACHINE_CATALOG.filter((entry) => entry.category === category);
}

export function findCatalogEntry(make: string, model: string): CatalogEntry | undefined {
  return MACHINE_CATALOG.find(
    (entry) =>
      entry.make.toLowerCase() === make.trim().toLowerCase() &&
      entry.model.toLowerCase() === model.trim().toLowerCase(),
  );
}

/** Common material presets offered when adding inventory. */
export const MATERIAL_PRESETS = [
  { category: "FILAMENT", name: "PLA", unit: "KG", specs: "1.75 mm, 190-220 C nozzle" },
  { category: "FILAMENT", name: "PLA+", unit: "KG", specs: "1.75 mm, 205-225 C nozzle" },
  { category: "FILAMENT", name: "PETG", unit: "KG", specs: "1.75 mm, 230-250 C nozzle" },
  { category: "FILAMENT", name: "ABS", unit: "KG", specs: "1.75 mm, enclosure recommended" },
  { category: "FILAMENT", name: "ASA", unit: "KG", specs: "1.75 mm, UV stable" },
  { category: "FILAMENT", name: "TPU 95A", unit: "KG", specs: "1.75 mm, flexible" },
  { category: "FILAMENT", name: "Nylon (PA)", unit: "KG", specs: "1.75 mm, dry before use" },
  { category: "FILAMENT", name: "PC (Polycarbonate)", unit: "KG", specs: "1.75 mm, high temp" },
  { category: "FILAMENT", name: "Carbon fibre PETG-CF", unit: "KG", specs: "1.75 mm, hardened nozzle required" },
  { category: "RESIN", name: "Standard photopolymer resin", unit: "LITER", specs: "405 nm" },
  { category: "RESIN", name: "Tough / ABS-like resin", unit: "LITER", specs: "405 nm" },
  { category: "RESIN", name: "Water-washable resin", unit: "LITER", specs: "405 nm" },
  { category: "SHEET_WOOD", name: "Baltic birch plywood", unit: "SHEET", specs: "3 mm, 600 x 300 mm" },
  { category: "SHEET_WOOD", name: "MDF", unit: "SHEET", specs: "3 mm, 600 x 300 mm" },
  { category: "SHEET_WOOD", name: "Hardwood (maple)", unit: "SHEET", specs: "6 mm" },
  { category: "SHEET_ACRYLIC", name: "Cast acrylic (clear)", unit: "SHEET", specs: "3 mm, 600 x 300 mm" },
  { category: "SHEET_ACRYLIC", name: "Cast acrylic (coloured)", unit: "SHEET", specs: "3 mm" },
  { category: "SHEET_METAL", name: "Anodised aluminium", unit: "SHEET", specs: "1 mm, engrave only" },
  { category: "FABRIC", name: "Cotton canvas", unit: "METER", specs: "10 oz" },
  { category: "FABRIC", name: "Felt", unit: "SHEET", specs: "3 mm wool blend" },
  { category: "VINYL", name: "Permanent adhesive vinyl", unit: "METER", specs: "300 mm roll" },
  { category: "VINYL", name: "Heat transfer vinyl (HTV)", unit: "METER", specs: "300 mm roll" },
  { category: "PAPER_CARD", name: "Cardstock", unit: "SHEET", specs: "216 gsm" },
] as const;
