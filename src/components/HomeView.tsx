"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { SampleBanner, useApp, type AppState } from "./AppFrame";
import { Heatmap, LifeWheel, PaceBar, Sparkline } from "./charts";
import { EvidenceSheet, InsightCard } from "./InsightCard";
import { greeting } from "@/lib/dates";
import { api } from "@/lib/client";

export function HomeView() {
  const { state, refresh } = useApp();
  const s = state!;
  const [evidence, setEvidence] = useState<(typeof s.insights)[0] | null>(s.leading);
  const name = s.profile.displayName || "there";

  return (
    <main className="px-5 lg:px-10 max-w-5xl mx-auto space-y-8 py-2">
      <SampleBanner />
      <section className="flex flex-col gap-2 pt-2">
        <p className="kicker">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="display text-[2.4rem] leading-[1.05] sm:text-5xl">
          {greeting()}, {name}.
        </h1>
        <p className="text-[var(--muted)] max-w-xl">
          One insight on the table. Every number traces back to your answers.
        </p>
      </section>

      <ProgressMeter progress={s.progress} hasInsight={Boolean(s.leading)} />

      {(s.nudges ?? []).length > 0 && !s.due && (
        <p className="card p-4 text-sm">{s.nudges[0].text}</p>
      )}

      {(s.offTrack ?? []).length > 0 && (
        <section className="card p-5">
          <p className="kicker">Re-plan</p>
          <h2 className="display text-2xl mt-1">Pace slipped on {s.offTrack[0].title}</h2>
          <p className="text-[var(--muted)] mt-2">
            Shrink this week&apos;s action instead of repeating a miss. Goals stay; the step gets smaller.
          </p>
          <Link href="/goals" className="inline-block mt-3 underline underline-offset-4">
            Open goals
          </Link>
        </section>
      )}

      {s.due ? (
        <Link
          href={`/check-in?kind=${s.due.kind}`}
          className="card p-5 sm:p-6 flex items-center justify-between gap-4 group"
        >
          <div>
            <p className="kicker">Due now</p>
            <h2 className="display text-3xl mt-2">{s.due.label}</h2>
            <p className="text-[var(--muted)] mt-1">{s.due.detail}</p>
          </div>
          <span className="h-12 w-12 rounded-full bg-[var(--accent)] text-white grid place-items-center group-hover:translate-x-0.5 transition" aria-hidden>
            <ArrowRight size={20} />
          </span>
        </Link>
      ) : (
        <Link href="/check-in?kind=pulse" className="text-sm underline underline-offset-4">
          Start a daily pulse
        </Link>
      )}

      {s.pendingRemember.length > 0 && (
        <section className="space-y-3">
          <p className="kicker">Remember this?</p>
          {s.pendingRemember.map((m) => (
            <div key={m.id} className="card p-4 flex items-start justify-between gap-3">
              <div>
                <p>{m.text}</p>
                <p className="text-sm text-[var(--muted)] mt-1">{m.area} · health, money and relationship facts wait for a tap</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  className="text-sm px-3 py-1.5 rounded-full bg-[var(--accent-soft)]"
                  onClick={async () => {
                    await api(`/api/memories/${m.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ confirmed: true }),
                    });
                    refresh();
                  }}
                >
                  Keep
                </button>
                <button
                  type="button"
                  className="text-sm px-3 py-1.5 rounded-full bg-[var(--bg-2)]"
                  onClick={async () => {
                    await api(`/api/memories/${m.id}`, { method: "DELETE" });
                    refresh();
                  }}
                >
                  Forget
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section>
        <p className="kicker mb-3">This week&apos;s insight</p>
        {s.leading ? (
          <InsightCard insight={s.leading} onOpen={() => setEvidence(s.leading)} onRated={refresh} featured />
        ) : (
          <div className="card p-6">
            <h2 className="display text-2xl">Insights wait for evidence</h2>
            <p className="text-[var(--muted)] mt-2">{s.teaching.insights}</p>
          </div>
        )}
      </section>

      <FeaturedGoal goals={s.goals} />

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <p className="kicker">Life wheel</p>
          <h2 className="display text-2xl mt-1 mb-2">How the areas sit</h2>
          {s.wheel.every((w) => w.score == null) ? (
            <p className="text-[var(--muted)]">{s.teaching.wheel}</p>
          ) : (
            <LifeWheel items={s.wheel} />
          )}
          <ul className="mt-2 grid grid-cols-2 gap-2 text-sm">
            {s.wheel.map((w) => (
              <li key={w.key} className="flex justify-between">
                <span className="text-[var(--muted)]">{w.name}</span>
                <span className="tabular">{w.score ?? "—"}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <p className="kicker">Actions</p>
          <h2 className="display text-2xl mt-1 mb-3">At most three this week</h2>
          <p className="text-sm text-[var(--muted)] mb-4">
            {s.completion.done} done · {s.completion.active} active
          </p>
          <ul className="space-y-3">
            {s.actions.filter((a) => a.status === "active").slice(0, 3).map((a) => (
              <li key={a.id} className="border-t hairline pt-3">
                <p>{a.text}</p>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    className="text-sm px-3 py-1.5 rounded-full bg-[var(--accent-soft)]"
                    onClick={async () => {
                      await api(`/api/actions/${a.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ status: "done" }),
                      });
                      refresh();
                    }}
                  >
                    Mark done
                  </button>
                  <button
                    type="button"
                    className="text-sm px-3 py-1.5 rounded-full bg-[var(--bg-2)]"
                    onClick={async () => {
                      await api(`/api/actions/${a.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ status: "skipped" }),
                      });
                      refresh();
                    }}
                  >
                    Skip this week
                  </button>
                </div>
              </li>
            ))}
            {s.actions.filter((a) => a.status === "active").length === 0 && (
              <p className="text-[var(--muted)]">No active actions. Insights will suggest one when they have evidence.</p>
            )}
          </ul>
        </div>
      </section>

      <section className="card p-5">
        <p className="kicker">Habits</p>
        <h2 className="display text-2xl mt-1 mb-4">A missed day pauses a streak; it does not reset it</h2>
        {s.heatmap.every((h) => h.days.length === 0) ? (
          <p className="text-[var(--muted)]">Daily pulses fill this heatmap. A few days is enough to see a pattern.</p>
        ) : (
          <Heatmap rows={s.heatmap} />
        )}
      </section>

      <section className="grid sm:grid-cols-2 gap-4">
        {s.trends.slice(0, 4).map((t) => (
          <div key={t.key} className="card p-4">
            <p className="text-sm text-[var(--muted)]">{t.name}</p>
            {t.points.length < 4 ? (
              <p className="text-sm mt-2 text-[var(--muted)]">{s.teaching.trends}</p>
            ) : (
              <Sparkline points={t.points} />
            )}
          </div>
        ))}
      </section>

      <p className="text-sm text-[var(--muted)] pb-4">
        <Link href="/settings" className="underline underline-offset-4">
          Settings, export, delete
        </Link>
        {" · "}
        <Link href="/monthly" className="underline underline-offset-4">
          Monthly review
        </Link>
      </p>

      {evidence && <EvidenceSheet insight={evidence} onClose={() => setEvidence(null)} />}
    </main>
  );
}

function FeaturedGoal({ goals }: { goals: AppState["goals"] }) {
  const active = goals.filter((g) => g.status === "active");
  const focus =
    active.find((g) => g.keyResults.some((kr) => kr.status === "off_track")) ??
    active.find((g) => g.keyResults.some((kr) => kr.status === "at_risk")) ??
    active[0];
  const rest = active.filter((g) => g.id !== focus?.id);
  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="kicker">This quarter</p>
          <h2 className="display text-2xl mt-1">{focus ? focus.title : "No active goal"}</h2>
        </div>
        <Link href="/goals" className="text-sm underline underline-offset-4 shrink-0">
          All goals
        </Link>
      </div>
      {!focus ? (
        <p className="text-[var(--muted)] mt-3">Add one numbered goal. Home will keep the one that needs you.</p>
      ) : (
        focus.keyResults.slice(0, 1).map((kr) => (
          <div key={kr.id} className="mt-3">
            <p className="text-sm text-[var(--muted)]">
              <span className="tabular">{kr.current} {kr.unit}</span>
              {" "}now · projected {kr.projected} · {kr.target} {kr.unit} by {kr.dueOn}
            </p>
            <PaceBar
              baseline={kr.baseline}
              current={kr.current}
              target={kr.target}
              projected={kr.projected}
              status={kr.status}
            />
            <Sparkline points={kr.points} target={kr.target} />
          </div>
        ))
      )}
      {rest.length > 0 && (
        <ul className="mt-4 pt-3 border-t hairline space-y-1 text-sm text-[var(--muted)]">
          {rest.map((g) => (
            <li key={g.id} className="flex justify-between gap-3">
              <span className="truncate">{g.title}</span>
              <span className="kicker shrink-0">{g.area}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProgressMeter({
  progress,
  hasInsight,
}: {
  progress?: { mornings: number; earlyAt: number; firmAt: number };
  hasInsight: boolean;
}) {
  const mornings = progress?.mornings ?? 0;
  const earlyAt = progress?.earlyAt ?? 3;
  const firmAt = progress?.firmAt ?? 6;
  if (mornings >= firmAt && hasInsight) return null;
  const pct = Math.min(100, Math.round((mornings / firmAt) * 100));
  const label =
    mornings < earlyAt
      ? `${mornings} of ${earlyAt} mornings toward a first cited sentence.`
      : mornings < firmAt
        ? `A cautious sentence can appear now. ${mornings} of ${firmAt} toward a firmer trend.`
        : `${mornings} mornings logged. Insights stay on Home.`;
  return (
    <section className="card p-5">
      <p className="kicker">Time to first insight</p>
      <p className="mt-2">{label}</p>
      <div className="mt-3 h-2 rounded-full bg-[var(--bg-2)]" aria-hidden>
        <div className="h-2 rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
      </div>
    </section>
  );
}
