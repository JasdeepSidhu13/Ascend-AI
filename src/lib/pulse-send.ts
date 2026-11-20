import { sql } from "./db";
import { createLoginToken, mailConfigured, sendPulseEmail } from "./mail";
import { dateInZone, dueForPulseEmail } from "./pulse";

export async function sendDuePulseEmails(now = new Date()): Promise<{
  sent: number;
  skipped: string;
}> {
  if (!mailConfigured()) return { sent: 0, skipped: "not_configured" };
  const users = await sql<{
    id: string;
    email: string;
    display_name: string;
    tz: string;
    pulse_hour: number;
    email_pulse: boolean;
    last_pulse_email_on: string | null;
  }>(
    `select id, email, display_name, tz, pulse_hour, email_pulse,
            last_pulse_email_on::text as last_pulse_email_on
     from users
     where email_pulse = true
       and onboarding_completed_at is not null
       and email <> ''
     limit 400`,
  );
  let sent = 0;
  for (const u of users) {
    const today = dateInZone(now, u.tz);
    const lastPulse = await sql<{ at: string }>(
      `select completed_at::text as at from sessions
       where user_id = $1 and kind = 'pulse' and completed_at is not null
       order by completed_at desc limit 1`,
      [u.id],
    );
    const alreadyPulsedToday = lastPulse[0]
      ? dateInZone(new Date(lastPulse[0].at), u.tz) === today
      : false;
    const due = dueForPulseEmail(
      {
        pulseHour: u.pulse_hour,
        tz: u.tz,
        emailPulse: u.email_pulse,
        lastPulseEmailOn: u.last_pulse_email_on?.slice(0, 10) ?? null,
        alreadyPulsedToday,
      },
      now,
    );
    if (!due) continue;
    const token = await createLoginToken(u.id, "pulse", 24);
    const result = await sendPulseEmail({
      to: u.email,
      name: u.display_name,
      hour: u.pulse_hour,
      token,
    });
    if (!result.ok) continue;
    await sql(`update users set last_pulse_email_on = $2::date where id = $1`, [u.id, today]);
    sent += 1;
    if (sent >= 200) break;
  }
  return { sent, skipped: sent ? "" : "none_due" };
}
