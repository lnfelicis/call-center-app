import { describe, expect, it, vi } from "vitest";
import { systemClock } from "../../../src/shared/contracts.js";

describe("shared contracts", () => {
  it("uses the current time for the system clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T12:34:56.000Z"));

    expect(systemClock.now()).toStrictEqual(new Date("2026-07-13T12:34:56.000Z"));

    vi.useRealTimers();
  });
});
