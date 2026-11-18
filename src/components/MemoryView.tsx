"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { SampleBanner, useApp } from "./AppFrame";

export function MemoryView() {
  const { state, refresh } = useApp();
  const s = state!;
  const facts = s.memories.filter((m) => m.layer === "fact");
  const episodes = s.memories.filter((m) => m.layer === "episode");
  return (
    <main className="px-5 lg:px-10 max-w-3xl mx-auto py-4 space-y-8">
      <SampleBanner />
      <header>
        <p className="kicker">Memory</p>
        <h1 className="display text-4xl mt-2">What we keep, on purpose</h1>
        <p className="text-[var(--muted)] mt-2">
          Only facts you stated. Health, money and relationship facts wait for a tap. You can edit, pause or delete any of them.
        </p>
      </header>
      <section>
        <p className="kicker mb-3">Profile</p>
        <div className="card p-5 space-y-2">
          <p>
            <span className="text-[var(--muted)]">Values · </span>
            {s.profile.values.join(", ") || "Not set"}
          </p>
          <p>
            <span className="text-[var(--muted)]">Constraints · </span>
            {s.profile.constraints || "None noted"}
          </p>
          <p>
            <span className="text-[var(--muted)]">Tone · </span>
            {s.profile.tone}
          </p>
        </div>
      </section>
      <section className="space-y-3">
        <p className="kicker">Facts</p>
        {facts.map((m) => (
          <FactCard key={m.id} m={m} onChange={refresh} />
        ))}
        {facts.length === 0 && <p className="text-[var(--muted)]">Facts appear after a few check-ins, from your own words.</p>}
      </section>
      <section className="space-y-3">
        <p className="kicker">Episodes</p>
        {episodes.map((m) => (
          <article key={m.id} className="card p-4">
            <p>{m.text}</p>
          </article>
        ))}
        {episodes.length === 0 && (
          <p className="text-[var(--muted)]">Weekly summaries land here after a reflection.</p>
        )}
      </section>
    </main>
  );
}

function FactCard({
  m,
  onChange,
}: {
  m: {
    id: string;
    text: string;
    area: string;
    paused: boolean;
    confirmed: boolean;
    validUntil: string | null;
    confidence: number;
  };
  onChange: () => void;
}) {
  const [text, setText] = useState(m.text);
  return (
    <article className={`card p-4 ${m.paused ? "opacity-60" : ""}`}>
      <p className="kicker">
        {m.area}
        {!m.confirmed ? " · waiting for confirmation" : ""}
        {m.validUntil ? ` · until ${m.validUntil}` : ""}
      </p>
      <textarea
        className="w-full mt-2 bg-transparent resize-none"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={async () => {
          if (text !== m.text) {
            await api(`/api/memories/${m.id}`, { method: "PATCH", body: JSON.stringify({ text }) });
            onChange();
          }
        }}
      />
      <div className="flex gap-2 mt-2 text-sm">
        <button
          className="underline underline-offset-4"
          onClick={async () => {
            await api(`/api/memories/${m.id}`, {
              method: "PATCH",
              body: JSON.stringify({ paused: !m.paused }),
            });
            onChange();
          }}
        >
          {m.paused ? "Resume" : "Pause"}
        </button>
        <button
          className="underline underline-offset-4"
          onClick={async () => {
            await api(`/api/memories/${m.id}`, { method: "DELETE" });
            onChange();
          }}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
