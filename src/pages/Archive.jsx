import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Skeleton from "../components/Skeleton";
import { useRadar } from "../lib/data";
import { hexA, lastDays, shortDate } from "../lib/util";

// Heatmap: topics x last 30 days, colored by the digest's signal.
export default function Archive() {
  const { loading, topics, digests } = useRadar();
  const [params, setParams] = useSearchParams();
  const days = useMemo(() => lastDays(30).reverse(), []); // newest first (right side in RTL)
  const selTopic = params.get("topic");
  const selDate = params.get("date");
  const sel = digests.find((d) => d.topic_id === selTopic && d.date === selDate);
  const selT = topics.find((t) => t.id === selTopic);

  if (loading) return <div className="page"><Skeleton lines={6} tall /></div>;

  return (
    <div className="page archive">
      <div className="section-head">
        <h1 className="display display-md">ארכיון</h1>
        <span className="mono muted">30 יום · עוצמת הצבע היא עוצמת הסיקור</span>
      </div>
      {topics.length === 0 ? <div className="state"><p>אין נושאים עדיין.</p></div> : (
        <div className="heat-scroll glass">
          <table className="heat">
            <thead>
              <tr>
                <th />
                {days.map((d, i) => <th key={d} className="mono">{i % 5 === 0 ? shortDate(d) : ""}</th>)}
              </tr>
            </thead>
            <tbody>
              {topics.map((t, ti) => (
                <tr key={t.id}>
                  <th className="heat-topic" style={{ color: t.color }}>{t.keyword}</th>
                  {days.map((d, di) => {
                    const dg = digests.find((x) => x.topic_id === t.id && x.date === d);
                    const on = selTopic === t.id && selDate === d;
                    return (
                      <td key={d}>
                        <motion.button
                          className={`heat-cell${on ? " is-on" : ""}`}
                          style={{ background: dg ? hexA(t.color, 0.18 + (dg.signal / 100) * 0.82) : "rgba(255,255,255,.035)" }}
                          disabled={!dg}
                          aria-label={dg ? `${t.keyword} ${d}: ${dg.headline}` : `${t.keyword} ${d}: אין תקציר`}
                          title={dg ? dg.headline : ""}
                          initial={{ opacity: 0, scale: 0.4 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: ti * 0.05 + di * 0.008 }}
                          onClick={() => setParams({ topic: t.id, date: d })}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence mode="wait">
        {sel && selT ? (
          <motion.article key={sel.id} className="panel glass archive-detail" style={{ "--c": selT.color }}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
            <div className="mono eyebrow" style={{ color: selT.color }}>{selT.keyword} · {sel.date.split("-").reverse().join(".")}</div>
            <h2 className="h2">{sel.headline}</h2>
            {sel.summary.split(/\n+/).map((p, i) => <p key={i} className="summary-p">{p}</p>)}
            <div className="row-btns">
              <Link className="btn btn-small" to={`/topic/${selT.id}?tab=history`}>כל ההיסטוריה של הנושא</Link>
              <button className="btn btn-small btn-ghost" onClick={() => setParams({})}>סגירה</button>
            </div>
          </motion.article>
        ) : (
          <motion.p key="hint" className="muted archive-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            לחצי על משבצת צבועה כדי לפתוח את התקציר של אותו יום.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
