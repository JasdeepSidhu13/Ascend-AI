import { json, withProfile } from "@/lib/http";
import { rateLimited } from "@/lib/limit";
import { startSession } from "@/lib/sessions";
import type { SessionKind } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withProfile(request, async (profile) => {
    if (rateLimited(`session:${profile.id}`, 20, 60 * 60 * 1000)) {
      return json({ error: "too_many" }, 429);
    }
    const body = (await request.json()) as { kind?: SessionKind };
    const kind = body.kind ?? "pulse";
    const session = await startSession(profile.id, kind);
    return json(session);
  });
}
