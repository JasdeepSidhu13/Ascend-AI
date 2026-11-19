"use client";

type WheelItem = { key: string; name: string; score: number | null; n: number };

export function LifeWheel({
  items,
  onSelect,
}: {
  items: WheelItem[];
  onSelect?: (key: string) => void;
}) {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const r = 92;
  const n = items.length || 1;
  const pts = items.map((it, i) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    const score = it.score ?? 0;
    const rr = (score / 10) * r;
    return { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, lx: cx + Math.cos(a) * 118, ly: cy + Math.sin(a) * 118, a, it };
  });
  const poly = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const rings = [2, 4, 6, 8, 10];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[320px] mx-auto" role="img" aria-label="Life wheel">
      {rings.map((ring) => (
        <polygon
          key={ring}
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
          points={items
            .map((_, i) => {
              const a = (Math.PI * 2 * i) / n - Math.PI / 2;
              const rr = (ring / 10) * r;
              return `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`;
            })
            .join(" ")}
        />
      ))}
      {pts.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={p.lx} y2={p.ly} stroke="var(--line)" strokeWidth="1" />
      ))}
      <polygon points={poly} fill="var(--accent)" fillOpacity="0.18" stroke="var(--accent)" strokeWidth="2" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="var(--accent)" />
          <text
            x={p.lx}
            y={p.ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--ink)"
            fontSize="11"
            className={onSelect ? "cursor-pointer" : undefined}
            onClick={onSelect ? () => onSelect(p.it.key) : undefined}
          >
            {p.it.name}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function Sparkline({
  points,
  width = 220,
  height = 56,
  target,
}: {
  points: { date: string; value: number }[];
  width?: number;
  height?: number;
  target?: number;
}) {
  if (points.length < 2) {
    return <div className="h-14 text-sm text-[var(--muted)]">Not enough points yet</div>;
  }
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals, target ?? vals[0]);
  const max = Math.max(...vals, target ?? vals[0]);
  const span = max - min || 1;
  const pad = 6;
  const xy = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2);
    const y = height - pad - ((p.value - min) / span) * (height - pad * 2);
    return `${x},${y}`;
  });
  const last = points[points.length - 1];
  const lx = pad + ((points.length - 1) / (points.length - 1)) * (width - pad * 2);
  const ly = height - pad - ((last.value - min) / span) * (height - pad * 2);
  const ty =
    target == null ? null : height - pad - ((target - min) / span) * (height - pad * 2);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} aria-hidden>
      {ty != null && (
        <line x1={pad} x2={width - pad} y1={ty} y2={ty} stroke="var(--line)" strokeDasharray="3 4" />
      )}
      <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={xy.join(" ")} />
      <circle cx={lx} cy={ly} r="3.5" fill="var(--accent)" />
    </svg>
  );
}

export function Heatmap({
  rows,
}: {
  rows: { key: string; label: string; days: { date: string; value: number }[] }[];
}) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-3">
          <div className="w-24 shrink-0 text-sm text-[var(--muted)]">{row.label}</div>
          <div className="flex flex-wrap gap-1">
            {row.days.map((d) => (
              <span
                key={d.date}
                title={`${d.date}: ${d.value ? "done" : "missed"}`}
                className="h-3.5 w-3.5 rounded-[3px]"
                style={{
                  background: d.value ? "var(--accent)" : "var(--bg-2)",
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PaceBar({
  baseline,
  current,
  target,
  projected,
  status,
}: {
  baseline: number;
  current: number;
  target: number;
  projected: number;
  status: string;
}) {
  const lo = Math.min(baseline, current, target, projected);
  const hi = Math.max(baseline, current, target, projected);
  const span = hi - lo || 1;
  const pct = (v: number) => `${((v - lo) / span) * 100}%`;
  const color =
    status === "on_track" ? "var(--good)" : status === "at_risk" ? "var(--warn)" : "#8a3b2a";
  return (
    <div className="relative h-3 rounded-full bg-[var(--bg-2)] mt-3">
      <div
        className="absolute top-0 h-3 rounded-full opacity-40"
        style={{ left: 0, width: pct(projected), background: color }}
      />
      <div
        className="absolute top-0 h-3 rounded-full"
        style={{ left: 0, width: pct(current), background: color }}
      />
      <span
        className="absolute -top-1 h-5 w-px bg-[var(--ink)]"
        style={{ left: pct(target) }}
        title="target"
      />
    </div>
  );
}
