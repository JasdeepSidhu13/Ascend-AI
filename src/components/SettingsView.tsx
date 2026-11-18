"use client";

import { useState } from "react";
import { VALUE_OPTIONS } from "@/lib/catalog";
import { api } from "@/lib/client";
import { useApp } from "./AppFrame";

export function SettingsView() {
  const { state, refresh } = useApp();
  const p = state!.profile;
  const [name, setName] = useState(p.displayName);
  const [tone, setTone] = useState(p.tone);
  const [hour, setHour] = useState(p.pulseHour);
  const [values, setValues] = useState(p.values);
  const [constraints, setConstraints] = useState(p.constraints);
  const [msg, setMsg] = useState("");

  async function save() {
    await api("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({
        displayName: name,
        tone,
        pulseHour: hour,
        values,
        constraints,
      }),
    });
    await refresh();
    setMsg("Saved");
  }

  return (
    <main className="px-5 lg:px-10 max-w-lg mx-auto py-4 space-y-6">
      <header>
        <p className="kicker">Settings</p>
        <h1 className="display text-4xl mt-2">The room, not the coach</h1>
      </header>
      <p className="card p-4 text-sm">
        Signed in as <span className="font-medium">{p.email || p.displayName}</span>.
        Check-ins and memory for this account stay private to it.
      </p>
      <label className="block">
        <span className="kicker">Name</span>
        <input className="mt-2 w-full h-12 rounded-2xl border hairline px-3 bg-[var(--card)]" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div>
        <p className="kicker">Tone</p>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {(["gentle", "direct"] as const).map((t) => (
            <button
              key={t}
              className={`py-3 rounded-2xl border hairline ${tone === t ? "bg-[var(--accent-soft)]" : "bg-[var(--card)]"}`}
              onClick={() => setTone(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="kicker">Daily pulse hour · {String(hour).padStart(2, "0")}:00</span>
        <input type="range" min={5} max={21} value={hour} onChange={(e) => setHour(Number(e.target.value))} className="w-full mt-2" />
      </label>
      <div>
        <p className="kicker">Values</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {VALUE_OPTIONS.map((v) => {
            const on = values.includes(v);
            return (
              <button
                key={v}
                className={`px-3 py-1.5 rounded-full border hairline text-sm ${on ? "bg-[var(--accent)] text-[var(--bg)]" : ""}`}
                onClick={() => setValues((cur) => (on ? cur.filter((x) => x !== v) : [...cur, v].slice(0, 5)))}
              >
                {v}
              </button>
            );
          })}
        </div>
      </div>
      <label className="block">
        <span className="kicker">Constraints</span>
        <textarea className="mt-2 w-full rounded-2xl border hairline p-3 bg-[var(--card)]" rows={3} value={constraints} onChange={(e) => setConstraints(e.target.value)} />
      </label>
      <button className="w-full py-3 rounded-full bg-[var(--ink)] text-[var(--bg)]" onClick={save}>
        Save
      </button>
      {msg && <p className="text-sm text-[var(--muted)]">{msg}</p>}
      <button
        className="w-full py-3 rounded-full border hairline"
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          try {
            sessionStorage.removeItem("ascend-state");
          } catch {
            /* ignore */
          }
          window.location.href = "/login";
        }}
      >
        Sign out
      </button>
      <section className="card p-5 space-y-3">
        <p className="kicker">Your data</p>
        <p className="text-sm text-[var(--muted)]">One-click export. Full delete. Nothing is sent to an LLM except the small assembled context, and never for training.</p>
        {state?.quality && (
          <p className="text-sm text-[var(--muted)]">
            Helpful rate {state.quality.helpfulRate == null ? "not enough ratings" : `${state.quality.helpfulRate}%`}
            · action completion {state.quality.actionRate}% · check-ins {state.quality.checkIns}
          </p>
        )}
        <a className="block underline underline-offset-4" href="/api/export">
          Download JSON export
        </a>
        <a className="block underline underline-offset-4" href="/api/export?format=csv">
          Download CSV of answers
        </a>
        <button
          className="block text-[var(--warn)] underline underline-offset-4"
          onClick={async () => {
            if (!confirm("Delete all of your Ascend data? This cannot be undone.")) return;
            await api("/api/account", { method: "DELETE" });
            window.location.href = "/onboarding";
          }}
        >
          Delete everything
        </button>
        {state?.sample && (
          <button
            className="block underline underline-offset-4"
            onClick={async () => {
              await api("/api/sample", { method: "POST", body: JSON.stringify({ action: "clear" }) });
              window.location.href = "/onboarding";
            }}
          >
            Clear sample history
          </button>
        )}
        {!state?.sample && (
          <button
            className="block underline underline-offset-4"
            onClick={async () => {
              await api("/api/sample", { method: "POST", body: JSON.stringify({ action: "load" }) });
              await refresh();
            }}
          >
            Load sample 12-week history
          </button>
        )}
      </section>
    </main>
  );
}
