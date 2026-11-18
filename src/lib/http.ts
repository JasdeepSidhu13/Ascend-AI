import { json, requireViewer } from "./auth";
import { bootstrapProfile } from "./bootstrap";
import type { Profile } from "./types";

export async function withProfile(
  request: Request,
  handler: (profile: Profile, identity: { sub: string; simulated?: boolean }) => Promise<Response>,
): Promise<Response> {
  const identity = await requireViewer(request);
  if (identity instanceof Response) return identity;
  const profile = await bootstrapProfile(identity);
  return handler(profile, identity);
}

export { json };
