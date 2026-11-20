"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import type { InsightView } from "./AppFrame";

export function InsightCard({
  insight,
  onOpen,
  onRated,
  featured,
}: {
  insight: InsightView;
  onOpen?: () => void;
  onRated?: () => void;
  featured?: boolean;
}) {
  return (
    <article className={`card p-5 sm:p-6 ${featured ? "sm:p-8" : ""}`}>
      <p className="kicker">{insight.confidence} confidence · computed, then told</p>
      <h2 className={`display mt-2 ${featured ? "text-3xl sm:text-4xl" : "text-2xl"}`}>{insight.title}</h2>
      <p className="mt-3 leading-relaxed text-[1.05rem]">{insight.body}</p>
      {insight.suggestedAction && (
        <p className="mt-4 text-[var(--muted)]">
          <span className="kicker">Next step</span>
          <span className="block mt-1 text-[var(--ink)]">{insight.suggestedAction}</span>
        </p>
      )}
      {featured && <InsightActions id={insight.id} hasStep={Boolean(insight.suggestedAction)} onDone={onRated} />}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {onOpen && (
          <button type="button" className="text-sm underline underline-offset-4" onClick={onOpen}>
            See evidence
          </button>
        )}
        <Rating id={insight.id} useful={insight.useful} onRated={onRated} />
      </div>
    </article>
  );
}

function InsightActions({
  id,
  hasStep,
  onDone,
}: {
  id: string;
  hasStep: boolean;
  onDone?: () => void;
}) {
  const [busy, setBusy] = useState<"take" | "shrink" | null>(null);
  const [note, setNote] = useState("");

  async function act(kind: "take" | "shrink") {
    setBusy(kind);
    setNote("");
    try {
      const res = await api<{ text?: string }>(`/api/insights/${id}/act`, {
        method: "POST",
        body: JSON.stringify({ kind }),
      });
      setNote(kind === "take" ? "This week’s step is on Home." : `Shrunk to: ${res.text ?? "a smaller step"}`);
      onDone?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "max_active") setNote("You already have three actions. Finish or shrink one first.");
      else if (msg === "no_action" || msg === "no_step") setNote("No active step to change yet.");
      else setNote("Could not update that step.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-5 space-y-2">
      <div className="flex flex-wrap gap-2">
        {hasStep && (
          <button
            type="button"
            className="btn-primary px-4 py-2 rounded-full text-sm disabled:opacity-60"
            disabled={busy != null}
            onClick={() => act("take")}
          >
            {busy === "take" ? "Saving…" : "Take this step"}
          </button>
        )}
        <button
          type="button"
          className="px-4 py-2 rounded-full text-sm border hairline disabled:opacity-60"
          disabled={busy != null}
          onClick={() => act("shrink")}
        >
          {busy === "shrink" ? "Shrinking…" : "Shrink last week’s step"}
        </button>
      </div>
      {note && <p className="text-sm text-[var(--muted)]">{note}</p>}
    </div>
  );
}

function Rating({
  id,
  useful,
  onRated,
}: {
  id: string;
  useful: boolean | null;
  onRated?: () => void;
}) {
  const [sent, setSent] = useState(useful);
  async function rate(value: boolean) {
    setSent(value);
    await api(`/api/insights/${id}/feedback`, {
      method: "POST",
      body: JSON.stringify({ useful: value }),
    });
    onRated?.();
  }
  return (
    <div className="flex gap-2 ml-auto">
      <button
        type="button"
        aria-pressed={sent === true}
        className={`text-sm px-3 py-1.5 rounded-full ${sent === true ? "bg-[var(--accent)] text-[var(--bg)]" : "bg-[var(--bg-2)]"}`}
        onClick={() => rate(true)}
      >
        Helpful
      </button>
      <button
        type="button"
        aria-pressed={sent === false}
        className={`text-sm px-3 py-1.5 rounded-full ${sent === false ? "btn-primary" : "bg-[var(--bg-2)]"}`}
        onClick={() => rate(false)}
      >
        Not helpful
      </button>
    </div>
  );
}

export function EvidenceSheet({
  insight,
  onClose,
}: {
  insight: InsightView;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <div
        className="bg-[var(--card)] w-full max-w-lg rounded-t-3xl sm:rounded-3xl border hairline max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="evidence-title"
      >
        <p className="kicker">Evidence</p>
        <h3 id="evidence-title" className="display text-2xl mt-1">
          Where the numbers come from
        </h3>
        <p className="text-[var(--muted)] mt-2 text-sm">
          Statistics ran in code. The sentence only explains findings it was handed.
        </p>
        <ul className="mt-5 space-y-4">
          {insight.evidence.map((f) => (
            <li key={f.id} className="border-t hairline pt-4">
              <p className="kicker">{f.type}</p>
              <p className="mt-1">{f.summary}</p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                {Object.entries(f.stats).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[var(--muted)]">{k.replace(/_/g, " ")}</dt>
                    <dd className="tabular font-medium">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
          {insight.evidence.length === 0 && <p>No attached findings.</p>}
        </ul>
        <button type="button" className="btn-primary mt-6 w-full py-3 rounded-full" onClick={onClose}>
          Close evidence
        </button>
      </div>
    </div>
  );
}
