import { hashToken, newToken } from "./crypto-pass";
import { nid, sql } from "./db";
import { appOrigin } from "./pulse";

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function createLoginToken(userId: string, purpose: string, hours = 24): Promise<string> {
  const raw = newToken();
  const expires = new Date(Date.now() + hours * 3600 * 1000);
  await sql(
    `insert into login_tokens (id, user_id, token_hash, purpose, expires_at)
     values ($1,$2,$3,$4,$5)`,
    [nid("lt"), userId, hashToken(raw), purpose, expires.toISOString()],
  );
  return raw;
}

export async function consumeLoginToken(
  raw: string,
  purpose: string,
): Promise<string | null> {
  const rows = await sql<{ id: string; user_id: string; expires_at: string; used_at: string | null }>(
    `select id, user_id, expires_at::text as expires_at, used_at::text as used_at
     from login_tokens where token_hash = $1 and purpose = $2`,
    [hashToken(raw), purpose],
  );
  const row = rows[0];
  if (!row || row.used_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  await sql(`update login_tokens set used_at = now() where id = $1 and used_at is null`, [row.id]);
  return row.user_id;
}

export async function sendPulseEmail(input: {
  to: string;
  name: string;
  hour: number;
  token: string;
  origin?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, error: "not_configured" };
  const from = process.env.PULSE_FROM_EMAIL?.trim() || "Ascend <onboarding@resend.dev>";
  const origin = (input.origin || appOrigin()).replace(/\/$/, "");
  const link = `${origin}/go/pulse?t=${encodeURIComponent(input.token)}`;
  const hour = String(input.hour).padStart(2, "0");
  const first = input.name.trim() || "there";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: "Sixty seconds — your daily pulse",
      text: `Hi ${first}. It is ${hour}:00. Open your pulse (one minute, then back to your day):\n${link}\n\nIf you did not ask for this, ignore it.`,
    }),
  });
  if (!res.ok) {
    return { ok: false, error: "send_failed" };
  }
  return { ok: true };
}
