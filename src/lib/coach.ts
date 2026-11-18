import type { Finding } from "./types";
import { extractNumbers, numberAllowed, numbersInFindings } from "./validator";

export function groundedReply(
  question: string,
  findings: Finding[],
  goals: string[],
): { body: string; findingIds: string[] } {
  const q = question.toLowerCase();
  const scored = findings
    .map((f) => ({
      f,
      n:
        (f.summary + " " + f.metricKeys.join(" ")).toLowerCase().split(/\W+/).filter((w) => w.length > 3 && q.includes(w))
          .length + (goals.some((g) => q.includes(g.toLowerCase().slice(0, 8))) ? 1 : 0),
    }))
    .sort((a, b) => b.n - a.n || b.f.score - a.f.score);
  const picked = (scored[0]?.n ? scored.filter((s) => s.n === scored[0].n) : scored).slice(0, 3).map((s) => s.f);
  if (!picked.length) {
    return {
      body: "I don't have computed evidence for that yet. After about 6 data points I can talk about trends, not guesses.",
      findingIds: [],
    };
  }
  const parts = picked.map((f) => f.summary);
  const body = `From your numbers: ${parts.join(" ")} This is what the statistics show — I will not add figures that are not in those findings.`;
  const allowed = numbersInFindings(picked);
  const used = extractNumbers(body);
  if (used.some((n) => !numberAllowed(n, allowed))) {
    return { body: picked[0].summary, findingIds: [picked[0].id] };
  }
  return { body, findingIds: picked.map((f) => f.id) };
}
