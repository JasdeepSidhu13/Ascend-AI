"use client";

import { useState } from "react";
import { AREAS, METRIC_LABELS } from "@/lib/catalog";
import { api } from "@/lib/client";
import { SampleBanner, useApp } from "./AppFrame";
import { PaceBar, Sparkline } from "./charts";

export function GoalsView() {
  const { state, refresh } = useApp();
  const s = state!;
  const [open, setOpen] = useState(false);
  return (
    <main className="px-5 lg:px-10 max-w-3xl mx-auto py-4 space-y-6">
      <SampleBanner />
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="kicker">Goals</p>
          <h1 className="display text-4xl mt-2">Quarter to next step</h1>
        </div>
        <button className="px-4 py-2 rounded-full bg-[var(--ink)] text-[var(--bg)] text-sm" onClick={() => setOpen(true)}>
          New goal
        </button>
      </header>
      {s.goals.map((g) => (
        <article key={g.id} className="card p-5">
          <p className="kicker">{g.area}</p>
          <h2 className="display text-2xl mt-1">{g.title}</h2>
          {g.why && <p className="text-[var(--muted)] mt-1">{g.why}</p>}
          <ShareGoal goalId={g.id} />
          {g.keyResults.map((kr) => (
            <div key={kr.id} className="mt-4">
              <p className="text-sm">
                {kr.label}: <span className="tabular">{kr.current}</span> {kr.unit} → {kr.target} {kr.unit}
              </p>
              <p className="kicker mt-1">{kr.status.replace("_", " ")} · projected {kr.projected}</p>
              <PaceBar
                baseline={kr.baseline}
                current={kr.current}
                target={kr.target}
                projected={kr.projected}
                status={kr.status}
              />
              <Sparkline points={kr.points} target={kr.target} />
            </div>
          ))}
        </article>
      ))}
      <section className="card p-5">
        <p className="kicker">This week&apos;s actions</p>
        <ul className="mt-3 space-y-3">
          {s.actions.map((a) => (
            <li key={a.id} className="border-t hairline pt-3">
              <p>{a.text}</p>
              <p className="text-sm text-[var(--muted)] mt-1">
                {a.status}
                {a.metricLabel ? ` · meant to move ${a.metricLabel}` : ""}
              </p>
            </li>
          ))}
        </ul>
        <NewAction onCreated={refresh} goalId={s.goals[0]?.id} />
      </section>
      {open && <GoalModal onClose={() => setOpen(false)} onCreated={refresh} />}
    </main>
  );
}

function ShareGoal({ goalId }: { goalId: string }) {
  const [url, setUrl] = useState("");
  return (
    <button
      className="mt-3 text-sm underline underline-offset-4 text-[var(--muted)]"
      onClick={async () => {
        const res = await api<{ token: string }>("/api/share", {
          method: "POST",
          body: JSON.stringify({ goalId }),
        });
        const next = `${window.location.origin}/share/${res.token}`;
        setUrl(next);
        try {
          await navigator.clipboard.writeText(next);
        } catch {
          /* ignore */
        }
      }}
    >
      {url ? "Share link copied" : "Share this goal with consent"}
    </button>
  );
}

function NewAction({ onCreated, goalId }: { onCreated: () => void; goalId?: string }) {
  const [text, setText] = useState("");
  const [trigger, setTrigger] = useState("I close my laptop");
  return (
    <form
      className="mt-4 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        await api("/api/actions", {
          method: "POST",
          body: JSON.stringify({ text, trigger, goalId }),
        });
        setText("");
        onCreated();
      }}
    >
      <p className="text-sm text-[var(--muted)]">When [trigger], I will [action]. Max three active.</p>
      <input
        className="w-full h-12 rounded-2xl bg-[var(--bg)] border hairline px-3"
        placeholder="walk for 20 minutes"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <input
        className="w-full h-12 rounded-2xl bg-[var(--bg)] border hairline px-3"
        value={trigger}
        onChange={(e) => setTrigger(e.target.value)}
      />
      <button className="px-4 py-2 rounded-full border hairline text-sm">Add action</button>
    </form>
  );
}

function GoalModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [areaKey, setAreaKey] = useState("health");
  const [metricKey, setMetricKey] = useState("health.run_km");
  const [target, setTarget] = useState("40");
  const [baseline, setBaseline] = useState("15");
  const [dueOn, setDueOn] = useState("2027-03-01");
  return (
    <div className="fixed inset-0 z-40 bg-black/40 grid place-items-end sm:place-items-center p-0 sm:p-6" onClick={onClose}>
      <form
        className="bg-[var(--card)] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-3"
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          await api("/api/goals", {
            method: "POST",
            body: JSON.stringify({
              title,
              areaKey,
              dueOn,
              metricKey,
              baseline: Number(baseline),
              target: Number(target),
              unit: METRIC_LABELS[metricKey]?.unit ?? "",
            }),
          });
          onCreated();
          onClose();
        }}
      >
        <h2 className="display text-2xl">New goal</h2>
        <input className="w-full h-12 rounded-2xl border hairline px-3 bg-[var(--bg)]" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <select className="w-full h-12 rounded-2xl border hairline px-3 bg-[var(--bg)]" value={areaKey} onChange={(e) => setAreaKey(e.target.value)}>
          {AREAS.map((a) => (
            <option key={a.key} value={a.key}>
              {a.name}
            </option>
          ))}
        </select>
        <select className="w-full h-12 rounded-2xl border hairline px-3 bg-[var(--bg)]" value={metricKey} onChange={(e) => setMetricKey(e.target.value)}>
          {Object.entries(METRIC_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input className="h-12 rounded-2xl border hairline px-3 bg-[var(--bg)]" value={baseline} onChange={(e) => setBaseline(e.target.value)} />
          <input className="h-12 rounded-2xl border hairline px-3 bg-[var(--bg)]" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
        <input type="date" className="w-full h-12 rounded-2xl border hairline px-3 bg-[var(--bg)]" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
        <button className="w-full py-3 rounded-full bg-[var(--ink)] text-[var(--bg)]">Save</button>
      </form>
    </div>
  );
}
