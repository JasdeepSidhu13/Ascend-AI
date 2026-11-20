"use client";

import { useMemo, useState } from "react";
import { api } from "@/lib/client";
import { useApp } from "./AppFrame";

function detectTz() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function OnboardingView() {
  const { state, refresh } = useApp();
  const [name, setName] = useState(state?.profile.displayName || "");
  const [sleepTarget, setSleepTarget] = useState(7.5);
  const [pulseHour, setPulseHour] = useState(state?.profile.pulseHour || 7);
  const [emailPulse, setEmailPulse] = useState(state?.profile.emailPulse !== false);
  const [busy, setBusy] = useState(false);
  const tz = useMemo(detectTz, []);

  async function finish() {
    setBusy(true);
    await api("/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
        displayName: name || "Friend",
        sleepTarget,
        pulseHour,
        emailPulse,
        tz,
      }),
    });
    await refresh();
    window.location.href = "/";
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto px-5 py-10">
      <p className="kicker">First run · about a minute</p>
      <section className="mt-6 space-y-6">
        <h1 className="display text-4xl">Name, a sleep floor, and a pulse hour.</h1>
        <p className="text-[var(--muted)]">
          Home shows one cited sentence. Three mornings is enough for a cautious first one.
        </p>
        <label className="block">
          <span className="kicker">What should we call you?</span>
          <input
            className="mt-2 w-full h-14 rounded-2xl bg-[var(--card)] border hairline px-4"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="given-name"
          />
        </label>
        <label className="block">
          <span className="kicker">Sleep target · {sleepTarget} hours</span>
          <input
            type="range"
            min={5}
            max={10}
            step={0.5}
            value={sleepTarget}
            onChange={(e) => setSleepTarget(Number(e.target.value))}
            className="w-full mt-3"
          />
        </label>
        <label className="block">
          <span className="kicker">Daily pulse hour · {String(pulseHour).padStart(2, "0")}:00</span>
          <p className="text-sm text-[var(--muted)] mt-1">Sixty seconds. Then you are done.</p>
          <input
            type="range"
            min={5}
            max={21}
            value={pulseHour}
            onChange={(e) => setPulseHour(Number(e.target.value))}
            className="w-full mt-3"
          />
        </label>
        <label className="flex items-start gap-3 card p-4">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={emailPulse}
            onChange={(e) => setEmailPulse(e.target.checked)}
          />
          <span>
            <span className="block font-medium">Email me at pulse hour</span>
            <span className="block text-sm text-[var(--muted)] mt-1">
              A one-tap link to today&apos;s pulse. Time zone {tz}. You can turn this off later.
            </span>
          </span>
        </label>
      </section>
      <button
        type="button"
        className="btn-primary mt-10 w-full py-3 rounded-full disabled:opacity-60"
        disabled={busy}
        onClick={() => finish()}
      >
        {busy ? "Saving…" : "Enter Ascend"}
      </button>
    </main>
  );
}
