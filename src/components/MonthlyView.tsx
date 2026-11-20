"use client";

import { SampleBanner, useApp } from "./AppFrame";
import { LifeWheel } from "./charts";

export function MonthlyView() {
  const { state } = useApp();
  const s = state!;
  return (
    <main className="px-5 lg:px-10 max-w-2xl mx-auto py-4 space-y-6 print:px-0">
      <SampleBanner />
      <header className="flex items-end justify-between">
        <div>
          <p className="kicker">Monthly review</p>
          <h1 className="display text-4xl mt-2">
            {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </h1>
        </div>
        <button
          type="button"
          className="px-4 py-2 rounded-full border hairline text-sm print:hidden"
          onClick={() => window.print()}
        >
          Print or save PDF
        </button>
      </header>
      <section className="card p-5">
        <p className="kicker">Wins</p>
        <ul className="mt-3 space-y-2">
          {s.monthly.wins.length ? s.monthly.wins.map((w) => <li key={w}>{w}</li>) : <li>Keep checking in — wins appear once streaks and lifts show up.</li>}
        </ul>
      </section>
      <section className="card p-5">
        <p className="kicker">Drifts</p>
        <ul className="mt-3 space-y-2">
          {s.monthly.drifts.length ? s.monthly.drifts.map((w) => <li key={w}>{w} is sitting under 6</li>) : <li>No area is sitting quietly low.</li>}
        </ul>
      </section>
      <section className="card p-5">
        <p className="kicker">Plan for next month</p>
        <ul className="mt-3 space-y-2">
          {s.monthly.plan.length ? s.monthly.plan.map((w) => <li key={w}>Re-plan: {w}</li>) : <li>Hold the current goals. No re-plan needed.</li>}
        </ul>
      </section>
      <div className="card p-5">
        <LifeWheel items={s.wheel} />
      </div>
    </main>
  );
}
