import { describe, it, expect, vi, afterEach } from "vitest";
import { buildReferenceCandidate } from "./referenceGenerator";

describe("buildReferenceCandidate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns exactly 5 characters: two uppercase letters + three digits", () => {
    const r = buildReferenceCandidate("calibration");
    expect(r).toHaveLength(5);
    expect(r).toMatch(/^[A-Z]{2}\d{3}$/);
    expect(r.slice(0, 2)).toBe("CA");
  });

  it("uses category prefix for electronics", () => {
    const r = buildReferenceCandidate("electronics");
    expect(r.slice(0, 2)).toBe("EL");
  });

  it("pads short category names with X", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(buildReferenceCandidate("a")).toMatch(/^AX000$/);
  });

  it("draws digits in 000–999 range", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    expect(buildReferenceCandidate("zz")).toMatch(/ZZ999$/);
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(buildReferenceCandidate("zz")).toMatch(/ZZ000$/);
  });
});
