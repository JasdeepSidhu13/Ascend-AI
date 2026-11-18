export type Tone = "gentle" | "direct";
export type SessionKind = "pulse" | "weekly" | "monthly" | "audit";
export type QuestionType =
  | "scale"
  | "number"
  | "yes_no"
  | "single"
  | "multi"
  | "time"
  | "text"
  | "rank";
export type FindingType =
  | "trend"
  | "driver"
  | "adherence"
  | "anomaly"
  | "pace"
  | "theme"
  | "win";
export type GoalStatus = "active" | "paused" | "completed" | "dropped";
export type ActionStatus = "active" | "done" | "skipped" | "shrunk" | "paused";
export type PaceStatus = "on_track" | "at_risk" | "off_track";

export type AreaKey =
  | "career"
  | "habits"
  | "health"
  | "mind"
  | "relationships"
  | "finances"
  | "learning";

export type Question = {
  id: string;
  areaId: string;
  areaKey: AreaKey;
  dimension: string;
  prompt: string;
  type: QuestionType;
  options: string[];
  cadence: number;
  metricKey: string | null;
  estSeconds: number;
  version: number;
  source: "curated" | "program" | "user" | "generated";
  unit: string;
};

export type SelectionItem = {
  questionId: string;
  reason: string;
  priority: number;
  followUpOf?: string;
};

export type Finding = {
  id: string;
  type: FindingType;
  metricKeys: string[];
  stats: Record<string, number | string>;
  evidenceIds: string[];
  score: number;
  summary: string;
};

export type InsightDraft = {
  title: string;
  body: string;
  suggestedAction: string;
  confidence: "high" | "medium" | "low";
  findingIds: string[];
};

export type MetricPoint = {
  metricKey: string;
  periodStart: string;
  grain: "day" | "week";
  value: number;
  n: number;
};

export type Profile = {
  id: string;
  email: string;
  displayName: string;
  tz: string;
  tone: Tone;
  values: string[];
  constraints: string;
  pulseHour: number;
  quietStart: number;
  quietEnd: number;
  reminderWeekday: number;
  onboardingCompletedAt: string | null;
  sampleData: boolean;
  simulated: boolean;
};
