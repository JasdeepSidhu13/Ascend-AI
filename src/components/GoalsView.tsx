"use client";

import { useEffect, useMemo, useState } from "react";
import { AREAS, METRIC_LABELS } from "@/lib/catalog";
import { api } from "@/lib/client";
import { SampleBanner, useApp, type AppState } from "./AppFrame";
import { PaceBar, Sparkline } from "./charts";

type Goal = AppState["goals"][number];
type Action = AppState["actions"][number];

function paceLabel(status: string) {
  return status.replaceAll("_", " ");
}

export function GoalsView() {
  const { state, refresh } = useApp();
  const s = state!;
  const active = s.goals.filter((g) => g.status === "active");
  const parked = s.goals.filter((g) => g.status !== "active");
  const focusId =
    active.find((g) => g.keyResults.some((kr) => kr.status === "off_track"))?.id ??
    active.find((g) => g.keyResults.some((kr) => kr.status === "at_risk"))?.id ??
    active[0]?.id ??
    null;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [expanded, setExpanded] = useState<string | null>(focusId);
  const [showParked, setShowParked] = useState(false);

  const actionsByGoal = useMemo(() => {
    const map = new Map<string, Action[]>();
    for (const a of s.actions) {
      const key = a.goalId ?? "";
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    return map;
  }, [s.actions]);

  return (
    <main className="px-5 lg:px-10 max-w-3xl mx-auto py-4 space-y-8">
      <SampleBanner />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="kicker">This quarter</p>
          <h1 className="display text-4xl mt-2">One goal per measure</h1>
          <p className="text-[var(--muted)] mt-2 max-w-md">
            {active.length === 0
              ? "Add a goal with a number. Home will keep the one that needs you."
              : `${active.length} active · duplicates of the same measure are parked automatically.`}
          </p>
        </div>
        <button
          type="button"
          className="btn-primary px-4 py-2 rounded-full text-sm self-start shrink-0"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          New goal
        </button>
      </header>

      {active.length === 0 ? (
        <div className="card p-6">
          <h2 className="display text-2xl">Nothing on the board yet</h2>
          <p className="text-[var(--muted)] mt-2">A title, a metric, a due date. That is enough.</p>
        </div>
      ) : (
        <section className="card overflow-hidden">
          {active.map((g, i) => (
            <GoalRow
              key={g.id}
              goal={g}
              actions={actionsByGoal.get(g.id) ?? []}
              expanded={expanded === g.id}
              first={i === 0}
              onToggle={() => setExpanded((cur) => (cur === g.id ? null : g.id))}
              onEdit={() => {
                setEditing(g);
                setOpen(true);
              }}
              onChanged={refresh}
            />
          ))}
        </section>
      )}

      {(actionsByGoal.get("") ?? []).filter((a) => a.status === "active").length > 0 && (
        <section>
          <p className="kicker mb-3">This week, unattached</p>
          <ul className="card divide-y divide-[var(--line)]">
            {(actionsByGoal.get("") ?? [])
              .filter((a) => a.status === "active")
              .map((a) => (
                <li key={a.id} className="p-4">
                  <p>{a.text}</p>
                  <ActionControls id={a.id} status={a.status} onChanged={refresh} />
                </li>
              ))}
          </ul>
        </section>
      )}

      {s.goals.length > 0 && (
        <NewAction onCreated={refresh} goals={active.length ? active : s.goals} />
      )}

      {parked.length > 0 && (
        <section>
          <button
            type="button"
            className="kicker"
            onClick={() => setShowParked((v) => !v)}
            aria-expanded={showParked}
          >
            Parked · {parked.length} {showParked ? "▾" : "▸"}
          </button>
          {showParked && (
            <ul className="card mt-3 divide-y divide-[var(--line)]">
              {parked.map((g) => (
                <li key={g.id} className="p-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{g.title}</p>
                    <p className="kicker mt-1">
                      {g.area} · {paceLabel(g.status)}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {g.status === "paused" && (
                      <button
                        type="button"
                        className="text-sm underline underline-offset-4"
                        onClick={async () => {
                          await api(`/api/goals/${g.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ status: "active" }),
                          });
                          refresh();
                        }}
                      >
                        Resume
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-sm text-[var(--warn)] underline underline-offset-4"
                      onClick={async () => {
                        if (!confirm(`Delete “${g.title}”?`)) return;
                        await api(`/api/goals/${g.id}`, { method: "DELETE" });
                        refresh();
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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

function GoalRow({
  goal,
  actions,
  expanded,
  first,
  onToggle,
  onEdit,
  onChanged,
}: {
  goal: Goal;
  actions: Action[];
  expanded: boolean;
  first: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const kr = goal.keyResults[0];
  const pace = kr?.status ?? goal.status;
  return (
    <article className={first ? "" : "border-t hairline"}>
      <button
        type="button"
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <p className="kicker">
            {goal.area}
            {kr ? ` · ${paceLabel(pace)}` : ""}
          </p>
          <h2 className="display text-2xl mt-1 truncate">{goal.title}</h2>
          {kr && (
            <p className="text-sm text-[var(--muted)] mt-1 tabular">
              {kr.current} {kr.unit} now · {kr.target} {kr.unit} by {kr.dueOn}
            </p>
          )}
        </div>
        <span className="kicker shrink-0 mt-1">{expanded ? "Hide" : "Open"}</span>
      </button>
      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {goal.why && <p className="text-[var(--muted)]">{goal.why}</p>}
          {kr && (
            <div>
              <PaceBar
                baseline={kr.baseline}
                current={kr.current}
                target={kr.target}
                projected={kr.projected}
                status={kr.status}
              />
              <p className="text-sm text-[var(--muted)] mt-2">
                Projected {kr.projected} {kr.unit}
              </p>
              <div className="mt-3">
                <Sparkline points={kr.points} target={kr.target} />
              </div>
            </div>
          )}
          {actions.filter((a) => a.status === "active").length > 0 && (
            <div>
              <p className="kicker mb-2">This week</p>
              <ul className="space-y-3">
                {actions
                  .filter((a) => a.status === "active")
                  .map((a) => (
                    <li key={a.id}>
                      <p>{a.text}</p>
                      <ActionControls id={a.id} status={a.status} onChanged={onChanged} />
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <GoalControls goal={goal} onEdit={onEdit} onChanged={onChanged} />
        </div>
      )}
    </article>
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
  const [shareUrl, setShareUrl] = useState("");

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

  return (
    <div className="space-y-2">
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
          className="text-sm px-3 py-1.5 rounded-full border hairline disabled:opacity-60"
          disabled={Boolean(busy)}
          onClick={async () => {
            try {
              const res = await api<{ token: string }>("/api/share", {
                method: "POST",
                body: JSON.stringify({ goalId: goal.id }),
              });
              const next = `${window.location.origin}/share/${res.token}`;
              setShareUrl(next);
              await navigator.clipboard.writeText(next).catch(() => undefined);
            } catch {
              setError("Could not create a share link.");
            }
          }}
        >
          Share
        </button>
        <button
          type="button"
          className="text-sm px-3 py-1.5 rounded-full text-[var(--warn)] disabled:opacity-60"
          disabled={Boolean(busy)}
          onClick={async () => {
            if (!confirm(`Delete “${goal.title}”? This cannot be undone.`)) return;
            setBusy("delete");
            try {
              await api(`/api/goals/${goal.id}`, { method: "DELETE" });
              onChanged();
            } catch {
              setError("Could not delete that goal.");
            } finally {
              setBusy("");
            }
          }}
        >
          {busy === "delete" ? "Deleting…" : "Delete"}
        </button>
      </div>
      {shareUrl && <p className="text-sm text-[var(--muted)] break-all">Copied. {shareUrl}</p>}
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
            {busy === "skipped" ? "Saving…" : "Skip"}
          </button>
        </>
      )}
      <button
        type="button"
        className="text-sm px-3 py-1.5 rounded-full text-[var(--warn)] disabled:opacity-60"
        disabled={Boolean(busy)}
        onClick={async () => {
          if (!confirm("Delete this action?")) return;
          setBusy("delete");
          try {
            await api(`/api/actions/${id}`, { method: "DELETE" });
            onChanged();
          } finally {
            setBusy("");
          }
        }}
      >
        {busy === "delete" ? "Deleting…" : "Delete"}
      </button>
    </div>
  );
}

function NewAction({ onCreated, goals }: { onCreated: () => void; goals: Goal[] }) {
  const [text, setText] = useState("");
  const [trigger, setTrigger] = useState("I close my laptop");
  const [goalId, setGoalId] = useState(goals[0]?.id ?? "");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!goals.some((g) => g.id === goalId)) setGoalId(goals[0]?.id ?? "");
  }, [goals, goalId]);
  return (
    <form
      className="card p-5 space-y-3"
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
              ? "You already have three active actions. Finish one first."
              : "Could not add that action.",
          );
        }
      }}
    >
      <p className="kicker">Add a step</p>
      <p className="text-sm text-[var(--muted)]">When [trigger], I will [action]. At most three active.</p>
      {goals.length > 0 && (
        <label className="block">
          <span className="kicker">For</span>
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
  const [metricKey, setMetricKey] = useState(kr?.metricKey ?? "health.sleep_hours");
  const [target, setTarget] = useState(String(kr?.target ?? 7.5));
  const [baseline, setBaseline] = useState(String(kr?.baseline ?? 6));
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
          } catch (err) {
            const code = err instanceof Error ? err.message : "";
            if (code === "duplicate_metric") {
              setError("You already have an active goal for that measure. Open it instead of adding another.");
            } else {
              setError(editing ? "Could not save that goal." : "Could not create that goal.");
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 className="display text-2xl">{editing ? "Edit goal" : "New goal"}</h2>
        <label className="block">
          <span className="kicker">Title</span>
          <input className="mt-1 w-full h-12 rounded-2xl border hairline px-3 bg-[var(--bg)]" placeholder="Sleep 7.5 hours most nights" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="block">
          <span className="kicker">Why</span>
          <input className="mt-1 w-full h-12 rounded-2xl border hairline px-3 bg-[var(--bg)]" placeholder="Energy needs a floor under it" value={why} onChange={(e) => setWhy(e.target.value)} />
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
