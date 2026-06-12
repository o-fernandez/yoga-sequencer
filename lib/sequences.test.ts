import { afterEach, describe, expect, it, vi } from "vitest";
import { isTaught, localTodayISO } from "./sequences";

describe("localTodayISO", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("zero-pads single-digit months and days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 5, 12, 0)); // March 5, local noon
    expect(localTodayISO()).toBe("2026-03-05");
  });

  it("stays on the local date late in the evening", () => {
    vi.useFakeTimers();
    // 11pm local — toISOString() would roll to the next UTC day in any
    // timezone west of UTC; the local date must not.
    vi.setSystemTime(new Date(2026, 5, 11, 23, 0));
    expect(localTodayISO()).toBe("2026-06-11");
  });

  it("treats an entry dated today as taught", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 11, 23, 0));
    expect(isTaught({ date: "2026-06-11" })).toBe(true);
    expect(isTaught({ date: "2026-06-12" })).toBe(false);
  });
});
