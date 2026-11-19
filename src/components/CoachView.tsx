"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { SampleBanner, useApp } from "./AppFrame";

type Msg = { id: string; role: string; body: string };

export function CoachView() {
  useApp();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ messages: Msg[] }>("/api/coach")
      .then((r) => setMessages(r.messages ?? []))
      .catch(() => setMessages([]));
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 3 || busy) return;
    setBusy(true);
    const mine = { id: "tmp", role: "user", body: text.trim() };
    setMessages((m) => [...m, mine]);
    setText("");
    try {
      const reply = await api<{ body: string; findingIds: string[] }>("/api/coach", {
        method: "POST",
        body: JSON.stringify({ message: mine.body }),
      });
      setMessages((m) => [...m, { id: "c", role: "coach", body: reply.body }]);
    } catch {
      setMessages((m) => [...m, { id: "e", role: "coach", body: "I could not answer just then. Try a shorter question about a metric." }]);
    }
    setBusy(false);
  }

  return (
    <main className="px-5 lg:px-10 max-w-2xl mx-auto py-4 space-y-4">
      <SampleBanner />
      <header>
        <p className="kicker">Coach</p>
        <h1 className="display text-4xl mt-2">Ask about your own numbers</h1>
        <p className="text-[var(--muted)] mt-2">
          Answers are grounded in computed findings. If the statistics are not there yet, the coach will say so.
        </p>
      </header>
      <div className="space-y-3 min-h-48">
        {messages.length === 0 && (
          <p className="card p-4 text-sm text-[var(--muted)]">
            Try “why was sleep off?” or “am I on pace for the run goal?”
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`card p-4 ${m.role === "user" ? "bg-[var(--bg-2)]" : ""}`}>
            <p className="kicker">{m.role === "user" ? "You" : "Coach"}</p>
            <p className="mt-2 leading-relaxed">{m.body}</p>
          </div>
        ))}
      </div>
      <form className="flex gap-2" onSubmit={send}>
        <input
          className="flex-1 h-12 rounded-2xl border hairline px-3 bg-[var(--card)]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask about a metric"
          aria-label="Message to coach"
        />
        <button
          type="submit"
          className="btn-primary h-12 px-5 rounded-full disabled:opacity-60"
          disabled={busy || text.trim().length < 3}
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </form>
    </main>
  );
}
