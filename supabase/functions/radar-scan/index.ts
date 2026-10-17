// RADAR-GH: scans Hebrew news for each topic and writes a Claude digest.
// News: Google News RSS (no key, no daily quota). Digest: Claude (ANTHROPIC_API_KEY).
// Open to every visitor (no login, Anat's choice), so scans are throttled:
// one scan per topic every 5 minutes and SCANS_PER_HOUR in total.
// Body: { topicId?: string, mode?: "manual" | "auto" }. "auto" is called hourly
// by pg_cron and runs only at the scan hour set in radar_settings.
import Anthropic from "npm:@anthropic-ai/sdk";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const SCANS_PER_HOUR = 60;
const TOPIC_COOLDOWN_MS = 5 * 60_000;

type Topic = { id: string; keyword: string; last_scanned_at: string | null };

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });

function israelNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

const entities = (s: string) =>
  s.replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
// RSS escapes the HTML inside <description>, so unescape before stripping tags.
const decode = (s: string) =>
  entities(entities(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")))
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? "";

async function fetchNews(keyword: string, blocked: string[]) {
  const sites = blocked.filter((b) => b.includes(".")).map((b) => ` -site:${b}`).join("");
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${keyword} when:7d${sites}`)}&hl=iw&gl=IL&ceid=IL:he`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 RadarGH" } });
  if (!r.ok) throw new Error(`Google News ${r.status}`);
  const xml = await r.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 60).map(([, item]) => {
    const source = decode(tag(item, "source")) || null;
    let title = decode(tag(item, "title"));
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const description = decode(tag(item, "description"));
    const pub = tag(item, "pubDate");
    return {
      title,
      source,
      url: decode(tag(item, "link")),
      description: description && description !== title && !description.startsWith(title) ? description.slice(0, 400) : null,
      published_at: pub ? new Date(pub).toISOString() : null,
    };
  }).filter((a) => a.title && a.url && !blocked.some((b) => a.source?.toLowerCase().includes(b.toLowerCase())));
}

const DIGEST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["relevant", "headline", "summary", "themes", "entities", "tone", "signal", "whats_new"],
  properties: {
    relevant: { type: "array", items: { type: "integer" } },
    headline: { type: "string" },
    summary: { type: "string" },
    themes: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["label", "weight", "note"],
        properties: { label: { type: "string" }, weight: { type: "integer" }, note: { type: "string" } },
      },
    },
    entities: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["name", "kind"],
        properties: { name: { type: "string" }, kind: { type: "string", enum: ["אדם", "ארגון", "מקום", "אחר"] } },
      },
    },
    tone: { type: "string", enum: ["חיובי", "ניטרלי", "שלילי", "מעורב"] },
    signal: { type: "integer" },
    whats_new: { type: "string" },
  },
};

const SYSTEM = `את/ה עורך/ת חדשות של "רדאר", כלי מעקב אישי אחרי נושאים בתקשורת הישראלית.
מקבלים רשימת כתבות ממנוע חיפוש. חלק מהן לא קשורות לנושא בכלל (המנוע מתאים מילים מתפריטים ותגיות באתר).
- relevant: המספרים של הכתבות שבאמת עוסקות בנושא. מחמירים: כתבה שרק מזכירה מילה דומה לא נכנסת.
כל השדות הבאים נכתבים רק מתוך הכתבות הרלוונטיות. אם אין כתבות רלוונטיות, כותבים זאת בקצרה ומחזירים signal 0.
- headline: כותרת של 4 עד 9 מילים שמבטאת את מה שקורה עכשיו בנושא, לא את שם הנושא.
- summary: 2 עד 3 פסקאות קצרות, עד 140 מילים בסך הכל. עברית תקינה וישירה. רק מה שעולה מהכתבות.
- themes: 3 עד 5 צירים מרכזיים. label של 1 עד 3 מילים, weight מ-1 עד 10 לפי כמה כתבות עוסקות בו, note במשפט אחד.
- entities: עד 8 שמות שחוזרים בכתבות (אנשים, ארגונים, מקומות). רק שמות שמופיעים בכתבות.
- tone: הטון הכללי של הסיקור.
- signal: 0 עד 100, עוצמת הסיקור (כמות, טריות, חשיבות).
- whats_new: משפט אחד על מה השתנה לעומת התקציר הקודם. אם אין תקציר קודם, מה הדבר הבולט ביותר.
לא ממציאים עובדות, ציטוטים או מספרים. בלי סימני קריאה.`;

async function writeDigest(topic: Topic, date: string, blocked: string[]) {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const arts: { id: string; title: string; source: string | null; description: string | null; published_at: string | null }[] =
    (await (await rest(`radar_articles?select=id,title,source,description,published_at&topic_id=eq.${topic.id}&published_at=gte.${since}&order=published_at.desc&limit=120`)).json())
      .filter((a: { source: string | null }) => !blocked.some((b) => a.source?.toLowerCase().includes(b.toLowerCase())))
      .slice(0, 80);
  if (!arts.length) return null;

  const prev = await (await rest(`radar_digests?select=headline,date&topic_id=eq.${topic.id}&date=lt.${date}&order=date.desc&limit=1`)).json();
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY")?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  const client = new Anthropic({ apiKey });

  const list = arts.map((a, i) => `${i + 1}. ${a.title} (${a.source ?? "לא ידוע"}, ${a.published_at?.slice(0, 10) ?? ""})${a.description ? ` - ${a.description}` : ""}`).join("\n");
  const userText = `הנושא: "${topic.keyword}"\n${prev[0] ? `התקציר הקודם (${prev[0].date}): ${prev[0].headline}\n` : ""}\nהכתבות:\n${list}`;

  const response = await client.beta.messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "low", format: { type: "json_schema", schema: DIGEST_SCHEMA } },
    messages: [{ role: "user", content: userText }],
  } as never);
  const text = response.content.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  const d = JSON.parse(text);

  // Mark relevance so the app shows only articles that are really about the topic.
  const keep = new Set<number>((d.relevant ?? []).filter((n: number) => n >= 1 && n <= arts.length));
  const yes = arts.filter((_, i) => keep.has(i + 1)).map((a) => a.id);
  const no = arts.filter((_, i) => !keep.has(i + 1)).map((a) => a.id);
  if (yes.length) await rest(`radar_articles?id=in.(${yes.join(",")})`, { method: "PATCH", body: JSON.stringify({ relevant: true }) });
  if (no.length) await rest(`radar_articles?id=in.(${no.join(",")})`, { method: "PATCH", body: JSON.stringify({ relevant: false }) });

  const row = {
    topic_id: topic.id, date,
    headline: d.headline, summary: d.summary, themes: d.themes, entities: d.entities,
    tone: d.tone, signal: Math.max(0, Math.min(100, Number(d.signal) || 0)), whats_new: d.whats_new,
    article_count: yes.length,
  };
  await rest("radar_digests?on_conflict=topic_id,date", {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(row),
  });
  return row;
}

async function scanTopic(topic: Topic, kind: string, date: string, blocked: string[]) {
  try {
    const items = await fetchNews(topic.keyword, blocked);
    const ins = await rest("radar_articles?on_conflict=topic_id,url", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify(items.map((a) => ({ ...a, topic_id: topic.id }))),
    });
    const added = ins.ok ? (await ins.json()).length : 0;
    let digest = null, digestError = null;
    try { digest = await writeDigest(topic, date, blocked); } catch (e) { digestError = String(e); }
    await rest(`radar_topics?id=eq.${topic.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "active", last_scanned_at: new Date().toISOString(), last_error: digestError }),
    });
    await rest("radar_scan_log", { method: "POST", body: JSON.stringify({ topic_id: topic.id, kind, ok: true, new_articles: added }) });
    return { topicId: topic.id, found: items.length, added, digest: !!digest, digestError };
  } catch (e) {
    await rest(`radar_topics?id=eq.${topic.id}`, {
      method: "PATCH", body: JSON.stringify({ status: "error", last_error: String(e), last_scanned_at: new Date().toISOString() }),
    });
    await rest("radar_scan_log", { method: "POST", body: JSON.stringify({ topic_id: topic.id, kind, ok: false }) });
    return { topicId: topic.id, error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { topicId?: string; mode?: string } = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const { date, hour } = israelNow();
  const [s] = await (await rest("radar_settings?id=eq.1&select=*")).json();
  const blocked: string[] = (s?.blocked_sources ?? []).map((b: string) => b.trim()).filter(Boolean);

  if (body.mode === "auto") {
    if (!s?.auto_scan || s.scan_hour !== hour || s.last_auto_scan === date) return json({ skipped: true });
    await rest("radar_settings?id=eq.1", { method: "PATCH", body: JSON.stringify({ last_auto_scan: date }) });
  }

  const since = new Date(Date.now() - 3600_000).toISOString();
  const cnt = await rest(`radar_scan_log?select=id&created_at=gte.${since}`, { method: "HEAD", headers: { Prefer: "count=exact" } });
  const used = Number((cnt.headers.get("content-range") ?? "").split("/")[1]) || 0;

  let filter = "is_active=eq.true";
  if (body.topicId) {
    if (!/^[0-9a-f-]{36}$/i.test(body.topicId)) return json({ error: "topicId לא תקין" }, 400);
    filter = `id=eq.${body.topicId}`;
  }
  const topics: Topic[] = await (await rest(`radar_topics?select=id,keyword,last_scanned_at&${filter}&order=sort_order`)).json();
  if (!topics.length) return json({ error: "אין נושאים לסריקה" }, 404);

  const ready = body.mode === "auto" ? topics : topics.filter((t) =>
    !t.last_scanned_at || Date.now() - new Date(t.last_scanned_at).getTime() > TOPIC_COOLDOWN_MS);
  if (!ready.length) return json({ error: "הנושא נסרק בדקות האחרונות. נסי שוב בעוד כמה דקות.", cooldown: true }, 429);
  if (used + ready.length > SCANS_PER_HOUR) return json({ error: "הרבה סריקות בשעה האחרונה. נסי שוב מאוחר יותר." }, 429);

  const results = await Promise.all(ready.map((t) => scanTopic(t, body.mode === "auto" ? "auto" : "manual", date, blocked)));
  return json({ results, skipped: topics.length - ready.length });
});
