import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Skeleton from "../components/Skeleton";
import { useRadar } from "../lib/data";
import { greeting, hexA, longDate } from "../lib/util";

const SLIDE_MS = 9000;

// Morning briefing as stories: one slide per topic, auto-advancing.
export default function Briefing() {
  const { loading, active, latestDigest, articles } = useRadar();
  const [params, setParams] = useSearchParams();
  const slides = useMemo(() => [
    { kind: "open" },
    ...active.map((t) => ({ kind: "topic", topic: t, digest: latestDigest(t.id) })),
    { kind: "close" },
  ], [active, latestDigest]);
  const i = Math.min(Number(params.get("i") || 0), slides.length - 1);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const raf = useRef();

  const go = useCallback((n) => {
    const next = Math.max(0, Math.min(slides.length - 1, n));
    setParams(next ? { i: String(next) } : {}, { replace: true });
    setProgress(0);
  }, [slides.length, setParams]);

  useEffect(() => {
    if (paused || i >= slides.length - 1) return;
    let start = performance.now() - progress * SLIDE_MS;
    const tick = (now) => {
      const p = (now - start) / SLIDE_MS;
      if (p >= 1) { go(i + 1); return; }
      setProgress(p);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, paused, slides.length, go]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft") go(i + 1);
      else if (e.key === "ArrowRight") go(i - 1);
      else if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, go]);

  if (loading) return <div className="page"><Skeleton lines={5} tall /></div>;

  const s = slides[i];
  const color = s.topic?.color ?? "#F5A623";

  return (
    <div className="page briefing">
      <div className="stories glass" style={{ "--c": color, background: `radial-gradient(130% 100% at 80% 0%, ${hexA(color, 0.28)}, rgba(12,15,22,.92) 62%)` }}>
        <div className="story-bars">
          {slides.map((_, k) => (
            <button key={k} className="story-bar" onClick={() => go(k)} aria-label={`שקופית ${k + 1}`}>
              <span style={{ width: k < i ? "100%" : k === i ? `${(i === slides.length - 1 ? 1 : progress) * 100}%` : "0%" }} />
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            className="story"
            initial={{ opacity: 0, x: -40, rotateY: -8 }}
            animate={{ opacity: 1, x: 0, rotateY: 0 }}
            exit={{ opacity: 0, x: 40, rotateY: 8 }}
            transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onPointerLeave={() => setPaused(false)}
          >
            {s.kind === "open" && (
              <>
                <div className="mono eyebrow">{longDate()}</div>
                <h1 className="display">{greeting()}.</h1>
                <p className="story-lead">{active.length} נושאים במעקב. הנה מה שהרדאר קלט.</p>
                <div className="story-topics">
                  {active.map((t, k) => (
                    <motion.span key={t.id} className="story-topic" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + k * 0.08 }}>
                      <i style={{ background: t.color, color: t.color }} />{t.keyword}
                    </motion.span>
                  ))}
                </div>
              </>
            )}
            {s.kind === "topic" && (
              <>
                <div className="mono eyebrow" style={{ color }}>{s.topic.keyword} · {i} מתוך {active.length}</div>
                <h2 className="display display-md">{s.digest?.headline || "עוד אין תקציר לנושא הזה"}</h2>
                {s.digest?.whats_new && <p className="story-lead">{s.digest.whats_new}</p>}
                {s.digest?.themes?.length > 0 && (
                  <div className="story-themes">
                    {s.digest.themes.map((t, k) => (
                      <motion.span key={t.label} className="story-theme" style={{ fontSize: `${0.9 + (t.weight || 1) * 0.07}rem`, borderColor: hexA(color, 0.5) }}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + k * 0.1 }}>
                        {t.label}
                      </motion.span>
                    ))}
                  </div>
                )}
                <div className="story-foot mono">
                  אות {s.digest?.signal ?? "-"} · {articles.filter((a) => a.topic_id === s.topic.id).length} כתבות בחודש
                  {s.digest?.tone && ` · טון ${s.digest.tone}`}
                </div>
                <Link className="btn btn-small" to={`/topic/${s.topic.id}`}>לתקציר המלא</Link>
              </>
            )}
            {s.kind === "close" && (
              <>
                <div className="mono eyebrow">סיכום</div>
                <h2 className="display display-md">זה הכל להיום.</h2>
                <ul className="story-summary">
                  {active.map((t) => {
                    const d = latestDigest(t.id);
                    return (
                      <li key={t.id}>
                        <span style={{ color: t.color }}>{t.keyword}</span>
                        <span className="signal-track"><span style={{ width: `${d?.signal ?? 0}%`, background: t.color }} /></span>
                        <span className="mono">{d?.signal ?? "-"}</span>
                      </li>
                    );
                  })}
                </ul>
                <div className="row-btns">
                  <button className="btn" onClick={() => go(0)}>מההתחלה</button>
                  <Link className="btn btn-primary" to="/">לרדאר</Link>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="story-nav">
          <button className="btn btn-small btn-ghost" onClick={() => go(i - 1)} disabled={i === 0}>הקודם</button>
          <button className="btn btn-small btn-ghost" onClick={() => setPaused((p) => !p)}>{paused ? "המשך" : "השהיה"}</button>
          <button className="btn btn-small btn-ghost" onClick={() => go(i + 1)} disabled={i === slides.length - 1}>הבא</button>
        </div>
      </div>
    </div>
  );
}
