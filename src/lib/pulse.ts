export function hourInZone(now: Date, tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz || "UTC",
      hour: "numeric",
      hourCycle: "h23",
    }).formatToParts(now);
    return Number(parts.find((p) => p.type === "hour")?.value ?? now.getUTCHours());
  } catch {
    return now.getUTCHours();
  }
}

export function dateInZone(now: Date, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    /* fall through */
  }
  return now.toISOString().slice(0, 10);
}

export type PulseCandidate = {
  pulseHour: number;
  tz: string;
  emailPulse: boolean;
  lastPulseEmailOn: string | null;
  alreadyPulsedToday: boolean;
};

export function dueForPulseEmail(user: PulseCandidate, now = new Date()): boolean {
  if (!user.emailPulse) return false;
  if (hourInZone(now, user.tz) !== user.pulseHour) return false;
  const today = dateInZone(now, user.tz);
  if (user.lastPulseEmailOn === today) return false;
  if (user.alreadyPulsedToday) return false;
  return true;
}

export function appOrigin(): string {
  const raw = process.env.APP_ORIGIN?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "https://ascend.apps.grok.bot";
}
