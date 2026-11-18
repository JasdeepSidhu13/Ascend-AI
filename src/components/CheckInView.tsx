"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { CRISIS_COPY } from "@/lib/crisis";
import type { QuestionType, SessionKind } from "@/lib/types";

type Q = {
  id: string;
  prompt: string;
  type: QuestionType;
  options: string[];
  reason: string;
  estSeconds: number;
  unit: string;
  followUpOf?: string | null;
};

type SessionPayload = {
  id: string;
  kind: SessionKind;
  questions: Q[];
  budget: { seconds: number; min: number; max: number };
};

export function CheckInView() {
  const params = useSearchParams();
  const kind = (params.get("kind") as SessionKind) || "pulse";
  const router = useRouter();
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { num?: number | null; text?: string | null; json?: unknown }>>({});
  const [phase, setPhase] = useState<"ask" | "reading" | "crisis">("ask");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SessionPayload>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ kind }),
    })
      .then((s) => {
        setSession(s);
        const draft = localStorage.getItem(`ascend-draft-${s.id}`);
        if (draft) {
          try {
            const parsed = JSON.parse(draft) as { index: number; answers: typeof answers };
            setAnswers(parsed.answers);
            setIndex(parsed.index);
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => setError("Could not start a check-in."));
  }, [kind]);

  const questions = useMemo(() => session?.questions ?? [], [session]);
  const q = questions[index];
  const remaining = useMemo(
    () => questions.slice(index).reduce((a, x) => a + (x.estSeconds || 10), 0),
    [questions, index],
  );

  useEffect(() => {
    if (!session) return;
    localStorage.setItem(
      `ascend-draft-${session.id}`,
      JSON.stringify({ index, answers }),
    );
  }, [session, index, answers]);

  async function submit(next: { num?: number | null; text?: string | null; json?: unknown }, skipped = false) {
    if (!session || !q) return;
    const result = await api<{ added: Q[] }>(`/api/sessions/${session.id}/answer`, {
      method: "POST",
      body: JSON.stringify({
        questionId: q.id,
        valueNum: next.num ?? null,
        valueText: next.text ?? null,
        valueJson: next.json ?? null,
        skipped,
      }),
    });
    setAnswers((a) => ({ ...a, [q.id]: next }));
    const added = result.added ?? [];
    if (added.length) {
      setSession((s) =>
        s
          ? {
              ...s,
              questions: [
                ...s.questions.slice(0, index + 1),
                ...added,
                ...s.questions.slice(index + 1).filter((x) => !added.some((n) => n.id === x.id)),
              ],
            }
          : s,
      );
    }
    const isLast = index >= questions.length - 1 && added.length === 0;
    if (isLast) {
      await finish(session.id);
      return;
    }
    setIndex((i) => i + 1);
  }

  async function finish(id: string) {
    setPhase("reading");
    const result = await api<{ crisis: boolean }>(`/api/sessions/${id}/complete`, { method: "POST" });
    localStorage.removeItem(`ascend-draft-${id}`);
    if (result.crisis) {
      setPhase("crisis");
      return;
    }
    setTimeout(() => router.push("/insights"), 700);
  }

  if (error) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <p>{error}</p>
      </main>
    );
  }

  if (phase === "crisis") {
    return (
      <main className="min-h-screen max-w-lg mx-auto px-6 py-16">
        <p className="kicker">Care first</p>
        <h1 className="display text-4xl mt-3">{CRISIS_COPY.title}</h1>
        <p className="mt-4 leading-relaxed">{CRISIS_COPY.body}</p>
        <ul className="mt-6 space-y-2">
          {CRISIS_COPY.resources.map((r) => (
            <li key={r.href}>
              <a className="underline underline-offset-4" href={r.href}>
                {r.label}
              </a>
            </li>
          ))}
        </ul>
        <button className="mt-10 underline" onClick={() => router.push("/")}>
          Back home
        </button>
      </main>
    );
  }

  if (phase === "reading") {
    return (
      <main className="min-h-screen grid place-items-center px-6 text-center">
        <div>
          <p className="kicker">Just a moment</p>
          <h1 className="display text-4xl mt-3">Your coach is reading this week</h1>
          <p className="text-[var(--muted)] mt-3">Statistics first. Then a sentence. Then a next step.</p>
        </div>
      </main>
    );
  }

  if (!session || !q) {
    return (
      <main className="min-h-screen grid place-items-center px-6 text-center">
        <p className="kicker">Choosing this week&apos;s questions</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto px-5 py-6 flex flex-col">
      <div className="flex items-center justify-between">
        <button className="text-sm text-[var(--muted)]" onClick={() => router.push("/")}>
          Close
        </button>
        <p className="kicker">
          {index + 1} of {questions.length} · ~{Math.max(1, Math.round(remaining / 60))} min
        </p>
      </div>
      <div className="h-1 bg-[var(--bg-2)] rounded-full mt-4">
        <div
          className="h-1 rounded-full bg-[var(--accent)]"
          style={{ width: `${((index + 1) / Math.max(questions.length, 1)) * 100}%` }}
        />
      </div>
      <p className="kicker mt-10">{q.reason}</p>
      <h1 className="display text-[2.1rem] leading-tight mt-3">{q.prompt}</h1>
      <div className="mt-8 flex-1">
        <Answer
          q={q}
          value={answers[q.id]}
          onSubmit={(v) => submit(v)}
        />
      </div>
      <button
        className="text-sm text-[var(--muted)] py-4"
        onClick={() => submit({}, true)}
      >
        Skip this one
      </button>
    </main>
  );
}

function Answer({
  q,
  value,
  onSubmit,
}: {
  q: Q;
  value?: { num?: number | null; text?: string | null; json?: unknown };
  onSubmit: (v: { num?: number | null; text?: string | null; json?: unknown }) => void;
}) {
  const [text, setText] = useState(value?.text ?? "");
  const [num, setNum] = useState<string>(value?.num != null ? String(value.num) : "");
  const [picked, setPicked] = useState<string[]>(
    Array.isArray(value?.json) ? (value?.json as string[]) : [],
  );

  if (q.type === "scale") {
    return (
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            className="h-14 rounded-2xl bg-[var(--card)] border hairline tabular text-lg"
            onClick={() => onSubmit({ num: n, text: String(n) })}
          >
            {n}
          </button>
        ))}
        <p className="col-span-5 flex justify-between text-sm text-[var(--muted)] mt-1">
          <span>Low</span>
          <span>High</span>
        </p>
      </div>
    );
  }
  if (q.type === "yes_no") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {["Yes", "No"].map((label) => (
          <button
            key={label}
            className="h-24 rounded-3xl bg-[var(--card)] border hairline text-xl"
            onClick={() => onSubmit({ text: label, num: label === "Yes" ? 1 : 0 })}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }
  if (q.type === "single") {
    return (
      <div className="space-y-2">
        {q.options.map((opt) => (
          <button
            key={opt}
            className="w-full text-left px-4 py-4 rounded-2xl bg-[var(--card)] border hairline"
            onClick={() => onSubmit({ text: opt })}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }
  if (q.type === "multi") {
    return (
      <div>
        <div className="flex flex-wrap gap-2">
          {q.options.map((opt) => {
            const on = picked.includes(opt);
            return (
              <button
                key={opt}
                className={`px-4 py-2 rounded-full border hairline ${on ? "bg-[var(--accent)] text-[var(--bg)]" : "bg-[var(--card)]"}`}
                onClick={() =>
                  setPicked((p) => (p.includes(opt) ? p.filter((x) => x !== opt) : [...p, opt]))
                }
              >
                {opt}
              </button>
            );
          })}
        </div>
        <button
          className="mt-6 w-full py-3 rounded-full bg-[var(--ink)] text-[var(--bg)]"
          onClick={() => onSubmit({ json: picked, text: picked.join(", ") })}
        >
          Continue
        </button>
      </div>
    );
  }
  if (q.type === "time") {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ text: text || "08:00" });
        }}
      >
        <input
          type="time"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full h-16 rounded-2xl bg-[var(--card)] border hairline px-4 text-xl"
        />
        <button className="w-full py-3 rounded-full bg-[var(--ink)] text-[var(--bg)]">Continue</button>
      </form>
    );
  }
  if (q.type === "number") {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(num);
          if (Number.isNaN(n)) return;
          onSubmit({ num: n, text: String(n) });
        }}
      >
        <div className="flex items-end gap-3">
          <input
            inputMode="decimal"
            value={num}
            onChange={(e) => setNum(e.target.value)}
            className="flex-1 h-16 rounded-2xl bg-[var(--card)] border hairline px-4 text-3xl tabular"
            aria-label={q.prompt}
          />
          <span className="text-[var(--muted)] pb-4">{q.unit}</span>
        </div>
        <button className="w-full py-3 rounded-full bg-[var(--ink)] text-[var(--bg)]">Continue</button>
      </form>
    );
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ text });
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="w-full rounded-2xl bg-[var(--card)] border hairline p-4"
        placeholder="A sentence is enough"
      />
      <button className="w-full py-3 rounded-full bg-[var(--ink)] text-[var(--bg)]">Continue</button>
    </form>
  );
}
