import { motion } from "framer-motion";
import { hexA, lastDays, shortDate } from "../lib/util";

export function Sparkline({ values, color, width = 120, height = 34 }) {
  const max = Math.max(1, ...values);
  const step = width / Math.max(1, values.length - 1);
  // RTL: oldest on the right, today on the left.
  const pts = values.map((v, i) => [width - i * step, height - 3 - (v / max) * (height - 8)]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${d} L${pts.at(-1)[0]} ${height} L${pts[0][0]} ${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="spark" aria-hidden="true">
      <path d={area} fill={hexA(color, 0.14)} />
      <motion.path d={d} fill="none" stroke={color} strokeWidth="1.6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: "easeOut" }} />
      <circle cx={pts.at(-1)[0]} cy={pts.at(-1)[1]} r="2.6" fill={color} />
    </svg>
  );
}

export function SignalGauge({ value = 0, color = "#F5A623", size = 150, label = "עוצמת סיקור" }) {
  const r = size / 2 - 12;
  const c = Math.PI * r;
  return (
    <div className="gauge" style={{ width: size }}>
      <svg width={size} height={size / 2 + 14} viewBox={`0 0 ${size} ${size / 2 + 14}`} aria-hidden="true">
        <path d={`M12 ${size / 2} A${r} ${r} 0 0 1 ${size - 12} ${size / 2}`} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="10" strokeLinecap="round" />
        <motion.path
          d={`M${size - 12} ${size / 2} A${r} ${r} 0 0 0 12 ${size / 2}`}
          fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.min(100, value) / 100) }}
          transition={{ duration: 1.4, ease: [0.2, 0.7, 0.2, 1] }}
          style={{ filter: `drop-shadow(0 0 8px ${hexA(color, 0.6)})` }}
        />
      </svg>
      <div className="gauge-value">{value}</div>
      <div className="mono gauge-label">{label}</div>
    </div>
  );
}

export function ThemeBars({ themes, color }) {
  const max = Math.max(1, ...themes.map((t) => t.weight || 1));
  return (
    <ul className="themes">
      {themes.map((t, i) => (
        <li key={t.label} className="theme">
          <div className="theme-head">
            <span className="theme-label">{t.label}</span>
            <span className="mono theme-w">{t.weight}/10</span>
          </div>
          <div className="theme-track">
            <motion.div
              className="theme-fill"
              style={{ background: `linear-gradient(270deg, ${color}, ${hexA(color, 0.35)})` }}
              initial={{ width: 0 }}
              animate={{ width: `${(100 * (t.weight || 1)) / max}%` }}
              transition={{ duration: 0.9, delay: 0.1 + i * 0.08, ease: "easeOut" }}
            />
          </div>
          <p className="theme-note">{t.note}</p>
        </li>
      ))}
    </ul>
  );
}

export function SourceRing({ articles, color }) {
  const counts = {};
  for (const a of articles) counts[a.source || "לא ידוע"] = (counts[a.source || "לא ידוע"] || 0) + 1;
  const sorted = Object.entries(counts).sort((x, y) => y[1] - x[1]);
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5).reduce((n, [, c]) => n + c, 0);
  if (rest) top.push(["אחרים", rest]);
  const total = articles.length || 1;
  const r = 54, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="ring-wrap">
      <svg width="150" height="150" viewBox="-75 -75 150 150" aria-hidden="true">
        <circle r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="16" />
        {top.map(([name, n], i) => {
          const len = (n / total) * c;
          const el = (
            <motion.circle
              key={name} r={r} fill="none" strokeWidth="16"
              stroke={hexA(color, 1 - i * 0.14)}
              strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
              transform={`rotate(${-90 + (acc / c) * 360})`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 * i }}
            />
          );
          acc += len;
          return el;
        })}
        <text textAnchor="middle" dominantBaseline="middle" className="ring-total">{articles.length}</text>
      </svg>
      <ul className="ring-legend">
        {top.map(([name, n], i) => (
          <li key={name}>
            <span className="swatch" style={{ background: hexA(color, 1 - i * 0.14) }} />
            <span className="ring-name">{name}</span>
            <span className="mono">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Beeswarm of the last 7 days: one column per day, one dot per article.
export function TimeRiver({ articles, color, onPick }) {
  const days = lastDays(7);
  const byDay = Object.fromEntries(days.map((d) => [d, []]));
  for (const a of articles) {
    const d = a.published_at && new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date(a.published_at));
    if (byDay[d]) byDay[d].push(a);
  }
  const W = 1000, colW = W / 7, dot = 13;
  const perRow = Math.floor((colW - 16) / dot);
  const rows = Math.max(1, ...days.map((d) => Math.ceil(byDay[d].length / perRow)));
  const H = Math.min(220, Math.max(70, rows * dot + 34));
  return (
    <div className="river">
      <svg viewBox={`0 0 ${W} ${H + 26}`} className="river-svg" role="img" aria-label="כתבות לפי יום">
        {days.map((d, di) => {
          const x0 = W - (di + 1) * colW; // RTL: oldest on the right
          const list = byDay[d];
          return (
            <g key={d}>
              <rect x={x0 + 3} y="0" width={colW - 6} height={H} rx="10" fill="rgba(255,255,255,.025)" />
              {list.slice(0, perRow * Math.floor(H / dot)).map((a, i) => {
                const cx = x0 + 8 + (i % perRow) * dot + dot / 2;
                const cy = H - 10 - Math.floor(i / perRow) * dot;
                return (
                  <motion.circle
                    key={a.id} cx={cx} cy={cy} r={a.saved ? 5.5 : 4.5} fill={color}
                    className="river-dot"
                    initial={{ opacity: 0, cy: H }} animate={{ opacity: 1, cy }}
                    transition={{ delay: 0.02 * i + 0.05 * di, duration: 0.5 }}
                    onClick={() => onPick?.(a)}
                  >
                    <title>{a.title}</title>
                  </motion.circle>
                );
              })}
              <text x={x0 + colW / 2} y={H + 20} textAnchor="middle" className="river-label">
                {di === 6 ? "היום" : shortDate(d)}
              </text>
              <text x={x0 + colW / 2} y="16" textAnchor="middle" className="river-count">{list.length || ""}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
