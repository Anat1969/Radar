import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Skeleton from "../components/Skeleton";
import { useRadar } from "../lib/data";
import { supabase } from "../lib/supabase";
import { PALETTE, } from "../lib/config";
import { timeAgo } from "../lib/util";

const MAX_ACTIVE = 8;

export default function Topics() {
  const { loading, topics, active, settings, load, notify, scan, scanning } = useRadar();
  const [keyword, setKeyword] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [sourceInput, setSourceInput] = useState("");

  const run = async (fn, okText) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      notify(error.message?.includes("up to 8") ? `אפשר לעקוב אחרי עד ${MAX_ACTIVE} נושאים פעילים` : `הפעולה נכשלה: ${error.message}`, "error");
      return false;
    }
    await load();
    if (okText) notify(okText, "ok");
    return true;
  };

  const add = async (e) => {
    e.preventDefault();
    const k = keyword.trim();
    if (k.length < 2) return notify("מילת המפתח קצרה מדי", "error");
    if (topics.some((t) => t.keyword === k)) return notify("הנושא כבר קיים", "error");
    const sort_order = Math.max(-1, ...topics.map((t) => t.sort_order)) + 1;
    const ok = await run(() => supabase.from("radar_topics").insert({ keyword: k, color, sort_order }), "הנושא נוסף. מריץ סריקה ראשונה...");
    if (ok) {
      setKeyword("");
      setColor(PALETTE[(PALETTE.indexOf(color) + 1) % PALETTE.length]);
      const { data } = await supabase.from("radar_topics").select("id").eq("keyword", k).maybeSingle();
      if (data) scan(data.id);
    }
  };

  const move = async (t, dir) => {
    const list = [...topics];
    const i = list.findIndex((x) => x.id === t.id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await run(() => Promise.all(list.map((x, k) => supabase.from("radar_topics").update({ sort_order: k }).eq("id", x.id)))
      .then((rs) => ({ error: rs.find((r) => r.error)?.error })));
  };

  const saveSettings = (patch, text = "ההגדרות נשמרו") =>
    run(() => supabase.from("radar_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1), text);

  const addSource = (e) => {
    e.preventDefault();
    const s = sourceInput.trim();
    if (!s) return;
    const list = settings?.blocked_sources ?? [];
    if (list.includes(s)) return setSourceInput("");
    saveSettings({ blocked_sources: [...list, s] }, "המקור הוסתר").then((ok) => ok && setSourceInput(""));
  };

  if (loading) return <div className="page"><Skeleton lines={6} tall /></div>;

  return (
    <div className="page topics-page">
      <div className="section-head">
        <h1 className="display display-md">נושאים והגדרות</h1>
        <span className="mono muted">{active.length} מתוך {MAX_ACTIVE} פעילים</span>
      </div>

      <form className="panel glass add-form" onSubmit={add}>
        <label className="field">
          <span className="mono">נושא חדש</span>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="למשל: תחבורה ציבורית באשדוד" maxLength={80} />
        </label>
        <div className="field">
          <span className="mono">צבע</span>
          <div className="palette" role="radiogroup" aria-label="צבע הנושא">
            {PALETTE.map((c) => (
              <button type="button" key={c} role="radio" aria-checked={color === c} aria-label={c}
                className={`swatch-btn${color === c ? " is-on" : ""}`} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
        </div>
        <button className="btn btn-primary" disabled={busy || active.length >= MAX_ACTIVE}>הוספה למעקב</button>
        <p className="muted small">טיפ: מילים כלליות מביאות יותר כתבות. ביטוי ארוך ומדויק מביא פחות, אבל ממוקד.</p>
      </form>

      <ul className="topic-list">
        <AnimatePresence initial={false}>
          {topics.map((t, i) => (
            <motion.li key={t.id} layout className={`topic-row glass${t.is_active ? "" : " is-off"}`} style={{ "--c": t.color }}
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <span className="topic-swatch" style={{ background: t.color }} />
              <div className="topic-info">
                <Link to={`/topic/${t.id}`} className="topic-name">{t.keyword}</Link>
                <span className="mono muted">
                  {t.is_active ? "פעיל" : "מושהה"} · {t.last_scanned_at ? `נסרק ${timeAgo(t.last_scanned_at)}` : "טרם נסרק"}
                  {t.status === "error" && " · שגיאה בסריקה"}
                </span>
              </div>
              <div className="row-btns topic-actions">
                <button className="btn btn-small btn-ghost" onClick={() => move(t, -1)} disabled={busy || i === 0}>למעלה</button>
                <button className="btn btn-small btn-ghost" onClick={() => move(t, 1)} disabled={busy || i === topics.length - 1}>למטה</button>
                <button className="btn btn-small btn-ghost" disabled={busy}
                  onClick={() => run(() => supabase.from("radar_topics").update({ is_active: !t.is_active }).eq("id", t.id), t.is_active ? "הנושא הושהה" : "הנושא חזר למעקב")}>
                  {t.is_active ? "השהיה" : "הפעלה"}
                </button>
                <button className="btn btn-small btn-ghost" onClick={() => scan(t.id)} disabled={!!scanning}>{scanning === t.id ? "סורק..." : "סריקה"}</button>
                {confirmId === t.id ? (
                  <>
                    <button className="btn btn-small btn-danger" disabled={busy}
                      onClick={() => run(() => supabase.from("radar_topics").delete().eq("id", t.id), "הנושא נמחק").then(() => setConfirmId(null))}>
                      מחיקה סופית
                    </button>
                    <button className="btn btn-small btn-ghost" onClick={() => setConfirmId(null)}>ביטול</button>
                  </>
                ) : (
                  <button className="btn btn-small btn-ghost" onClick={() => setConfirmId(t.id)}>מחיקה</button>
                )}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <section className="panel glass settings">
        <h2 className="h3">סריקה אוטומטית</h2>
        <div className="settings-row">
          <label className="switch">
            <input type="checkbox" checked={!!settings?.auto_scan} onChange={(e) => saveSettings({ auto_scan: e.target.checked })} />
            <span className="switch-ui" />
            <span>סריקה יומית של כל הנושאים הפעילים</span>
          </label>
          <label className="field field-inline">
            <span className="mono">שעה</span>
            <select value={settings?.scan_hour ?? 7} onChange={(e) => saveSettings({ scan_hour: Number(e.target.value) })} disabled={!settings?.auto_scan}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
            </select>
          </label>
        </div>

        <h2 className="h3">מקורות מוסתרים</h2>
        <p className="muted small">מקורות שלא יופיעו ברדאר ולא ייכנסו לתקציר. אפשר לכתוב שם אתר או דומיין.</p>
        <div className="tags">
          {(settings?.blocked_sources ?? []).map((s) => (
            <span key={s} className="tag">
              {s}
              <button className="tag-x" onClick={() => saveSettings({ blocked_sources: settings.blocked_sources.filter((x) => x !== s) }, "המקור חזר")}>הסרה</button>
            </span>
          ))}
        </div>
        <form className="inline-form" onSubmit={addSource}>
          <input value={sourceInput} onChange={(e) => setSourceInput(e.target.value)} placeholder="למשל: example.com" />
          <button className="btn btn-small" disabled={busy}>הסתרה</button>
        </form>

        <h2 className="h3">איך זה עובד</h2>
        <p className="muted small">
          הכתבות מגיעות מ-Google News בעברית, בלי מפתח ובלי מכסה יומית. אחרי כל סריקה Claude כותב תקציר: כותרת, צירים מרכזיים, שמות שחוזרים, טון ועוצמת סיקור.
          כל נושא אפשר לסרוק פעם בחמש דקות.
        </p>
      </section>
    </div>
  );
}
