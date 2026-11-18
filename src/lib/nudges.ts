import type { Profile } from "./types";
import type { SessionKind } from "./types";

export function inQuietHours(now: Date, quietStart: number, quietEnd: number): boolean {
  const hour = now.getHours();
  if (quietStart === quietEnd) return false;
  if (quietStart < quietEnd) return hour >= quietStart && hour < quietEnd;
  return hour >= quietStart || hour < quietEnd;
}

export async function dueNudges(
  profile: Profile,
  due: { kind: SessionKind; label: string } | null,
): Promise<{ id: string; kind: string; text: string }[]> {
  if (inQuietHours(new Date(), profile.quietStart, profile.quietEnd)) return [];
  if (!due) return [];
  return [{ id: due.kind, kind: due.kind, text: copy(due.kind) }];
}

function copy(kind: string): string {
  if (kind === "pulse" || kind === "daily_pulse") return "Sixty seconds for today's pulse — energy, mood, the habits that feed trends.";
  if (kind === "weekly") return "Weekly reflection is due. About three minutes, chosen for this week.";
  if (kind === "monthly") return "Monthly review: wins, drifts, and a plan you can print.";
  if (kind === "audit") return "Quarterly life audit — every area, then reset goals.";
  return "A quiet check-in is waiting.";
}
