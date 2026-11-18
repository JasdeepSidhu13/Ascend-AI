"use client";

import { useState } from "react";
import { SampleBanner, useApp } from "./AppFrame";
import { EvidenceSheet, InsightCard } from "./InsightCard";

export function InsightsView() {
  const { state, refresh } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const s = state!;
  const current = s.insights.find((i) => i.id === open) ?? null;
  return (
    <main className="px-5 lg:px-10 max-w-3xl mx-auto py-4 space-y-6">
      <SampleBanner />
      <header>
        <p className="kicker">Insight feed</p>
        <h1 className="display text-4xl mt-2">Computed, then told</h1>
        <p className="text-[var(--muted)] mt-2 max-w-xl">
          Ranked by effect, confidence, goal relevance and novelty. Helpful ratings teach the ranker what to show you next.
        </p>
      </header>
      {s.insights.length === 0 ? (
        <div className="card p-6">
          <p>{s.teaching.insights}</p>
        </div>
      ) : (
        s.insights.map((i) => (
          <InsightCard key={i.id} insight={i} onOpen={() => setOpen(i.id)} onRated={refresh} />
        ))
      )}
      {current && <EvidenceSheet insight={current} onClose={() => setOpen(null)} />}
    </main>
  );
}
