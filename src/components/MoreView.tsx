"use client";

import Link from "next/link";
import { useApp } from "./AppFrame";

export function MoreView() {
  const { state } = useApp();
  const q = state?.quality;
  return (
    <main className="px-5 max-w-lg mx-auto py-4 space-y-4">
      <header>
        <p className="kicker">More</p>
        <h1 className="display text-4xl mt-2">The rest of the room</h1>
      </header>
      {q && (
        <p className="card p-4 text-sm text-[var(--muted)]">
          Helpful insights {q.helpfulRate == null ? "—" : `${q.helpfulRate}%`} · actions done {q.actionRate}% · check-ins {q.checkIns}
        </p>
      )}
      <nav className="grid gap-2">
        {[
          ["/check-in?kind=pulse", "Daily pulse", "Sixty seconds. Energy, mood, habits"],
          ["/memory", "Memory", "Facts you can edit, pause or forget"],
          ["/coach", "Coach chat", "Questions grounded in your findings"],
          ["/programs", "Programs", "Sleep, career, race packs, plus your questions"],
          ["/journal", "Voice journal", "Speak a reflection"],
          ["/monthly", "Monthly review", "Wins, drifts, print or save PDF"],
          ["/check-in?kind=audit", "Quarterly audit", "Every area, then reset goals"],
          ["/settings", "Settings", "Tone, reminders, export, delete"],
        ].map(([href, title, blurb]) => (
          <Link key={href} href={href} className="card p-4 block">
            <p className="display text-2xl">{title}</p>
            <p className="text-sm text-[var(--muted)] mt-1">{blurb}</p>
          </Link>
        ))}
      </nav>
    </main>
  );
}
