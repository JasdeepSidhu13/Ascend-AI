import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeFindings, earlyDailyFindings, paceStatus, rankTop, type Series } from "./findings";
import { narrateFinding } from "./narrate";
import { extractNumbers, numberAllowed, numbersInFindings, validateInsight } from "./validator";
import { selectQuestions } from "./selector";
import { shrinkText } from "./actions";
import { detectCrisis } from "./crisis";
import { candidateFacts } from "./memory";

function weekSeries(key: string, values: number[], start = "2026-08-31"): Series {
  const origin = new Date(start + "T00:00:00Z");
  return {
    key,
    grain: "week",
    points: values.map((value, i) => {
      const d = new Date(origin);
      d.setUTCDate(d.getUTCDate() + i * 7);
      return {
        metricKey: key,
        periodStart: d.toISOString().slice(0, 10),
        grain: "week" as const,
        value,
        n: 1,
      };
    }),
  };
}

function daySeries(key: string, values: number[]): Series {
  const origin = new Date("2026-11-04T00:00:00Z");
  return {
    key,
    grain: "day",
    points: values.map((value, i) => {
      const d = new Date(origin);
      d.setUTCDate(d.getUTCDate() + i);
      return {
        metricKey: key,
        periodStart: d.toISOString().slice(0, 10),
        grain: "day" as const,
        value,
        n: 1,
      };
    }),
  };
}

describe("insight engine", () => {
  it("surfaces a planted sleep trend", () => {
    const sleep = weekSeries("health.sleep_hours", [
      6.1, 6.0, 6.2, 6.1, 6.2, 6.3, 6.1, 6.2, 7.0, 7.1, 7.2, 7.0,
    ]);
    const findings = computeFindings({
      series: [sleep],
      paces: [],
      themes: [],
      wins: [],
      goalMetrics: [],
      recentInsightKeys: [],
    });
    const trend = findings.find((f) => f.type === "trend" && f.metricKeys[0] === "health.sleep_hours");
    assert.ok(trend);
    assert.ok(Number(trend.stats.delta) > 0.7);
  });

  it("surfaces a planted mood–workout association", () => {
    const workouts = weekSeries("health.workouts", [1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3]);
    const mood = weekSeries("mind.mood", [5.1, 5.0, 5.2, 5.3, 6.8, 6.9, 7.0, 7.1, 7.2, 7.0, 7.3, 7.2]);
    const findings = computeFindings({
      series: [mood, workouts],
      paces: [],
      themes: [],
      wins: [],
      goalMetrics: ["health.run_km"],
      recentInsightKeys: [],
    });
    const driver = findings.find((f) => f.type === "driver");
    assert.ok(driver);
    assert.ok(Math.abs(Number(driver.stats.r)) >= 0.4);
  });

  it("flags meditation collapse and reading hold", () => {
    const reading = daySeries("habits.reading", Array.from({ length: 14 }, (_, i) => (i === 6 || i === 13 ? 0 : 1)));
    const meditation = daySeries("habits.meditation", Array.from({ length: 14 }, (_, i) => ([2, 8, 11].includes(i) ? 1 : 0)));
    const findings = computeFindings({
      series: [reading, meditation],
      paces: [],
      themes: [],
      wins: [],
      goalMetrics: [],
      recentInsightKeys: [],
    });
    const adh = findings.filter((f) => f.type === "adherence");
    const med = adh.find((f) => f.metricKeys[0] === "habits.meditation");
    const read = adh.find((f) => f.metricKeys[0] === "habits.reading");
    assert.equal(Number(med?.stats.done), 3);
    assert.equal(Number(read?.stats.done), 12);
  });

  it("projects an at-risk key result", () => {
    assert.equal(paceStatus(35, 40, 15), "at_risk");
    assert.equal(paceStatus(38, 40, 15), "on_track");
    assert.equal(paceStatus(20, 40, 15), "off_track");
  });

  it("ranks a small set and narrates only evidenced numbers", () => {
    const energy = weekSeries("health.energy", [6, 6.2, 6.1, 6.3, 6.4, 3.2, 6.5, 6.6, 6.4, 6.7, 6.8, 3.1]);
    const findings = computeFindings({
      series: [energy],
      paces: [],
      themes: [{ tag: "meetings", count: 5, window: 6 }],
      wins: [{ kind: "streak", metricKey: "habits.deep_work", value: 9, label: "Longest deep-work streak so far: 9 days" }],
      goalMetrics: [],
      recentInsightKeys: [],
    });
    const top = rankTop(findings, 5);
    assert.ok(top.length >= 1);
    const draft = narrateFinding(top[0], "gentle");
    const v = validateInsight(draft, [top[0]], []);
    assert.equal(v.ok, true, v.reason);
    const invented = { ...draft, body: draft.body + " You lost 12 kg." };
    assert.equal(validateInsight(invented, [top[0]], []).ok, false);
  });
});

describe("early daily findings", () => {
  it("offers a low-confidence sentence after 3 daily points", () => {
    const sleep = daySeries("health.sleep_hours", [6.2, 6.4, 6.8]);
    const findings = earlyDailyFindings(
      [sleep],
      ["health.sleep_hours"],
      [
        {
          krId: "kr1",
          goalTitle: "Sleep 7.5 hours",
          metricKey: "health.sleep_hours",
          baseline: 6,
          target: 7.5,
          unit: "h",
          dueOn: "2026-12-04",
          values: [],
          dates: [],
        },
      ],
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].stats.early, 1);
    assert.equal(findings[0].stats.n, 3);
    const draft = narrateFinding(findings[0], "gentle");
    assert.equal(draft.confidence, "low");
    assert.equal(validateInsight(draft, [findings[0]], []).ok, true);
  });

  it("stops early findings once 6 daily points exist", () => {
    const sleep = daySeries("health.sleep_hours", [6, 6.1, 6.2, 6.3, 6.4, 6.5]);
    assert.equal(earlyDailyFindings([sleep], []).length, 0);
  });
});

describe("validator", () => {
  it("extracts numbers and matches findings", () => {
    const nums = extractNumbers("Sleep up 0.8 h since 7.4 vs 6.6");
    assert.deepEqual(nums, [0.8, 7.4, 6.6]);
    assert.ok(numberAllowed(0.8, numbersInFindings([{ id: "1", type: "trend", metricKeys: [], stats: { delta: 0.8 }, evidenceIds: [], score: 1, summary: "" }])));
  });
});

describe("selector", () => {
  it("keeps a pulse inside the time budget", () => {
    const picked = selectQuestions({
      kind: "pulse",
      now: new Date("2026-11-18T08:00:00Z"),
      lastAsked: {},
      identicalStreak: {},
      skipCount: {},
      seriesCounts: {},
      fallingMetrics: ["health.energy"],
      volatileMetrics: [],
      goalMetrics: ["health.run_km"],
      activeAction: true,
    });
    assert.ok(picked.length >= 3 && picked.length <= 5);
    const seconds = picked.reduce((a, s) => {
      const q = { q_action_followup: 10 } as Record<string, number>;
      return a + (q[s.questionId] ?? 10);
    }, 0);
    assert.ok(seconds <= 70);
  });
});

describe("actions and safety", () => {
  it("shrinks quantity instead of repeating", () => {
    assert.equal(shrinkText("Run 3 times this week, 25 min each"), "Run 2 times this week, 15 min each");
    assert.equal(
      shrinkText("When I close my laptop, I will walk for 20 minutes"),
      "When I close my laptop, I will walk for 12 minutes",
    );
  });
  it("routes crisis language away from coaching", () => {
    assert.equal(detectCrisis(["I want to die"]), true);
    assert.equal(detectCrisis(["tired after meetings"]), false);
  });
  it("only extracts facts the user stated", () => {
    const facts = candidateFacts("I train best before 7 am. The model thinks I am burnt out.");
    assert.ok(facts.some((f) => /train best/i.test(f)));
    assert.ok(!facts.some((f) => /burnt out/i.test(f) && !/model thinks/i.test(f)));
  });
});
