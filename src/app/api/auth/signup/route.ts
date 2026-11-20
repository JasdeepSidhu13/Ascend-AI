import { hashPassword, normalizeEmail, validEmail, validPassword } from "@/lib/crypto-pass";
import { nid, sql } from "@/lib/db";
import { json } from "@/lib/auth";
import { rateLimited } from "@/lib/limit";
import { createSession, sessionCookie } from "@/lib/session";
import { ensureCatalog } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (rateLimited("signup", 10, 60 * 60 * 1000)) {
    return json({ error: "too_many" }, 429);
  }
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    displayName?: string;
  };
  const email = normalizeEmail(body.email ?? "");
  const password = body.password ?? "";
  const displayName = (body.displayName ?? "").trim().slice(0, 80);
  if (!validEmail(email)) return json({ error: "invalid_email" }, 400);
  if (rateLimited(`signup:${email}`, 3, 60 * 60 * 1000)) {
    return json({ error: "too_many" }, 429);
  }
  if (!validPassword(password)) return json({ error: "weak_password" }, 400);
  await ensureCatalog();
  const existing = await sql<{ id: string }>(
    `select id from users where email_unique = $1`,
    [email],
  );
  if (existing[0]) return json({ error: "email_taken" }, 409);
  const id = nid("acct");
  const passwordHash = await hashPassword(password);
  await sql(
    `insert into users (id, email, email_unique, display_name, password_hash)
     values ($1,$2,$3,$4,$5)`,
    [id, email, email, displayName || email.split("@")[0], passwordHash],
  );
  const token = await createSession(id);
  const res = json({ ok: true, id });
  res.headers.set("set-cookie", sessionCookie(token));
  return res;
}
