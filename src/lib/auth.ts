import { sql } from "./db";
import type { Profile, Tone } from "./types";
import { readJson } from "./db";
import { userFromSession } from "./session";

const PRIVATE = { "cache-control": "private, no-store" };

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: PRIVATE });
}

export type Viewer = {
  sub: string;
  email: string;
  name: string;
  simulated: boolean;
  kind: "person" | "key";
  via: AuthVia;
};

export async function requireViewer(request: Request): Promise<Viewer | Response> {
  const viewer = await resolveViewer(request);
  if (!viewer) return json({ error: "unauthorized" }, 401);
  return viewer;
}

export async function resolveViewer(request: Request): Promise<Viewer | null> {
  const sessionUser = await userFromSession(request);
  if (!sessionUser) return null;
  return {
    sub: sessionUser.id,
    email: sessionUser.email,
    name: sessionUser.display_name,
    simulated: false,
    kind: "person",
    via: "password",
  };
}

export type AuthVia = "cursor" | "password";

export type UserRow = {
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
  password_hash?: string | null;
  email_unique?: string | null;
};

export function toProfile(
  row: UserRow,
  simulated: boolean,
  authVia: AuthVia = "cursor",
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
    authVia,
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
