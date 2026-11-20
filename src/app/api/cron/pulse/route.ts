import { json } from "@/lib/auth";
import { rateLimited } from "@/lib/limit";
import { sendDuePulseEmails } from "@/lib/pulse-send";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization") ?? "";
  if (secret) return auth === `Bearer ${secret}`;
  return process.env.NODE_ENV !== "production";
}

export async function POST(request: Request) {
  if (!authorized(request)) return json({ error: "unauthorized" }, 401);
  if (rateLimited("cron:pulse", 12, 60 * 60 * 1000)) {
    return json({ error: "too_many" }, 429);
  }
  const result = await sendDuePulseEmails();
  return json(result);
}

export async function GET(request: Request) {
  return POST(request);
}
