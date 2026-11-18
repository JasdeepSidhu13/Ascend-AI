"use client";

import { useState } from "react";
import { AREAS, VALUE_OPTIONS } from "@/lib/catalog";
import { api } from "@/lib/client";
import { useApp } from "./AppFrame";

export function OnboardingView() {
  const { state, refresh } = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(state?.profile.displayName || "");
  const [values, setValues] = useState<string[]>(state?.profile.values?.slice(0, 3) ?? []);
  const [tone, setTone] = useState<"gentle" | "direct">(state?.profile.tone ?? "gentle");
  const [wheel, setWheel] = useState<Record<string, number>>(
    Object.fromEntries(AREAS.map((a) => [a.key, 6])),
  );
  const [goal, setGoal] = useState("Run a half marathon by April");
  const [pulseHour, setPulseHour] = useState(7);
  const [busy, setBusy] = useState(false);

  async function finish() {
    setBusy(true);
    await api("/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
        displayName: name || "Friend",
        values,
        tone,
        pulseHour,
        wheel,
        goals: goal.trim()
          ? [
              {
                title: goal.trim(),
                areaKey: "health",
                why: "A body that keeps up",
                metricKey: "health.run_km",
                baseline: 15,
                target: 40,
                unit: "km",
                dueOn: "2027-03-01",
              },
            ]
          : [],
      }),
    });
    await refresh();
    window.location.href = "/";
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto px-5 py-10">
      <p className="kicker">Onboarding · {step + 1} of 4</p>
      {step === 0 && (
        <section className="mt-6 space-y-6">
          <h1 className="display text-4xl">A quiet place to see your life clearly.</h1>
          <label className="block">
            <span className="kicker">What should we call you?</span>
            <input
              className="mt-2 w-full h-14 rounded-2xl bg-[var(--card)] border hairline px-4"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div>
            <p className="kicker">Pick up to three values</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {VALUE_OPTIONS.map((v) => {
                const on = values.includes(v);
                return (
                  <button
                    key={v}
                    className={`px-3 py-2 rounded-full border hairline ${on ? "bg-[var(--accent)] text-[var(--bg)]" : "bg-[var(--card)]"}`}
                    onClick={() =>
                      setValues((cur) =>
                        on ? cur.filter((x) => x !== v) : cur.length < 3 ? [...cur, v] : cur,
                      )
                    }
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="kicker">Voice</p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {(["gentle", "direct"] as const).map((t) => (
                <button
                  key={t}
                  className={`p-4 rounded-2xl border hairline text-left ${tone === t ? "bg-[var(--accent-soft)]" : "bg-[var(--card)]"}`}
                  onClick={() => setTone(t)}
                >
                  <span className="capitalize font-medium">{t}</span>
                  <span className="block text-sm text-[var(--muted)] mt-1">
                    {t === "gentle" ? "You might try…" : "Do this next."}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
      {step === 1 && (
        <section className="mt-6 space-y-5">
          <h1 className="display text-4xl">A first life wheel</h1>
          <p className="text-[var(--muted)]">Honest, not impressive. This is the baseline trends grow from.</p>
          {AREAS.map((a) => (
            <label key={a.key} className="block">
              <span className="flex justify-between text-sm">
                {a.name}
                <span className="tabular">{wheel[a.key]}</span>
              </span>
              <input
                type="range"
                min={1}
                max={10}
                value={wheel[a.key]}
                onChange={(e) => setWheel({ ...wheel, [a.key]: Number(e.target.value) })}
                className="w-full mt-2"
              />
            </label>
          ))}
        </section>
      )}
      {step === 2 && (
        <section className="mt-6 space-y-4">
          <h1 className="display text-4xl">One goal for the quarter</h1>
          <p className="text-[var(--muted)]">Optional. You can add more later. Sample: a half marathon by April.</p>
          <input
            className="w-full h-14 rounded-2xl bg-[var(--card)] border hairline px-4"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </section>
      )}
      {step === 3 && (
        <section className="mt-6 space-y-4">
          <h1 className="display text-4xl">When should the daily pulse arrive?</h1>
          <p className="text-[var(--muted)]">A 60-second check. Quiet hours stay quiet. Nudges are in-app in this version.</p>
          <input
            type="range"
            min={5}
            max={21}
            value={pulseHour}
            onChange={(e) => setPulseHour(Number(e.target.value))}
            className="w-full"
          />
          <p className="tabular text-2xl">{String(pulseHour).padStart(2, "0")}:00</p>
        </section>
      )}
      <div className="mt-10 flex gap-3">
        {step > 0 && (
          <button className="px-5 py-3 rounded-full border hairline" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
        <button
          className="flex-1 py-3 rounded-full bg-[var(--ink)] text-[var(--bg)] disabled:opacity-60"
          disabled={busy}
          onClick={() => (step < 3 ? setStep(step + 1) : finish())}
        >
          {step < 3 ? "Continue" : busy ? "Saving…" : "Enter Ascend"}
        </button>
      </div>
    </main>
  );
}
