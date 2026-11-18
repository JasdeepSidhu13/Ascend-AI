import { json, withProfile } from "@/lib/http";
import { startSession } from "@/lib/sessions";
import type { SessionKind } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withProfile(request, async (profile) => {
    const body = (await request.json()) as { kind?: SessionKind };
    const kind = body.kind ?? "pulse";
    const session = await startSession(profile.id, kind);
    return json(session);
  });
}
