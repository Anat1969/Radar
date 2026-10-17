import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import ArticleItem from "../components/ArticleItem";
import Skeleton from "../components/Skeleton";
import { SignalGauge, SourceRing, ThemeBars, TimeRiver } from "../components/Viz";
import { useRadar } from "../lib/data";
import { ageHours, hexA, timeAgo } from "../lib/util";

const TABS = [["digest", "תקציר"], ["articles", "כתבות"], ["history", "היסטוריה"]];

export default function Topic() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "digest";
  const { loading, topics, articles, digests, scan, scanning } = useRadar();
  const [filter, setFilter] = useState("all");
  const [highlight, setHighlight] = useState(null);

  const topic = topics.find((t) => t.id === id);
  const mine = useMemo(() => articles.filter((a) => a.topic_id === id), [articles, id]);
  const history = digests.filter((d) => d.topic_id === id);
  const digest = history[0];

  if (loading) return <div className="page"><Skeleton lines={6} tall /></div>;
  if (!topic) return (
    <div className="page state">
      <p>הנושא לא נמצא. ייתכן שנמחק.</p>
      <Link className="btn" to="/">חזרה לרדאר</Link>
    </div>
  );

  const color = topic.color;
  const week = mine.filter((a) => ageHours(a.published_at) <= 168);
  const shown = filter === "saved" ? mine.filter((a) => a.saved) : filter === "today" ? mine.filter((a) => ageHours(a.published_at) <= 24) : mine;
  const setTab = (t) => setParams(t === "digest" ? {} : { tab: t }, { replace: true });

  const pick = (a) => {
    setTab("articles");
    setFilter("all");
    setHighlight(a.id);
    setTimeout(() => document.getElementById(`a-${a.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 450);
  };

  return (
    <div className="page topic" style={{ "--c": color }}>
      <div className="crumbs mono"><Link to="/">רדאר</Link><span>/</span><span>{topic.keyword}</span></div>
      <header className="topic-hero" style={{ background: `radial-gradient(120% 140% at 85% 0%, ${hexA(color, 0.22)}, transparent 60%)` }}>
        <div className="topic-hero-copy">
          <div className="mono eyebrow" style={{ color }}>{topic.keyword}</div>
          <motion.h1 className="display display-md" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            {digest?.headline || "עוד אין תקציר לנושא הזה"}
          </motion.h1>
          {digest?.whats_new && (
            <p className="whats-new"><span className="mono">מה חדש</span>{digest.whats_new}</p>
          )}
          <div className="row-btns">
            <button className="btn btn-primary" onClick={() => scan(topic.id)} disabled={!!scanning}>
              {scanning === topic.id ? "סורק..." : "סריקת הנושא"}
            </button>
            <span className="mono muted">
              {topic.last_scanned_at ? `נסרק ${timeAgo(topic.last_scanned_at)}` : "טרם נסרק"}
              {topic.status === "error" && " · הסריקה האחרונה נכשלה"}
            </span>
          </div>
        </div>
        <div className="topic-hero-stats">
          <SignalGauge value={digest?.signal ?? 0} color={color} />
          <div className="stat-row">
            <div className="stat"><span className="stat-n">{week.length}</span><span className="mono">כתבות השבוע</span></div>
            <div className="stat"><span className="stat-n">{new Set(week.map((a) => a.source)).size}</span><span className="mono">מקורות</span></div>
            <div className="stat"><span className="stat-n stat-word">{digest?.tone || "-"}</span><span className="mono">טון</span></div>
          </div>
        </div>
      </header>

      <div className="tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`tab${tab === k ? " is-active" : ""}`} onClick={() => setTab(k)}>
            {label}
            {tab === k && <motion.span layoutId="tab-ink" className="tab-ink" />}
          </button>
        ))}
      </div>

      {tab === "digest" && (
        <div className="digest-grid">
          <section className="panel glass summary-panel">
            <h2 className="h3">התקציר</h2>
            {digest ? digest.summary.split(/\n+/).map((p, i) => <p key={i} className="summary-p">{p}</p>) : <p className="muted">לחצי על "סריקת הנושא" כדי לקבל תקציר ראשון.</p>}
            {digest && <div className="mono muted small">נכתב על ידי Claude מתוך {digest.article_count} כתבות · {digest.date.split("-").reverse().join(".")}</div>}
          </section>
          <section className="panel glass">
            <h2 className="h3">צירים מרכזיים</h2>
            {digest?.themes?.length ? <ThemeBars themes={digest.themes} color={color} /> : <p className="muted">אין עדיין.</p>}
          </section>
          <section className="panel glass river-panel">
            <h2 className="h3">נהר הזמן</h2>
            <p className="muted small">כל נקודה היא כתבה. לחיצה פותחת אותה ברשימה.</p>
            <TimeRiver articles={week} color={color} onPick={pick} />
          </section>
          <section className="panel glass">
            <h2 className="h3">מי מסקר</h2>
            {week.length ? <SourceRing articles={week} color={color} /> : <p className="muted">אין כתבות השבוע.</p>}
          </section>
          <section className="panel glass">
            <h2 className="h3">שמות שחוזרים</h2>
            <div className="entities">
              {(digest?.entities ?? []).map((e, i) => (
                <motion.span key={e.name} className="entity" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                  <span className="mono">{e.kind}</span>{e.name}
                </motion.span>
              ))}
              {!digest?.entities?.length && <p className="muted">אין עדיין.</p>}
            </div>
          </section>
        </div>
      )}

      {tab === "articles" && (
        <section>
          <div className="filters">
            {[["all", `הכל (${mine.length})`], ["today", "24 שעות"], ["saved", "שמורות"]].map(([k, l]) => (
              <button key={k} className={`chip${filter === k ? " chip-on" : ""}`} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
          {shown.length ? (
            <ul className="articles">
              {shown.map((a, i) => <ArticleItem key={a.id} article={a} color={color} index={i} highlight={highlight === a.id} />)}
            </ul>
          ) : <div className="state"><p>אין כתבות בתצוגה הזו.</p></div>}
        </section>
      )}

      {tab === "history" && (
        <section className="history">
          {history.length ? history.map((d, i) => (
            <motion.article key={d.id} className="history-item glass" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
              <div className="history-date mono">{d.date.split("-").reverse().join(".")}</div>
              <div className="history-body">
                <h3 className="h3">{d.headline}</h3>
                <p className="muted">{d.whats_new}</p>
              </div>
              <div className="history-signal">
                <span className="signal-track"><span style={{ width: `${d.signal}%`, background: color }} /></span>
                <span className="mono">{d.signal}</span>
              </div>
            </motion.article>
          )) : <div className="state"><p>עוד אין היסטוריה. כל יום עם סריקה מוסיף שורה.</p></div>}
        </section>
      )}
    </div>
  );
}
