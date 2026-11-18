import { requireIdentity, getIdentity } from "../../cursor/identity.js";
import { sql } from "./db";
import type { Profile, Tone } from "./types";
import { readJson } from "./db";

const PRIVATE = { "cache-control": "private, no-store" };

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: PRIVATE });
}

export async function requireViewer(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) {
    identity.headers.set("cache-control", "private, no-store");
    return identity;
  }
  return identity;
}

export async function optionalViewer(request: Request) {
  return getIdentity(request);
}

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  tz: string;
  tone: Tone;
  values_json: unknown;
  constraints_text: string;
  pulse_hour: number;
  quiet_start: number;
  quiet_end: number;
  reminder_weekday: number;
  onboarding_completed_at: string | Date | null;
  sample_data: boolean;
};

export function toProfile(
  row: UserRow,
  simulated: boolean,
): Profile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    tz: row.tz,
    tone: row.tone,
    values: readJson<string[]>(row.values_json, []),
    constraints: row.constraints_text,
    pulseHour: row.pulse_hour,
    quietStart: row.quiet_start,
    quietEnd: row.quiet_end,
    reminderWeekday: row.reminder_weekday,
    onboardingCompletedAt: row.onboarding_completed_at
      ? new Date(row.onboarding_completed_at).toISOString()
      : null,
    sampleData: row.sample_data,
    simulated,
  };
}

export async function loadUser(userId: string): Promise<UserRow | null> {
  const rows = await sql<UserRow>("select * from users where id = $1", [userId]);
  return rows[0] ?? null;
}

export async function upsertUser(input: {
  id: string;
  email: string;
  displayName: string;
}): Promise<UserRow> {
  const existing = await loadUser(input.id);
  if (existing) {
    if (!existing.display_name && input.displayName) {
      await sql(
        "update users set display_name = $2, email = $3 where id = $1",
        [input.id, input.displayName, input.email],
      );
      return (await loadUser(input.id))!;
    }
    return existing;
  }
  await sql(
    `insert into users (id, email, display_name) values ($1, $2, $3)`,
    [input.id, input.email, input.displayName],
  );
  return (await loadUser(input.id))!;
}
