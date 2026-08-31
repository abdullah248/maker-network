import { describe, expect, it } from "vitest";

import {
  fitsInBuildVolume,
  maxLayerHeightFor,
  parseBuildVolume,
  formatDimensions,
  FDM_QUALITY_PRESETS,
  FILAMENTS,
  LASER_MATERIALS,
  PROCESS_FILE_EXTENSIONS,
  ALLOWED_UPLOAD_EXTENSIONS,
  filamentById,
  laserMaterialById,
  presetById,
} from "@/lib/print-specs";
import { fdmSpecSchema, laserSpecSchema, resinSpecSchema, specsSchema } from "@/lib/validation";
import { sanitizeFilename, extensionOf } from "@/lib/services/uploads";
import { formatBytes } from "@/lib/format";

describe("build volume parsing", () => {
  it.each([
    ["256 x 256 x 256 mm", { x: 256, y: 256, z: 256 }],
    ["250 x 210 x 220 mm", { x: 250, y: 210, z: 220 }],
    ["914 x 610 mm bed", { x: 914, y: 610, z: 0 }],
    ["127 x 178 mm hoop", { x: 127, y: 178, z: 0 }],
  ])("parses %s", (input, expected) => {
    expect(parseBuildVolume(input)).toEqual(expected);
  });

  it("returns null for unparseable text", () => {
    expect(parseBuildVolume("large format")).toBeNull();
    expect(parseBuildVolume("")).toBeNull();
    expect(parseBuildVolume(null)).toBeNull();
    expect(parseBuildVolume("300 mm")).toBeNull();
  });
});

describe("fitsInBuildVolume", () => {
  const bambu = { x: 256, y: 256, z: 256 };

  it("accepts a part that clearly fits", () => {
    expect(fitsInBuildVolume({ x: 100, y: 80, z: 40 }, bambu)).toBe(true);
  });

  it("accepts a part that fits exactly", () => {
    expect(fitsInBuildVolume({ x: 256, y: 256, z: 256 }, bambu)).toBe(true);
  });

  it("rejects a part that is too tall", () => {
    expect(fitsInBuildVolume({ x: 100, y: 100, z: 300 }, bambu)).toBe(false);
  });

  it("rejects a part that is too wide", () => {
    expect(fitsInBuildVolume({ x: 400, y: 100, z: 100 }, bambu)).toBe(false);
  });

  it("allows rotating the part on the bed", () => {
    const prusa = { x: 250, y: 210, z: 220 };
    // 240 x 200 does not fit as given but does when rotated.
    expect(fitsInBuildVolume({ x: 200, y: 240, z: 50 }, prusa)).toBe(true);
  });

  it("ignores height when the machine reports none (a laser bed)", () => {
    const bed = { x: 600, y: 300, z: 0 };
    expect(fitsInBuildVolume({ x: 500, y: 200, z: 999 }, bed)).toBe(true);
  });
});

describe("maxLayerHeightFor", () => {
  it.each([
    [0.4, 0.32],
    [0.6, 0.48],
    [0.2, 0.16],
    [0.8, 0.64],
  ])("caps a %s mm nozzle at %s mm", (nozzle, expected) => {
    expect(maxLayerHeightFor(nozzle)).toBe(expected);
  });
});

describe("formatDimensions", () => {
  it("includes height when present", () => {
    expect(formatDimensions({ x: 10, y: 20, z: 30 })).toBe("10 × 20 × 30 mm");
  });

  it("omits a zero height", () => {
    expect(formatDimensions({ x: 10, y: 20, z: 0 })).toBe("10 × 20 mm");
  });
});

describe("catalog integrity", () => {
  it("gives every filament a sane temperature window", () => {
    for (const filament of FILAMENTS) {
      expect(filament.nozzleC[0]).toBeLessThan(filament.nozzleC[1]);
      expect(filament.bedC[0]).toBeLessThanOrEqual(filament.bedC[1]);
      expect(filament.nozzleC[0]).toBeGreaterThan(150);
      expect(filament.nozzleC[1]).toBeLessThan(400);
    }
  });

  it("keeps every quality preset within the 0.4 mm nozzle limit", () => {
    for (const preset of FDM_QUALITY_PRESETS) {
      expect(preset.layerHeightMm).toBeLessThanOrEqual(maxLayerHeightFor(0.4));
      expect(preset.infillPercent).toBeGreaterThanOrEqual(0);
      expect(preset.wallCount).toBeGreaterThanOrEqual(2);
    }
  });

  it("gives laser materials ordered power and speed ranges", () => {
    for (const material of LASER_MATERIALS) {
      expect(material.cutPowerPercent[0]).toBeLessThanOrEqual(material.cutPowerPercent[1]);
      expect(material.cutSpeedMmS[0]).toBeLessThanOrEqual(material.cutSpeedMmS[1]);
      expect(material.thicknessesMm.length).toBeGreaterThan(0);
    }
  });

  it("only allows upload extensions that some process can consume", () => {
    const fromProcesses = new Set(Object.values(PROCESS_FILE_EXTENSIONS).flat());
    for (const extension of ALLOWED_UPLOAD_EXTENSIONS) {
      expect(fromProcesses.has(extension)).toBe(true);
    }
  });

  it("offers 3D formats for printing and vector formats for lasers", () => {
    expect(PROCESS_FILE_EXTENSIONS.FDM).toContain(".stl");
    expect(PROCESS_FILE_EXTENSIONS.FDM).toContain(".3mf");
    expect(PROCESS_FILE_EXTENSIONS.LASER_CUT).toContain(".svg");
    expect(PROCESS_FILE_EXTENSIONS.LASER_CUT).toContain(".dxf");
    expect(PROCESS_FILE_EXTENSIONS.LASER_CUT).not.toContain(".stl");
  });

  it("looks entries up by id", () => {
    expect(filamentById("PETG")?.label).toBe("PETG");
    expect(filamentById("UNOBTAINIUM")).toBeUndefined();
    expect(laserMaterialById("PLYWOOD")?.kerfMm).toBeGreaterThan(0);
    expect(presetById("STANDARD")?.layerHeightMm).toBe(0.2);
  });
});

describe("fdmSpecSchema", () => {
  const valid = (overrides: Record<string, unknown> = {}) => ({
    process: "FDM",
    layerHeightMm: 0.2,
    nozzleMm: 0.4,
    infillPercent: 20,
    infillPattern: "GRID",
    wallCount: 3,
    topBottomLayers: 4,
    supportType: "NONE",
    bedAdhesion: "SKIRT",
    ...overrides,
  });

  it("accepts a standard profile", () => {
    expect(fdmSpecSchema.safeParse(valid()).success).toBe(true);
  });

  it("rejects a layer height above 80% of the nozzle", () => {
    const result = fdmSpecSchema.safeParse(valid({ layerHeightMm: 0.36, nozzleMm: 0.4 }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toMatch(/80%/);
    }
  });

  it("accepts a tall layer on a wider nozzle", () => {
    expect(fdmSpecSchema.safeParse(valid({ layerHeightMm: 0.36, nozzleMm: 0.6 })).success).toBe(
      true,
    );
  });

  it("rejects impossible infill", () => {
    expect(fdmSpecSchema.safeParse(valid({ infillPercent: 150 })).success).toBe(false);
    expect(fdmSpecSchema.safeParse(valid({ infillPercent: -5 })).success).toBe(false);
  });

  it("rejects zero walls", () => {
    expect(fdmSpecSchema.safeParse(valid({ wallCount: 0 })).success).toBe(false);
  });

  it("rejects an unknown infill pattern", () => {
    expect(fdmSpecSchema.safeParse(valid({ infillPattern: "SPAGHETTI" })).success).toBe(false);
  });

  it("rejects unknown extra keys", () => {
    expect(fdmSpecSchema.safeParse(valid({ secretFlag: true })).success).toBe(false);
  });

  it("coerces numeric strings from the form", () => {
    const parsed = fdmSpecSchema.parse(valid({ layerHeightMm: "0.16", wallCount: "4" }));
    expect(parsed.layerHeightMm).toBe(0.16);
    expect(parsed.wallCount).toBe(4);
  });
});

describe("resinSpecSchema", () => {
  const valid = (overrides: Record<string, unknown> = {}) => ({
    process: "RESIN",
    layerHeightMm: 0.05,
    ...overrides,
  });

  it("accepts a typical MSLA profile", () => {
    expect(
      resinSpecSchema.safeParse(
        valid({ exposureSeconds: 2.5, bottomExposureSeconds: 30, bottomLayers: 5 }),
      ).success,
    ).toBe(true);
  });

  it("rejects a layer height outside the resin range", () => {
    expect(resinSpecSchema.safeParse(valid({ layerHeightMm: 0.3 })).success).toBe(false);
  });

  it("requires a real wall when hollowing", () => {
    expect(
      resinSpecSchema.safeParse(valid({ hollow: true, hollowWallMm: 0.2 })).success,
    ).toBe(false);
    expect(resinSpecSchema.safeParse(valid({ hollow: true, hollowWallMm: 2 })).success).toBe(true);
  });
});

describe("laserSpecSchema", () => {
  const valid = (overrides: Record<string, unknown> = {}) => ({
    process: "LASER_CUT",
    operation: "CUT",
    materialThicknessMm: 3,
    passes: 1,
    ...overrides,
  });

  it("accepts a plywood cut", () => {
    expect(
      laserSpecSchema.safeParse(valid({ powerPercent: 80, speedMmS: 15, airAssist: true })).success,
    ).toBe(true);
  });

  it("rejects power above 100%", () => {
    expect(laserSpecSchema.safeParse(valid({ powerPercent: 150 })).success).toBe(false);
  });

  it("rejects an unreasonable pass count", () => {
    expect(laserSpecSchema.safeParse(valid({ passes: 99 })).success).toBe(false);
  });

  it("rejects an unknown operation", () => {
    expect(laserSpecSchema.safeParse(valid({ operation: "VAPORISE" })).success).toBe(false);
  });
});

describe("specsSchema discriminated union", () => {
  it("routes on the process field", () => {
    const fdm = specsSchema.safeParse({
      process: "FDM",
      layerHeightMm: 0.2,
      nozzleMm: 0.4,
      infillPercent: 20,
      wallCount: 3,
      topBottomLayers: 4,
    });
    expect(fdm.success).toBe(true);
  });

  it("rejects an unknown process", () => {
    expect(specsSchema.safeParse({ process: "SINTERING" }).success).toBe(false);
  });

  it("rejects laser fields on an FDM spec", () => {
    expect(
      specsSchema.safeParse({
        process: "FDM",
        layerHeightMm: 0.2,
        nozzleMm: 0.4,
        infillPercent: 20,
        wallCount: 3,
        topBottomLayers: 4,
        powerPercent: 80,
      }).success,
    ).toBe(false);
  });
});

describe("upload filename handling", () => {
  it.each([
    // Only the final path segment survives, so traversal cannot leak through.
    ["../../etc/passwd", "passwd"],
    ["..\\..\\windows\\system32", "system32"],
    ["/absolute/path/model.stl", "model.stl"],
    ["normal-model.stl", "normal-model.stl"],
    ["my model (v2).3mf", "my model _v2_.3mf"],
  ])("sanitises %s", (input, expected) => {
    expect(sanitizeFilename(input)).toBe(expected);
  });

  it("strips control characters", () => {
    expect(sanitizeFilename("mo\u0000del.stl")).toBe("model.stl");
  });

  it("never returns an empty name", () => {
    expect(sanitizeFilename("")).toBe("file");
    expect(sanitizeFilename("...")).toBe("file");
  });

  it("caps the length", () => {
    expect(sanitizeFilename(`${"a".repeat(500)}.stl`).length).toBeLessThanOrEqual(120);
  });

  it("extracts extensions case-insensitively", () => {
    expect(extensionOf("Model.STL")).toBe(".stl");
    expect(extensionOf("archive.tar.gz")).toBe(".gz");
    expect(extensionOf("noextension")).toBe("");
  });

  it("formats byte sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
