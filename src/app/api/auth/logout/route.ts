import { json } from "@/lib/auth";
import { clearSessionCookie, destroySession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await destroySession(request);
  const res = json({ ok: true });
  res.headers.set("set-cookie", clearSessionCookie());
  return res;
}
