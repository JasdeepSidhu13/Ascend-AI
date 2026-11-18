"use client";

import { useEffect, useState } from "react";
import { AREAS, METRIC_LABELS } from "@/lib/catalog";
import { api } from "@/lib/client";
import { SampleBanner, useApp } from "./AppFrame";

type Pack = { id: string; title: string; weeks: number; areaKey: string; blurb: string };

export function ProgramsView() {
  const { refresh } = useApp();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [prompt, setPrompt] = useState("");
  const [metricKey, setMetricKey] = useState("health.sleep_hours");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api<Pack[]>("/api/programs").then(setPacks).catch(() => setPacks([]));
  }, []);

  async function apply(programId: string) {
    await api("/api/programs", { method: "POST", body: JSON.stringify({ programId }) });
    await refresh();
    setMsg("Added to your goals. At most three actions stay active.");
  }

  async function addQuestion() {
    await api("/api/questions", {
      method: "POST",
      body: JSON.stringify({ prompt, metricKey, type: "number", areaKey: METRIC_LABELS[metricKey]?.area }),
    });
    setPrompt("");
    setMsg("That question is in your personal bank for pulses and weekly reflections.");
  }

  return (
    <main className="px-5 lg:px-10 max-w-3xl mx-auto py-4 space-y-6">
      <SampleBanner />
      <header>
        <p className="kicker">Programs</p>
        <h1 className="display text-4xl mt-2">Packs of questions, goals and actions</h1>
      </header>
      {msg && <p className="text-sm text-[var(--muted)]">{msg}</p>}
      <div className="grid gap-4">
        {packs.map((p) => (
          <article key={p.id} className="card p-5">
            <p className="kicker">{p.weeks} weeks · {p.areaKey}</p>
            <h2 className="display text-2xl mt-1">{p.title}</h2>
            <p className="text-[var(--muted)] mt-2">{p.blurb}</p>
            <button
              className="mt-4 px-4 py-2 rounded-full bg-[var(--ink)] text-[var(--bg)] text-sm"
              onClick={() => apply(p.id)}
            >
              Add this program
            </button>
          </article>
        ))}
      </div>
      <section className="card p-5 space-y-3">
        <p className="kicker">Your own question</p>
        <h2 className="display text-2xl">Write what you want to measure</h2>
        <textarea
          className="w-full rounded-2xl border hairline p-3 bg-[var(--bg)]"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="How many minutes of language practice today?"
        />
        <select
          className="w-full h-12 rounded-2xl border hairline px-3 bg-[var(--bg)]"
          value={metricKey}
          onChange={(e) => setMetricKey(e.target.value)}
        >
          {Object.entries(METRIC_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label} ({k})
            </option>
          ))}
        </select>
        <button className="px-4 py-2 rounded-full border hairline" onClick={addQuestion} disabled={prompt.length < 8}>
          Save to my bank
        </button>
        <p className="text-sm text-[var(--muted)]">{AREAS.length} areas. Generated probes that earn two useful answers join this bank too.</p>
      </section>
    </main>
  );
}
