import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dateInZone, dueForPulseEmail, hourInZone } from "./pulse";

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
});
