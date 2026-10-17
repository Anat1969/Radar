import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Radar from "../components/Radar";
import Skeleton from "../components/Skeleton";
import { Sparkline } from "../components/Viz";
import { useRadar } from "../lib/data";
import { ageHours, greeting, israelDate, lastDays, longDate, timeAgo } from "../lib/util";

export default function Home() {
  const { loading, active, articles, latestDigest, scan, scanning, settings, today } = useRadar();
  const days = useMemo(() => lastDays(7), []);
  const last24 = articles.filter((a) => ageHours(a.published_at) <= 24 && active.some((t) => t.id === a.topic_id));
  const lastScan = active.map((t) => t.last_scanned_at).filter(Boolean).sort().at(-1);
  const ticker = articles.filter((a) => active.some((t) => t.id === a.topic_id)).slice(0, 14);

  return (
    <div className="page home">
      <section className="hero">
        <div className="hero-copy">
          <div className="mono eyebrow">{longDate()}</div>
          <h1 className="display">{greeting()}.</h1>
          <p className="lead">
            {loading ? "סורק את השמיים..." : (
              <>
                <strong className="num">{last24.length}</strong> כתבות ב-24 השעות האחרונות,
                {" "}על פני <strong className="num">{active.length}</strong> נושאים.
              </>
            )}
          </p>
          <div className="row-btns hero-btns">
            <button className="btn btn-primary" onClick={() => scan()} disabled={!!scanning || !active.length}>
              {scanning === "all" ? "סורק עכשיו..." : "סריקה עכשיו"}
            </button>
            <Link className="btn" to="/briefing">תדריך הבוקר</Link>
          </div>
          <div className="mono hero-status">
            {lastScan ? `סריקה אחרונה ${timeAgo(lastScan)}` : "עוד לא נסרק"}
            {settings?.auto_scan && ` · סריקה אוטומטית כל יום ב-${String(settings.scan_hour).padStart(2, "0")}:00`}
          </div>
        </div>
        <div className="hero-radar">
          {loading ? <div className="radar-placeholder" /> : <Radar topics={active} articles={articles} scanning={scanning} />}
          <div className="mono radar-legend">מרכז = עכשיו · שפה = לפני שבוע · לחיצה על נקודה פותחת כתבה</div>
        </div>
      </section>

      {ticker.length > 0 && (
        <div className="ticker" aria-label="כותרות אחרונות">
          <div className="ticker-track">
            {[...ticker, ...ticker].map((a, i) => {
              const t = active.find((x) => x.id === a.topic_id);
              return (
                <a key={`${a.id}-${i}`} href={a.url} target="_blank" rel="noreferrer" className="ticker-item">
                  <span className="ticker-dot" style={{ background: t?.color }} />
                  {a.title}
                </a>
              );
            })}
          </div>
        </div>
      )}

      <section className="section">
        <div className="section-head">
          <h2 className="h2">תמונת מצב</h2>
          <span className="mono muted">נושא · כותרת היום · מגמה של שבוע</span>
        </div>
        {loading ? <Skeleton lines={4} tall /> : active.length === 0 ? (
          <div className="state">
            <p>עוד אין נושאים במעקב.</p>
            <Link className="btn btn-primary" to="/topics">הוספת נושא ראשון</Link>
          </div>
        ) : (
          <div className="cards">
            {active.map((t, i) => {
              const d = latestDigest(t.id);
              const mine = articles.filter((a) => a.topic_id === t.id);
              const perDay = days.map((day) => mine.filter((a) => a.published_at && israelDate(new Date(a.published_at)) === day).length);
              const isToday = d?.date === today;
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 18, rotateX: 8 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  transition={{ delay: 0.06 * i, duration: 0.5 }}
                >
                  <Link to={`/topic/${t.id}`} className="card glass" style={{ "--c": t.color }}>
                    <div className="card-top">
                      <span className="card-topic" style={{ color: t.color }}>{t.keyword}</span>
                      <span className={`status status-${t.status}`}>{{ active: "פעיל", pending: "ממתין", error: "שגיאה" }[t.status]}</span>
                    </div>
                    <h3 className="card-headline">{d?.headline || "עוד אין תקציר. הסריקה הבאה תיצור אחד."}</h3>
                    {d?.whats_new && <p className="card-new">{d.whats_new}</p>}
                    <div className="card-foot">
                      <div className="signal-mini" title="עוצמת סיקור">
                        <span className="mono">אות</span>
                        <span className="signal-track"><span style={{ width: `${d?.signal ?? 0}%`, background: t.color }} /></span>
                        <span className="mono">{d?.signal ?? "-"}</span>
                      </div>
                      <Sparkline values={perDay} color={t.color} />
                    </div>
                    <div className="mono card-meta">
                      {mine.length} כתבות בחודש · {d ? (isToday ? "תקציר מהיום" : `תקציר מ-${d.date.split("-").reverse().slice(0, 2).join(".")}`) : "ללא תקציר"}
                      {d?.tone && ` · טון ${d.tone}`}
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
