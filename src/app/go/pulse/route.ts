import { NextResponse } from "next/server";
import { consumeLoginToken } from "@/lib/mail";
import { createSession, sessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("t") ?? "";
  const userId = raw ? await consumeLoginToken(raw, "pulse") : null;
  if (!userId) {
    const login = new URL("/login", url.origin);
    return NextResponse.redirect(login);
  }
  const token = await createSession(userId);
  const next = new URL("/check-in?kind=pulse", url.origin);
  const res = NextResponse.redirect(next);
  res.headers.set("set-cookie", sessionCookie(token));
  return res;
}
