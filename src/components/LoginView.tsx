"use client";

import { useState } from "react";

export function LoginView() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const path = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, displayName }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(messageFor(body.error, res.status));
      return;
    }
    try {
      sessionStorage.removeItem("ascend-state");
    } catch {
      /* ignore */
    }
    window.location.href = "/";
  }

  return (
    <main className="min-h-screen grid place-items-center px-5 py-10">
      <div className="w-full max-w-md">
        <p className="kicker">Ascend</p>
        <h1 className="display text-4xl mt-3">
          {mode === "login" ? "Sign in to your room" : "Create a private room"}
        </h1>
        <p className="text-[var(--muted)] mt-3 leading-relaxed">
          Each account only sees its own check-ins, insights and memory. Nothing is shared between
          people.
        </p>
        <form className="mt-8 space-y-4" onSubmit={submit}>
          {mode === "signup" && (
            <label className="block">
              <span className="kicker">Name</span>
              <input
                className="mt-2 w-full h-12 rounded-2xl border hairline px-3 bg-[var(--card)]"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
              />
            </label>
          )}
          <label className="block">
            <span className="kicker">Email</span>
            <input
              type="email"
              required
              className="mt-2 w-full h-12 rounded-2xl border hairline px-3 bg-[var(--card)]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="kicker">Password</span>
            <input
              type="password"
              required
              minLength={8}
              className="mt-2 w-full h-12 rounded-2xl border hairline px-3 bg-[var(--card)]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            {mode === "signup" && (
              <span className="text-sm text-[var(--muted)] mt-1 block">At least 8 characters.</span>
            )}
          </label>
          {error && <p className="text-sm text-[var(--warn)]">{error}</p>}
          <button
            className="w-full py-3 rounded-full bg-[var(--ink)] text-[var(--bg)] disabled:opacity-60"
            disabled={busy}
          >
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button
          className="mt-6 text-sm underline underline-offset-4 text-[var(--muted)]"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError("");
          }}
        >
          {mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}

function messageFor(error: string | undefined, status: number): string {
  if (status === 429) return "Too many tries. Wait a few minutes.";
  if (error === "email_taken") return "That email already has an account.";
  if (error === "weak_password") return "Use at least 8 characters.";
  if (error === "invalid_email") return "That email does not look right.";
  if (error === "invalid") return "Email or password did not match.";
  return "Could not sign in. Try again.";
}
