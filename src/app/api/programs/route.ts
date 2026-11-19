import { PROGRAMS, applyProgram } from "@/lib/programs";
import { json, withProfile } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return json(PROGRAMS.map(({ id, title, weeks, areaKey, blurb }) => ({ id, title, weeks, areaKey, blurb })));
}

export async function POST(request: Request) {
  return withProfile(request, async (profile) => {
    const body = (await request.json()) as { programId?: string };
    if (!body.programId) return json({ error: "program_required" }, 400);
    const result = await applyProgram(profile.id, body.programId);
    if ("error" in result) return json(result, 404);
    return json(result);
  });
}
