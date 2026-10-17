import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ageHours, hash01, hexA, timeAgo } from "../lib/util";

// Polar map of the news: each topic owns a sector, each article is a dot.
// Distance from the center is age on a log scale (center = now, rim = a week).
const R = 250;
const R0 = 26;
const SWEEP_MS = 6000;
const RINGS = [
  [6, "6 שעות"],
  [24, "יום"],
  [72, "3 ימים"],
  [168, "שבוע"],
];

const radiusFor = (h) => R0 + (R - R0) * (Math.log1p(Math.min(h, 168)) / Math.log1p(168));
const polar = (r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)];
};

function sectorPath(a0, a1, r) {
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M0 0 L${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}

export default function Radar({ topics, articles, scanning, compact = false }) {
  const navigate = useNavigate();
  const [hoverTopic, setHoverTopic] = useState(null);
  const [picked, setPicked] = useState(null);

  const span = topics.length ? 360 / topics.length : 360;
  const mountPhase = useMemo(() => performance.now() % SWEEP_MS, []);

  const dots = useMemo(() => {
    const index = new Map(topics.map((t, i) => [t.id, i]));
    return articles
      .filter((a) => index.has(a.topic_id) && ageHours(a.published_at) <= 168)
      .slice(0, 600)
      .map((a) => {
        const i = index.get(a.topic_id);
        const deg = i * span + span * (0.12 + 0.76 * hash01(a.id));
        const r = radiusFor(ageHours(a.published_at)) + (hash01(a.url) - 0.5) * 8;
        const [x, y] = polar(r, deg);
        // Light the dot when the beam passes over its angle.
        const delay = ((((deg / 360) * SWEEP_MS - mountPhase) % SWEEP_MS) + SWEEP_MS) % SWEEP_MS - SWEEP_MS;
        const fresh = Date.now() - new Date(a.created_at).getTime() < 15 * 60_000;
        return { a, x, y, delay, color: topics[i].color, fresh };
      });
  }, [articles, topics, span, mountPhase]);

  return (
    <div className={`radar${compact ? " radar-compact" : ""}${scanning ? " is-scanning" : ""}`}>
      <div className="radar-stage">
        <div className="radar-glow" aria-hidden="true" />
        <div
          className="radar-sweep"
          aria-hidden="true"
          style={{ animationDuration: `${SWEEP_MS}ms`, animationDelay: `${-mountPhase}ms` }}
        />
        <svg viewBox="-300 -300 600 600" className="radar-svg" role="img" aria-label="מפת הכתבות לפי נושא וזמן">
          <defs>
            <radialGradient id="radar-floor" r="50%">
              <stop offset="0" stopColor="#1B2130" />
              <stop offset="1" stopColor="#0C0F16" />
            </radialGradient>
          </defs>
          <circle r={R + 6} fill="url(#radar-floor)" stroke="rgba(255,255,255,.08)" />

          {topics.map((t, i) => (
            <path
              key={t.id}
              d={sectorPath(i * span, (i + 1) * span - 0.01, R)}
              fill={hoverTopic === t.id ? hexA(t.color, 0.12) : hexA(t.color, 0.025)}
              className="radar-sector"
              onMouseEnter={() => setHoverTopic(t.id)}
              onMouseLeave={() => setHoverTopic(null)}
              onClick={() => navigate(`/topic/${t.id}`)}
            >
              <title>{t.keyword}</title>
            </path>
          ))}

          {RINGS.map(([h, label]) => (
            <g key={h}>
              <circle r={radiusFor(h)} fill="none" stroke="rgba(255,255,255,.09)" strokeDasharray={h === 168 ? "0" : "2 5"} />
              {!compact && (
                <text x={4} y={-radiusFor(h) + 12} className="radar-ring-label">{label}</text>
              )}
            </g>
          ))}

          {topics.length > 1 && topics.map((t, i) => {
            const [x, y] = polar(R, i * span);
            return <line key={t.id} x1="0" y1="0" x2={x} y2={y} stroke="rgba(255,255,255,.07)" />;
          })}

          {dots.map(({ a, x, y, delay, color, fresh }) => (
            <g key={a.id} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} className="radar-dot-g">
              {fresh && <circle r="4" className="radar-ping" stroke={color} />}
              <circle
                r={a.saved ? 4.6 : 3.2}
                fill={color}
                className="radar-dot"
                style={{ animationDuration: `${SWEEP_MS}ms`, animationDelay: `${delay}ms`, color }}
                onClick={(e) => { e.stopPropagation(); setPicked(a); }}
              >
                <title>{a.title}</title>
              </circle>
            </g>
          ))}

          <circle r="5" fill="#F5A623" className="radar-core" />

          {topics.map((t, i) => {
            const mid = i * span + span / 2;
            const [x, y] = polar(R + 26, topics.length === 1 ? 0 : mid);
            return (
              <text
                key={t.id}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                className={`radar-topic-label${hoverTopic === t.id ? " is-hover" : ""}`}
                fill={t.color}
                onMouseEnter={() => setHoverTopic(t.id)}
                onMouseLeave={() => setHoverTopic(null)}
                onClick={() => navigate(`/topic/${t.id}`)}
              >
                {t.keyword.length > 16 ? `${t.keyword.slice(0, 15)}…` : t.keyword}
              </text>
            );
          })}
        </svg>
        {scanning && (
          <div className="radar-pulses" aria-hidden="true">
            <span /><span /><span />
          </div>
        )}
      </div>

      <AnimatePresence>
        {picked && (
          <motion.div
            className="radar-pick glass"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
          >
            <div className="mono pick-meta">{picked.source || "מקור לא ידוע"} · {timeAgo(picked.published_at)}</div>
            <p className="pick-title">{picked.title}</p>
            <div className="row-btns">
              <a className="btn btn-small" href={picked.url} target="_blank" rel="noreferrer">פתיחת המקור</a>
              <button className="btn btn-small btn-ghost" onClick={() => navigate(`/topic/${picked.topic_id}`)}>לתקציר הנושא</button>
              <button className="btn btn-small btn-ghost" onClick={() => setPicked(null)}>סגירה</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
