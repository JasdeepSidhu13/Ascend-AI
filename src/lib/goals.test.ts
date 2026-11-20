import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeGoalTitle, pickCanonicalGoals } from "./goals";

describe("goal identity", () => {
  it("treats punctuation and case as the same title", () => {
    assert.equal(
      normalizeGoalTitle("Sleep 7.5 hours most nights"),
      normalizeGoalTitle("sleep 7.5 hours, most nights!"),
    );
  });

  it("keeps one active goal per metric and per title", () => {
    const keep = pickCanonicalGoals([
      { id: "old-run", title: "Run a half marathon", metricKey: "health.run_km", points: 12, createdAt: "2026-01-01" },
      { id: "new-run", title: "Walk 20 km a week", metricKey: "health.run_km", points: 2, createdAt: "2026-11-20" },
      { id: "sleep-a", title: "Sleep 7.5 hours most nights", metricKey: "health.sleep_hours", points: 3, createdAt: "2026-11-01" },
      { id: "sleep-b", title: "Sleep 7.5 hours most nights", metricKey: "health.sleep_hours", points: 1, createdAt: "2026-11-19" },
      { id: "career", title: "Protect two deep-work mornings", metricKey: "career.score", points: 8, createdAt: "2026-02-01" },
    ]);
    assert.deepEqual(keep.sort(), ["career", "old-run", "sleep-a"].sort());
  });

  it("keeps the older goal when two clones share the same history", () => {
    const keep = pickCanonicalGoals([
      { id: "old-run", title: "Run a half marathon", metricKey: "health.run_km", points: 12, createdAt: "2026-01-01" },
      { id: "new-run", title: "Walk 20 km a week", metricKey: "health.run_km", points: 12, createdAt: "2026-11-20" },
    ]);
    assert.deepEqual(keep, ["old-run"]);
  });

  it("lets resume keep the chosen goal even if a clone has more history", () => {
    const keep = pickCanonicalGoals(
      [
        { id: "old-run", title: "Run a half marathon", metricKey: "health.run_km", points: 12, createdAt: "2026-01-01" },
        { id: "new-run", title: "Walk 20 km a week", metricKey: "health.run_km", points: 2, createdAt: "2026-11-20" },
      ],
      "new-run",
    );
    assert.deepEqual(keep, ["new-run"]);
  });
});
