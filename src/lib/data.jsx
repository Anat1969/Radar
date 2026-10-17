import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase, runScan } from "./supabase";
import { isBlocked, israelDate } from "./util";

const Ctx = createContext(null);
export const useRadar = () => useContext(Ctx);

export function RadarProvider({ children }) {
  const [state, setState] = useState({ loading: true, error: null, topics: [], articles: [], digests: [], settings: null });
  const [scanning, setScanning] = useState(null); // null | "all" | topicId
  const [toast, setToast] = useState(null);

  const notify = useCallback((text, kind = "info") => {
    setToast({ text, kind, id: Date.now() });
  }, []);

  const load = useCallback(async () => {
    try {
      const since = new Date(Date.now() - 31 * 864e5).toISOString();
      const [t, a, d, s] = await Promise.all([
        supabase.from("radar_topics").select("*").order("sort_order").order("created_at"),
        supabase.from("radar_articles").select("*").or(`published_at.gte.${since},saved.eq.true`).order("published_at", { ascending: false }).limit(2000),
        supabase.from("radar_digests").select("*").gte("date", since.slice(0, 10)).order("date", { ascending: false }),
        supabase.from("radar_settings").select("*").eq("id", 1).maybeSingle(),
      ]);
      const err = t.error || a.error || d.error || s.error;
      if (err) throw err;
      setState({ loading: false, error: null, topics: t.data, articles: a.data, digests: d.data, settings: s.data });
    } catch (e) {
      setState((p) => ({ ...p, loading: false, error: e.message || String(e) }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const blocked = state.settings?.blocked_sources ?? [];
  // Claude marks off-topic search hits as relevant=false after each scan.
  const articles = useMemo(
    () => state.articles.filter((a) => a.relevant !== false && !isBlocked(a.source, blocked)),
    [state.articles, blocked],
  );
  const active = useMemo(() => state.topics.filter((t) => t.is_active), [state.topics]);

  const latestDigest = useCallback((topicId) => state.digests.find((d) => d.topic_id === topicId) ?? null, [state.digests]);

  const scan = useCallback(async (topicId) => {
    setScanning(topicId ?? "all");
    try {
      const res = await runScan(topicId);
      const added = (res.results ?? []).reduce((n, r) => n + (r.added || 0), 0);
      const failed = (res.results ?? []).filter((r) => r.error).length;
      await load();
      notify(failed ? `הסריקה הסתיימה עם ${failed} שגיאות` : added ? `נמצאו ${added} כתבות חדשות` : "אין כתבות חדשות מאז הסריקה הקודמת", failed ? "error" : "ok");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setScanning(null);
    }
  }, [load, notify]);

  const toggleSaved = useCallback(async (article) => {
    const saved = !article.saved;
    setState((p) => ({ ...p, articles: p.articles.map((a) => (a.id === article.id ? { ...a, saved } : a)) }));
    const { error } = await supabase.from("radar_articles").update({ saved }).eq("id", article.id);
    if (error) {
      setState((p) => ({ ...p, articles: p.articles.map((a) => (a.id === article.id ? { ...a, saved: !saved } : a)) }));
      notify("השמירה נכשלה", "error");
    } else notify(saved ? "הכתבה נשמרה" : "הכתבה הוסרה מהשמורות", "ok");
  }, [notify]);

  const value = {
    ...state, articles, active, blocked, scanning, scan, load, toggleSaved, latestDigest, notify, toast, setToast,
    today: israelDate(),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
