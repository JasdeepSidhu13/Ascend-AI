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
        <button
          type="button"
          className="btn-primary px-4 py-2 rounded-full text-sm"
          onClick={() => setOpen(true)}
        >
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
  const [error, setError] = useState("");
  return (
    <div className="mt-3">
      <button
        type="button"
        className="text-sm underline underline-offset-4 text-[var(--muted)]"
        onClick={async () => {
          setError("");
          try {
            const res = await api<{ token: string }>("/api/share", {
              method: "POST",
              body: JSON.stringify({ goalId }),
            });
            const next = `${window.location.origin}/share/${res.token}`;
            setUrl(next);
            try {
              await navigator.clipboard.writeText(next);
            } catch {
              /* clipboard may be blocked; link still shows */
            }
          } catch {
            setError("Could not create a share link.");
          }
        }}
      >
        {url ? "Copy share link again" : "Copy share link"}
      </button>
      {url && (
        <p className="text-sm text-[var(--muted)] mt-1 break-all">
          Copied. {url}
        </p>
      )}
      {error && <p className="text-sm text-[var(--warn)] mt-1">{error}</p>}
    </div>
  );
}

function NewAction({ onCreated, goalId }: { onCreated: () => void; goalId?: string }) {
  const [text, setText] = useState("");
  const [trigger, setTrigger] = useState("I close my laptop");
  const [error, setError] = useState("");
  return (
    <form
      className="mt-4 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        setError("");
        try {
          await api("/api/actions", {
            method: "POST",
            body: JSON.stringify({ text, trigger, goalId }),
          });
          setText("");
          onCreated();
        } catch (err) {
          setError(
            err instanceof Error && err.message === "max_active"
              ? "You already have three active actions. Mark one done first."
              : "Could not add that action.",
          );
        }
      }}
    >
      <p className="text-sm text-[var(--muted)]">When [trigger], I will [action]. At most three active.</p>
      <label className="block">
        <span className="kicker">I will</span>
        <input
          className="mt-1 w-full h-12 rounded-2xl bg-[var(--bg)] border hairline px-3"
          placeholder="walk for 20 minutes"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="kicker">When</span>
        <input
          className="mt-1 w-full h-12 rounded-2xl bg-[var(--bg)] border hairline px-3"
          placeholder="I close my laptop"
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
        />
      </label>
      <button type="submit" className="px-4 py-2 rounded-full border hairline text-sm">
        Add action
      </button>
      {error && <p className="text-sm text-[var(--warn)]">{error}</p>}
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
        <label className="block">
          <span className="kicker">Title</span>
          <input className="mt-1 w-full h-12 rounded-2xl border hairline px-3 bg-[var(--bg)]" placeholder="Run a half marathon" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="block">
          <span className="kicker">Area</span>
          <select className="mt-1 w-full h-12 rounded-2xl border hairline px-3 bg-[var(--bg)]" value={areaKey} onChange={(e) => setAreaKey(e.target.value)}>
            {AREAS.map((a) => (
              <option key={a.key} value={a.key}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="kicker">Metric</span>
          <select className="mt-1 w-full h-12 rounded-2xl border hairline px-3 bg-[var(--bg)]" value={metricKey} onChange={(e) => setMetricKey(e.target.value)}>
            {Object.entries(METRIC_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="kicker">Baseline</span>
            <input className="mt-1 w-full h-12 rounded-2xl border hairline px-3 bg-[var(--bg)]" value={baseline} onChange={(e) => setBaseline(e.target.value)} inputMode="decimal" />
          </label>
          <label className="block">
            <span className="kicker">Target</span>
            <input className="mt-1 w-full h-12 rounded-2xl border hairline px-3 bg-[var(--bg)]" value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" />
          </label>
        </div>
        <label className="block">
          <span className="kicker">Due date</span>
          <input type="date" className="mt-1 w-full h-12 rounded-2xl border hairline px-3 bg-[var(--bg)]" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
        </label>
        <div className="flex gap-2">
          <button type="button" className="flex-1 py-3 rounded-full border hairline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary flex-1 py-3 rounded-full">
            Create goal
          </button>
        </div>
      </form>
    </div>
  );
}
