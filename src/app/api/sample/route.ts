import { json, withProfile } from "@/lib/http";
import { rateLimited } from "@/lib/limit";
import { clearUserData, seedSample } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withProfile(request, async (profile, identity) => {
    if (rateLimited(`sample:${profile.id}`, 2, 15 * 60 * 1000)) {
      return json({ error: "too_many" }, 429);
    }
    const body = (await request.json()) as { action: "load" | "clear" };
    await clearUserData(profile.id);
    if (body.action === "load") {
      await seedSample(profile.id, {
        email: profile.email,
        name: profile.displayName || "Alex",
      });
    }
    void identity;
    return json({ ok: true });
  });
}
