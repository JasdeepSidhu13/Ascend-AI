import { json, withProfile } from "@/lib/http";
import { createLoginToken, mailConfigured, sendPulseEmail } from "@/lib/mail";
import { rateLimited } from "@/lib/limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withProfile(request, async (profile) => {
    if (rateLimited(`mail-test:${profile.id}`, 3, 15 * 60 * 1000)) {
      return json({ error: "too_many" }, 429);
    }
    if (!mailConfigured()) return json({ error: "not_configured", configured: false }, 400);
    if (!profile.email) return json({ error: "no_email" }, 400);
    const token = await createLoginToken(profile.id, "pulse", 24);
    const result = await sendPulseEmail({
      to: profile.email,
      name: profile.displayName,
      hour: profile.pulseHour,
      token,
      origin: new URL(request.url).origin,
    });
    if (!result.ok) return json({ error: result.error ?? "send_failed" }, 502);
    return json({ ok: true, configured: true });
  });
}
