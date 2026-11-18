import { dashboardState } from "@/lib/state";
import { json, withProfile } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withProfile(request, async (profile) => json(await dashboardState(profile)));
}
