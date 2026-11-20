import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appOrigin, dateInZone, dueForPulseEmail, hourInZone, safeOrigin } from "./pulse";

const noonUtc = new Date("2026-11-20T12:00:00Z");

describe("pulse timing", () => {
  it("reads the local hour in a named zone", () => {
    assert.equal(hourInZone(noonUtc, "America/New_York"), 7);
    assert.equal(dateInZone(noonUtc, "America/New_York"), "2026-11-20");
  });

  it("is due only at pulse hour, once, if not already done", () => {
    const base = {
      pulseHour: 7,
      tz: "America/New_York",
      emailPulse: true,
      lastPulseEmailOn: null as string | null,
      alreadyPulsedToday: false,
    };
    assert.equal(dueForPulseEmail(base, noonUtc), true);
    assert.equal(dueForPulseEmail({ ...base, emailPulse: false }, noonUtc), false);
    assert.equal(dueForPulseEmail({ ...base, pulseHour: 8 }, noonUtc), false);
    assert.equal(dueForPulseEmail({ ...base, alreadyPulsedToday: true }, noonUtc), false);
    assert.equal(dueForPulseEmail({ ...base, lastPulseEmailOn: "2026-11-20" }, noonUtc), false);
  });

  it("requires a configured https origin and has no host fallback", () => {
    const prev = process.env.APP_ORIGIN;
    delete process.env.APP_ORIGIN;
    assert.equal(appOrigin(), null);
    process.env.APP_ORIGIN = "https://example.test/app/";
    assert.equal(appOrigin(), "https://example.test");
    process.env.APP_ORIGIN = "http://evil.test";
    assert.equal(appOrigin(), null);
    if (prev == null) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = prev;
    assert.equal(safeOrigin("javascript:alert(1)"), null);
    assert.equal(safeOrigin("https://example.test"), "https://example.test");
  });
});
