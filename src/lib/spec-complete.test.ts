import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groundedReply } from "./coach";
import { pausedStreak } from "./streak";
import { PROGRAMS } from "./programs";
import { extractNumbers, numberAllowed, numbersInFindings } from "./validator";
import type { Finding } from "./types";

describe("spec remaining loops", () => {
  it("pauses a streak on one miss and resets on two", () => {
    assert.equal(pausedStreak([1, 1, 1, 0]), 3);
    assert.equal(pausedStreak([1, 1, 1, 0, 0]), 0);
    assert.equal(pausedStreak([1, 1, 0, 1]), 3);
  });

  it("coach replies only with numbers from findings", () => {
    const f: Finding = {
      id: "f1",
      type: "trend",
      metricKeys: ["health.sleep_hours"],
      stats: { delta: 0.8, recent_mean: 7.2, prior_mean: 6.4, recent_weeks: 4 },
      evidenceIds: ["e1"],
      score: 1,
      summary: "Sleep is up 0.8 h versus the previous 4 weeks (7.2 vs 6.4).",
    };
    const reply = groundedReply("why was sleep off?", [f], ["Sleep 7.5 hours"]);
    assert.ok(reply.findingIds.includes("f1"));
    const allowed = numbersInFindings([f]);
    for (const n of extractNumbers(reply.body)) {
      assert.equal(numberAllowed(n, allowed), true, `unexpected ${n} in ${reply.body}`);
    }
  });

  it("ships the three program packs from the spec", () => {
    assert.deepEqual(
      PROGRAMS.map((p) => p.id).sort(),
      ["career-sprint", "half-marathon", "sleep-reset"],
    );
  });
});
