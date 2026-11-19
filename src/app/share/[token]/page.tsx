"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Share = {
  title: string;
  why: string;
  dueOn: string;
  current: number;
  target: number | null;
  unit: string;
  status: string;
};

export default function Page() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<Share | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error("missing");
        return r.json();
      })
      .then(setData)
      .catch(() => setError(true));
  }, [token]);

  if (error) {
    return (
      <main className="min-h-screen grid place-items-center px-6">
        <p>This share link is not active.</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="min-h-screen grid place-items-center">
        <p className="kicker">Loading</p>
      </main>
    );
  }
  return (
    <main className="min-h-screen grid place-items-center px-6 py-10">
      <div className="max-w-md w-full">
        <p className="kicker">Shared with consent</p>
        <h1 className="display text-4xl mt-3">{data.title}</h1>
        {data.why && <p className="text-[var(--muted)] mt-3">{data.why}</p>}
        <p className="card p-4 mt-6">
          {data.current} {data.unit} toward {data.target} {data.unit} · {data.status.replace("_", " ")} · due {data.dueOn}
        </p>
        <p className="text-sm text-[var(--muted)] mt-4">Journal, memory and other goals stay private.</p>
      </div>
    </main>
  );
}
