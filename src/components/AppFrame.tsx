"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Flag, Home, Moon, Sparkles, Sun, MessageCircle, Layers, Mic, Ellipsis } from "lucide-react";
import { LoginView } from "./LoginView";
import { OnboardingView } from "./OnboardingView";

export type FindingView = {
  id: string;
  type: string;
  metricKeys: string[];
  stats: Record<string, number | string>;
  evidenceIds: string[];
  score: number;
  summary: string;
};

export type InsightView = {
  id: string;
  title: string;
  body: string;
  suggestedAction: string;
  confidence: string;
  evidence: FindingView[];
  shownAt: string;
  useful: boolean | null;
};

export type AppState = {
  profile: {
    id: string;
    email: string;
    displayName: string;
    tone: "gentle" | "direct";
    values: string[];
    constraints: string;
    pulseHour: number;
    quietStart: number;
    quietEnd: number;
    onboardingCompletedAt: string | null;
    sampleData: boolean;
    simulated: boolean;
    authVia: "cursor" | "password";
  };
  leading: InsightView | null;
  insights: InsightView[];
  wheel: { key: string; name: string; score: number | null; n: number }[];
  trends: { key: string; name: string; unit: string; points: { date: string; value: number }[] }[];
  goals: {
    id: string;
    title: string;
    why: string;
    vision: string;
    area: string;
    dueOn: string;
    status: string;
    keyResults: {
      id: string;
      metricKey: string;
      label: string;
      baseline: number;
      target: number;
      unit: string;
      dueOn: string;
      current: number;
      projected: number;
      slope: number;
      status: string;
      points: { date: string; value: number }[];
    }[];
  }[];
  actions: {
    id: string;
    text: string;
    trigger: string;
    status: string;
    dueOn: string | null;
    expected_metric: string | null;
    metricLabel: string | null;
  }[];
  heatmap: { key: string; label: string; days: { date: string; value: number }[] }[];
  memories: {
    id: string;
    layer: string;
    area_id: string | null;
    text: string;
    confidence: number;
    confirmed: boolean;
    paused: boolean;
    area: string;
    validUntil: string | null;
    source_response_id: string | null;
  }[];
  pendingRemember: { id: string; text: string; area: string }[];
  due: { kind: "pulse" | "weekly" | "monthly" | "audit"; label: string; detail: string } | null;
  completion: { done: number; active: number; total: number; rate: number };
  teaching: { wheel: string; trends: string; insights: string };
  checkIns: number;
    monthly: { wins: string[]; drifts: string[]; plan: string[] };
    sample: boolean;
    nudges: { id: string; kind: string; text: string }[];
    quality: { helpfulRate: number | null; actionRate: number; checkIns: number };
    offTrack: { id: string; title: string }[];
  };

const Ctx = createContext<{
  state: AppState | null;
  error: string | null;
  refresh: () => Promise<void>;
  setTheme: (t: "light" | "dark") => void;
  theme: "light" | "dark";
} | null>(null);

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp");
  return ctx;
}

export function AppFrame({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setThemeState] = useState<"light" | "dark">("light");
  const path = usePathname();

  const refresh = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (res.status === 401) {
      setState(null);
      try {
        sessionStorage.removeItem("ascend-state");
      } catch {
        /* ignore */
      }
      setError("signed-out");
      return;
    }
    if (!res.ok) {
      setError("load");
      return;
    }
    setError(null);
    const next = (await res.json()) as AppState;
    setState(next);
    try {
      sessionStorage.setItem("ascend-state", JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("ascend-theme") as "light" | "dark" | null;
    const next =
      stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setThemeState(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    refresh();
  }, [refresh]);

  function setTheme(t: "light" | "dark") {
    setThemeState(t);
    localStorage.setItem("ascend-theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }

  if (error === "signed-out") {
    return <LoginView />;
  }

  if (!state) {
    if (path === "/check-in") {
      return (
        <Ctx.Provider value={{ state: null, error, refresh, setTheme, theme }}>
          {children}
        </Ctx.Provider>
      );
    }
    return (
      <main className="min-h-screen grid place-items-center">
        <p className="kicker">Preparing your week</p>
      </main>
    );
  }

  if (!state.profile.onboardingCompletedAt && path !== "/onboarding") {
    return (
      <Ctx.Provider value={{ state, error, refresh, setTheme, theme }}>
        <OnboardingView />
      </Ctx.Provider>
    );
  }

  if (path === "/login") {
    return <>{children}</>;
  }

  const hideNav = path === "/check-in" || path === "/onboarding";

  return (
    <Ctx.Provider value={{ state, error, refresh, setTheme, theme }}>
      <div className={hideNav ? "min-h-screen" : "min-h-screen lg:grid lg:grid-cols-[220px_1fr]"}>
        {!hideNav && (
          <aside className="hidden lg:flex flex-col gap-8 px-6 py-8 border-r hairline">
            <Brand />
            <Nav />
            <div className="mt-auto space-y-3">
              <p className="text-xs text-[var(--muted)] leading-snug">
                {state.profile.displayName || "Signed in"}
                <span className="block truncate">{state.profile.email}</span>
              </p>
              <button
                type="button"
                className="inline-flex items-center gap-2 text-sm text-[var(--muted)]"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun size={16} className="shrink-0" /> : <Moon size={16} className="shrink-0" />}
                {theme === "dark" ? "Switch to light" : "Switch to dark"}
              </button>
            </div>
          </aside>
        )}
        <div className={hideNav ? "" : "pb-24 lg:pb-10"}>
          {!hideNav && (
            <header className="lg:hidden flex items-center justify-between px-5 py-4">
              <Brand />
              <button
                type="button"
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </header>
          )}
          {children}
        </div>
        {!hideNav && (
          <nav className="lg:hidden fixed bottom-0 inset-x-0 border-t hairline bg-[var(--bg)]">
            <Nav mobile />
          </nav>
        )}
      </div>
    </Ctx.Provider>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-baseline gap-2">
      <span className="display text-2xl">Ascend</span>
      <span className="kicker">v2</span>
    </Link>
  );
}

function navActive(path: string, href: string, mobile?: boolean) {
  if (path === href) return true;
  if (href !== "/more") return false;
  const nested = ["/memory", "/monthly", "/settings"];
  if (mobile) nested.push("/journal", "/coach", "/programs");
  return nested.some((p) => path === p || path.startsWith(`${p}/`));
}

function Nav({ mobile }: { mobile?: boolean }) {
  const path = usePathname();
  const items = mobile
    ? [
        { href: "/", label: "Home", icon: Home },
        { href: "/insights", label: "Insights", icon: Sparkles },
        { href: "/goals", label: "Goals", icon: Flag },
        { href: "/more", label: "More", icon: Ellipsis },
      ]
    : [
        { href: "/", label: "Home", icon: Home },
        { href: "/insights", label: "Insights", icon: Sparkles },
        { href: "/goals", label: "Goals", icon: Flag },
        { href: "/coach", label: "Coach", icon: MessageCircle },
        { href: "/programs", label: "Programs", icon: Layers },
        { href: "/journal", label: "Journal", icon: Mic },
        { href: "/more", label: "More", icon: Ellipsis },
      ];
  return (
    <ul className={mobile ? "grid grid-cols-4 py-2" : "space-y-1"}>
      {items.map((it) => {
        const on = navActive(path, it.href, mobile);
        const Icon = it.icon;
        return (
          <li key={it.href}>
            <Link
              href={it.href}
              className={`flex ${mobile ? "flex-col items-center gap-1 text-[11px]" : "items-center gap-3 px-3 py-2 rounded-xl text-sm"} ${
                on ? "text-[var(--accent)]" : "text-[var(--muted)]"
              }`}
            >
              <Icon size={mobile ? 20 : 18} strokeWidth={1.7} />
              {it.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function SampleBanner() {
  const { state, refresh } = useApp();
  const router = useRouter();
  if (!state?.sample) return null;
  return (
    <div className="card px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <p>
        This is <span className="font-medium">12 weeks of sample history</span> so you can see how
        insights work. Numbers are computed, not invented.
      </p>
      <button
        type="button"
        className="btn-primary shrink-0 rounded-full px-4 py-2 text-sm"
        onClick={async () => {
          await fetch("/api/sample", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "clear" }),
          });
          await refresh();
          router.push("/onboarding");
        }}
      >
        Start from my life
      </button>
    </div>
  );
}
