import { hashToken, newToken } from "./crypto-pass";
import { nid, sql } from "./db";
import type { UserRow } from "./auth";

const COOKIE = "ascend_session";
const DAYS = 30;

export function sessionCookie(token: string, maxAgeSec = DAYS * 86400): string {
  const secure = process.env.CURSOR_APP_ID || process.env.VERCEL || process.env.NODE_ENV === "production";
  const parts = [
    `${COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readSessionToken(request: Request): string | null {
  const raw = request.headers.get("cookie") ?? "";
  const parts = raw.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(COOKIE + "=")) return decodeURIComponent(p.slice(COOKIE.length + 1));
  }
  return null;
}

export async function createSession(userId: string): Promise<string> {
  const token = newToken();
  const expires = new Date(Date.now() + DAYS * 86400 * 1000);
  await sql(
    `insert into auth_sessions (id, user_id, token_hash, expires_at) values ($1,$2,$3,$4)`,
    [nid("sess"), userId, hashToken(token), expires.toISOString()],
  );
  return token;
}

export async function userFromSession(request: Request): Promise<UserRow | null> {
  const token = readSessionToken(request);
  if (!token) return null;
  const rows = await sql<UserRow & { expires_at: string }>(
    `select u.*, s.expires_at
     from auth_sessions s
     join users u on u.id = s.user_id
     where s.token_hash = $1
     limit 1`,
    [hashToken(token)],
  );
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await sql(`delete from auth_sessions where token_hash = $1`, [hashToken(token)]);
    return null;
  }
  return row;
}

export async function destroySession(request: Request): Promise<void> {
  const token = readSessionToken(request);
  if (!token) return;
  await sql(`delete from auth_sessions where token_hash = $1`, [hashToken(token)]);
}
