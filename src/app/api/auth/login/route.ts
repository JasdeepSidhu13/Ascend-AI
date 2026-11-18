import { normalizeEmail, validEmail, verifyPassword } from "@/lib/crypto-pass";
import { sql } from "@/lib/db";
import { json } from "@/lib/auth";
import { clientKey, rateLimited } from "@/lib/limit";
import { createSession, sessionCookie } from "@/lib/session";
import { ensureCatalog } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (rateLimited(clientKey(request, "login"), 10, 15 * 60 * 1000)) {
    return json({ error: "too_many" }, 429);
  }
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  const email = normalizeEmail(body.email ?? "");
  const password = body.password ?? "";
  if (!validEmail(email) || !password) return json({ error: "invalid" }, 400);
  await ensureCatalog();
  const rows = await sql<{ id: string; password_hash: string | null }>(
    `select id, password_hash from users where email_unique = $1`,
    [email],
  );
  const row = rows[0];
  if (!row?.password_hash) return json({ error: "invalid" }, 401);
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return json({ error: "invalid" }, 401);
  const token = await createSession(row.id);
  const res = json({ ok: true, id: row.id });
  res.headers.set("set-cookie", sessionCookie(token));
  return res;
}
