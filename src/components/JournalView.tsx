"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { SampleBanner, useApp } from "./AppFrame";

type Entry = { id: string; text: string; created_at: string };

export function JournalView() {
  useApp();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ entries: Entry[] }>("/api/journal")
      .then((r) => setEntries(r.entries ?? []))
      .catch(() => setEntries([]));
  }, []);

  function listen() {
    const SR = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition
      ?? (window as unknown as { SpeechRecognition?: new () => SpeechRec }).SpeechRecognition;
    if (!SR) {
      setText((t) => t || "Voice is not available in this browser — type the reflection instead.");
      return;
    }
    const rec = new SR();
    rec.lang = "en-GB";
    rec.onresult = (e: { results: { 0: { 0: { transcript: string } } } }) => {
      setText((t) => `${t} ${e.results[0][0].transcript}`.trim());
    };
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  async function save() {
    if (text.trim().length < 8 || saving) return;
    setSaving(true);
    try {
      await api("/api/journal", { method: "POST", body: JSON.stringify({ text }) });
      const next = await api<{ entries: Entry[] }>("/api/journal");
      setEntries(next.entries ?? []);
      setText("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="px-5 lg:px-10 max-w-2xl mx-auto py-4 space-y-4">
      <SampleBanner />
      <header>
        <p className="kicker">Voice journal</p>
        <h1 className="display text-4xl mt-2">Speak a reflection</h1>
        <p className="text-[var(--muted)] mt-2">
          Transcribed in the browser, stored for recall. Nothing is sent to a speech vendor.
        </p>
      </header>
      <textarea
        className="w-full min-h-32 rounded-2xl border hairline p-3 bg-[var(--card)]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What happened, in a few sentences"
        aria-label="Journal reflection"
      />
      <div className="flex gap-2">
        <button type="button" className="px-4 py-2 rounded-full border hairline" onClick={listen}>
          {listening ? "Listening…" : "Start speaking"}
        </button>
        <button
          type="button"
          className="btn-primary px-4 py-2 rounded-full disabled:opacity-60"
          onClick={save}
          disabled={text.trim().length < 8 || saving}
        >
          {saving ? "Saving…" : "Save reflection"}
        </button>
      </div>
      {text.trim().length > 0 && text.trim().length < 8 && (
        <p className="text-sm text-[var(--muted)]">A short sentence is enough — at least 8 characters.</p>
      )}
      <ul className="space-y-3">
        {entries.map((e) => (
          <li key={e.id} className="card p-4">
            <p className="kicker">{new Date(e.created_at).toLocaleString()}</p>
            <p className="mt-2">{e.text}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}

type SpeechRec = {
  lang: string;
  start: () => void;
  onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
};
