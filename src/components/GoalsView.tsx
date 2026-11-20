"use client";

import { useState } from "react";
import { AREAS, METRIC_LABELS } from "@/lib/catalog";
import { api } from "@/lib/client";
import { SampleBanner, useApp, type AppState } from "./AppFrame";
import { PaceBar, Sparkline } from "./charts";

type Goal = AppState["goals"][number];

export function GoalsView() {
  const { state, refresh } = useApp();
  const s = state!;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
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
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          New goal
        </button>
      </header>
      {s.goals.length === 0 && (
        <div className="card p-6">
          <h2 className="display text-2xl">No goals yet</h2>
          <p className="text-[var(--muted)] mt-2">Add one with a key result and we will draw the pace line.</p>
        </div>
      )}
      {s.goals.map((g) => (
        <article key={g.id} className="card p-5">
          <p className="kicker">
            {g.area} · {g.status.replace("_", " ")}
            {g.dueOn ? ` · due ${g.dueOn}` : ""}
          </p>
          <h2 className="display text-2xl mt-1">{g.title}</h2>
          {g.why && <p className="text-[var(--muted)] mt-1">{g.why}</p>}
          <GoalControls
            goal={g}
            onEdit={() => {
              setEditing(g);
              setOpen(true);
            }}
            onChanged={refresh}
          />
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
              <ActionControls id={a.id} status={a.status} onChanged={refresh} />
            </li>
          ))}
        </ul>
        <NewAction onCreated={refresh} goals={s.goals} />
      </section>
      {open && (
        <GoalModal
          goal={editing}
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
          onSaved={refresh}
        />
      )}
    </main>
  );
}

function GoalControls({
  goal,
  onEdit,
  onChanged,
}: {
  goal: Goal;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function patch(body: Record<string, unknown>) {
    setBusy(String(body.status ?? "edit"));
    setError("");
    try {
      await api(`/api/goals/${goal.id}`, { method: "PATCH", body: JSON.stringify(body) });
      onChanged();
    } catch {
      setError("Could not update that goal.");
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!confirm(`Delete “${goal.title}”? This cannot be undone.`)) return;
    setBusy("delete");
    setError("");
    try {
      await api(`/api/goals/${goal.id}`, { method: "DELETE" });
      onChanged();
    } catch {
      setError("Could not delete that goal.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="text-sm px-3 py-1.5 rounded-full border hairline disabled:opacity-60"
          disabled={Boolean(busy)}
          onClick={onEdit}
        >
          Edit
        </button>
        {goal.status === "active" ? (
          <button
            type="button"
            className="text-sm px-3 py-1.5 rounded-full border hairline disabled:opacity-60"
            disabled={Boolean(busy)}
            onClick={() => patch({ status: "paused" })}
          >
            {busy === "paused" ? "Pausing…" : "Pause"}
          </button>
        ) : goal.status === "paused" ? (
          <button
            type="button"
            className="text-sm px-3 py-1.5 rounded-full border hairline disabled:opacity-60"
            disabled={Boolean(busy)}
            onClick={() => patch({ status: "active" })}
          >
            {busy === "active" ? "Resuming…" : "Resume"}
          </button>
        ) : null}
        {goal.status !== "completed" && (
          <button
            type="button"
            className="text-sm px-3 py-1.5 rounded-full border hairline disabled:opacity-60"
            disabled={Boolean(busy)}
            onClick={() => patch({ status: "completed" })}
          >
            {busy === "completed" ? "Saving…" : "Mark complete"}
          </button>
        )}
        <button
          type="button"
          className="text-sm px-3 py-1.5 rounded-full text-[var(--warn)] disabled:opacity-60"
          disabled={Boolean(busy)}
          onClick={remove}
        >
          {busy === "delete" ? "Deleting…" : "Delete"}
        </button>
      </div>
      {error && <p className="text-sm text-[var(--warn)]">{error}</p>}
    </div>
  );
}

function ActionControls({
  id,
  status,
  onChanged,
}: {
  id: string;
  status: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState("");

  async function patch(next: "done" | "skipped") {
    setBusy(next);
    try {
      await api(`/api/actions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      onChanged();
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!confirm("Delete this action?")) return;
    setBusy("delete");
    try {
      await api(`/api/actions/${id}`, { method: "DELETE" });
      onChanged();
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {status === "active" && (
        <>
          <button
            type="button"
            className="text-sm px-3 py-1.5 rounded-full bg-[var(--accent-soft)] disabled:opacity-60"
            disabled={Boolean(busy)}
            onClick={() => patch("done")}
          >
            {busy === "done" ? "Saving…" : "Mark done"}
          </button>
          <button
            type="button"
            className="text-sm px-3 py-1.5 rounded-full bg-[var(--bg-2)] disabled:opacity-60"
            disabled={Boolean(busy)}
            onClick={() => patch("skipped")}
          >
            {busy === "skipped" ? "Saving…" : "Skip this week"}
          </button>
        </>
      )}
      <button
        type="button"
        className="text-sm px-3 py-1.5 rounded-full text-[var(--warn)] disabled:opacity-60"
        disabled={Boolean(busy)}
        onClick={remove}
      >
        {busy === "delete" ? "Deleting…" : "Delete"}
      </button>
    </div>
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

function NewAction({ onCreated, goals }: { onCreated: () => void; goals: Goal[] }) {
  const [text, setText] = useState("");
  const [trigger, setTrigger] = useState("I close my laptop");
  const [goalId, setGoalId] = useState(goals.find((g) => g.status === "active")?.id ?? goals[0]?.id ?? "");
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
            body: JSON.stringify({ text, trigger, goalId: goalId || undefined }),
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
      {goals.length > 0 && (
        <label className="block">
          <span className="kicker">For goal</span>
          <select
            className="mt-1 w-full h-12 rounded-2xl bg-[var(--bg)] border hairline px-3"
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
          >
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </label>
      )}
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

function GoalModal({
  goal,
  onClose,
  onSaved,
}: {
  goal: Goal | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const kr = goal?.keyResults[0];
  const [title, setTitle] = useState(goal?.title ?? "");
  const [why, setWhy] = useState(goal?.why ?? "");
  const [areaKey, setAreaKey] = useState(goal?.areaKey ?? "health");
  const [metricKey, setMetricKey] = useState(kr?.metricKey ?? "health.run_km");
  const [target, setTarget] = useState(String(kr?.target ?? 40));
  const [baseline, setBaseline] = useState(String(kr?.baseline ?? 15));
  const [dueOn, setDueOn] = useState(goal?.dueOn ?? "2027-03-01");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const editing = Boolean(goal);

  return (
    <div className="fixed inset-0 z-40 bg-black/40 grid place-items-end sm:place-items-center p-0 sm:p-6" onClick={onClose}>
      <form
        className="bg-[var(--card)] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-3"
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const payload = {
            title,
            why,
            areaKey,
            dueOn,
            metricKey,
            baseline: Number(baseline),
            target: Number(target),
            unit: METRIC_LABELS[metricKey]?.unit ?? "",
          };
          try {
            if (editing && goal) {
              await api(`/api/goals/${goal.id}`, {
                method: "PATCH",
                body: JSON.stringify(payload),
              });
            } else {
              await api("/api/goals", {
                method: "POST",
                body: JSON.stringify(payload),
              });
            }
            onSaved();
            onClose();
          } catch {
            setError(editing ? "Could not save that goal." : "Could not create that goal.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 className="display text-2xl">{editing ? "Edit goal" : "New goal"}</h2>
        <label className="block">
          <span className="kicker">Title</span>
          <input className="mt-1 w-full h-12 rounded-2xl border hairline px-3 bg-[var(--bg)]" placeholder="Run a half marathon" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="block">
          <span className="kicker">Why</span>
          <input className="mt-1 w-full h-12 rounded-2xl border hairline px-3 bg-[var(--bg)]" placeholder="A body that keeps up" value={why} onChange={(e) => setWhy(e.target.value)} />
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
        {error && <p className="text-sm text-[var(--warn)]">{error}</p>}
        <div className="flex gap-2">
          <button type="button" className="flex-1 py-3 rounded-full border hairline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary flex-1 py-3 rounded-full disabled:opacity-60" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save goal" : "Create goal"}
          </button>
        </div>
      </form>
    </div>
  );
}
