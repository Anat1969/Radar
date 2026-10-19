// End-to-end check against `vite preview` with every Supabase call mocked.
// Clicks every button, verifies the requests sent, checks mobile overflow,
// console errors and PWA installability, and saves screenshots to tests/shots.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:4173";
const SHOTS = "tests/shots";
mkdirSync(SHOTS, { recursive: true });

const now = Date.now();
const iso = (h) => new Date(now - h * 3600_000).toISOString();
const day = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date(now - d * 864e5));
const T = [
  { id: "11111111-1111-1111-1111-111111111111", keyword: "התחדשות עירונית", color: "#4FD1C5", is_active: true, status: "active", last_scanned_at: iso(1), sort_order: 0, created_at: iso(200) },
  { id: "22222222-2222-2222-2222-222222222222", keyword: "אדריכלות", color: "#9F7AEA", is_active: true, status: "active", last_scanned_at: iso(1), sort_order: 1, created_at: iso(200) },
  { id: "33333333-3333-3333-3333-333333333333", keyword: "אומנות בבינה מלאכותית", color: "#F5A623", is_active: true, status: "pending", last_scanned_at: null, sort_order: 2, created_at: iso(200) },
];
const titles = ["תכנית ההתחדשות בראשון לציון קיבלה תוקף", "השכונות שבהן המימוש איטי במיוחד", "המדינה תשלם לרשויות כדי להזיז פרויקטים", "מלון חדש בים המלח", "שדרוג מעבר ישי בבת-ים", "דירה ישנה שזכתה לעניין רב"];
const sources = ["גלובס", "ביזפורטל", "mako", "TheMarker", "YNET", "vietnam.vn"];
const A = [];
for (let i = 0; i < 46; i++) {
  const t = T[i % 2];
  A.push({
    id: `a0000000-0000-0000-0000-${String(i).padStart(12, "0")}`, topic_id: t.id, title: `${titles[i % titles.length]} ${i}`,
    source: sources[i % sources.length], url: `https://example.com/a${i}`, description: i % 3 ? null : "תיאור קצר של הכתבה.",
    published_at: iso(i * 3.4), saved: i === 4, created_at: iso(i === 0 ? 0.05 : 1), relevant: i === 7 ? false : true,
  });
}
const D = [
  { id: "d1", topic_id: T[0].id, date: day(0), headline: "פרויקטים מקבלים תוקף בזמן שהמימוש נתקע", summary: "פסקה ראשונה של התקציר.\n\nפסקה שנייה של התקציר.", themes: [{ label: "אישורי תכניות", weight: 7, note: "תכניות מקבלות תוקף." }, { label: "עיכובים", weight: 5, note: "המימוש איטי." }], entities: [{ name: "חדרה", kind: "מקום" }, { name: "גלובס", kind: "ארגון" }], tone: "מעורב", signal: 72, whats_new: "הסכם חדש בחדרה.", article_count: 19, created_at: iso(1) },
  { id: "d2", topic_id: T[0].id, date: day(2), headline: "כותרת מלפני יומיים", summary: "תקציר ישן.", themes: [], entities: [], tone: "ניטרלי", signal: 40, whats_new: "משהו קודם.", article_count: 9, created_at: iso(50) },
  { id: "d3", topic_id: T[1].id, date: day(0), headline: "מלונאות ותשתית מובילות את הסיקור", summary: "תקציר אדריכלות.", themes: [{ label: "מלונאות", weight: 4, note: "מלון בים המלח." }], entities: [], tone: "חיובי", signal: 35, whats_new: "מלון חדש.", article_count: 9, created_at: iso(1) },
];
const S = { id: 1, scan_hour: 7, auto_scan: true, last_auto_scan: null, updated_at: iso(1), blocked_sources: ["vietnam.vn"] };

const requests = [];
const errors = [];

async function mock(page) {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, body: "", contentType: "text/css" }));
  await page.route(/supabase\.co\/functions\/v1\/radar-scan/, async (r) => {
    requests.push({ method: "POST", path: "radar-scan", body: r.request().postData() });
    await new Promise((res) => setTimeout(res, 300));
    r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ results: [{ topicId: T[0].id, added: 3 }] }) });
  });
  await page.route(/supabase\.co\/rest\/v1\/(radar_\w+)/, (r) => {
    const req = r.request();
    const table = req.url().match(/rest\/v1\/(radar_\w+)/)[1];
    const method = req.method();
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
    if (method === "OPTIONS") return r.fulfill({ status: 204, headers: cors });
    if (method !== "GET") {
      requests.push({ method, path: table, url: req.url(), body: req.postData() });
      return r.fulfill({ status: method === "POST" ? 201 : 204, headers: cors, body: "" });
    }
    const data = { radar_topics: T, radar_articles: A, radar_digests: D, radar_settings: [S] }[table];
    const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    const body = table === "radar_topics" && req.url().includes("keyword=eq") ? T[0] : single ? data[0] : data;
    r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  });
}

const server = spawn("npx", ["vite", "preview", "--port", "4173", "--strictPort"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell" });
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log("FAIL", msg); } else console.log("ok  ", msg); };
const clearReq = () => { requests.length = 0; };

try {
  // Desktop
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "he-IL", permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await mock(page);

  await page.goto(BASE + "/");
  await page.waitForSelector(".card");
  check(await page.locator(".card").count() === 3, "home shows a card per active topic");
  check(await page.locator(".radar-dot").count() >= 30, "radar draws article dots");
  check(!(await page.locator(".ticker-item").allTextContents()).some((t) => t.includes("דירה ישנה שזכתה לעניין רב 7")), "irrelevant article hidden");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/home-desktop.png` });

  // Radar dot pick
  await page.locator(".radar-dot").first().click({ force: true });
  check(await page.locator(".radar-pick").isVisible(), "clicking a dot opens its article card");
  await page.locator(".radar-pick button", { hasText: "סגירה" }).click();

  // Copy link
  await page.locator(".signature-btn").click();
  check(await page.locator(".signature-menu").isVisible(), "signature logo opens the system menu");
  check((await page.locator(".signature-btn").textContent()).includes("ענת שטיבלמן"), "signature shows Anat's name");
  await page.getByRole("menuitem", { name: "העתקת קישור" }).click();
  check((await page.evaluate(() => navigator.clipboard.readText())) === BASE + "/", "copy link copies the current URL");
  await page.locator(".signature-btn").click();
  check(await page.getByRole("menuitem", { name: "שיחת הפיתוח" }).getAttribute("href") === "https://claude.ai/code/session_014ys6u71HTGPETaN4nECMPc", "dev chat link");

  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check(await page.locator(".signature-menu").count() === 0, "Escape closes the menu");

  // Scan all
  clearReq();
  await page.getByRole("button", { name: "סריקה עכשיו" }).click();
  await page.waitForSelector(".toast:has-text('נמצאו')", { timeout: 5000 }).catch(() => {});
  check(requests.some((r) => r.path === "radar-scan" && r.body === "{}"), "scan all sends empty body");
  check((await page.locator(".toast").textContent()).includes("3"), "toast reports new articles");

  // Topic page
  await page.locator(".card").first().click();
  await page.waitForSelector(".topic-hero");
  await page.waitForTimeout(1500);
  check(page.url().endsWith(`/topic/${T[0].id}`), "card opens topic page");
  check(await page.locator(".theme").count() === 2, "themes rendered");
  check(await page.locator(".river-dot").count() > 5, "time river rendered");
  await page.screenshot({ path: `${SHOTS}/topic-desktop.png`, fullPage: true });
  clearReq();
  await page.getByRole("button", { name: "סריקת הנושא" }).click();
  await page.waitForTimeout(600);
  check(requests.some((r) => r.path === "radar-scan" && r.body.includes(T[0].id)), "topic scan sends topicId");

  await page.locator(".river-dot").first().click({ force: true });
  await page.waitForTimeout(700);
  check(page.url().includes("tab=articles") && (await page.locator(".article.is-highlight").count()) === 1, "river dot jumps to the article");
  for (const f of ["24 שעות", "שמורות"]) {
    await page.getByRole("button", { name: f, exact: true }).click();
  }
  check(await page.locator(".article").count() === 1, "saved filter shows the saved article");
  clearReq();
  await page.locator(".article button", { hasText: "הסרה מהשמורות" }).click();
  await page.waitForTimeout(300);
  check(requests.some((r) => r.method === "PATCH" && r.path === "radar_articles" && r.body === '{"saved":false}'), "unsave sends PATCH saved=false");
  await page.getByRole("button", { name: /^הכל/ }).click();
  await page.locator(".article button", { hasText: "שיתוף" }).first().click();
  await page.getByRole("tab", { name: "היסטוריה" }).click();
  check(await page.locator(".history-item").count() === 2, "history lists digests");

  // Briefing
  await page.getByRole("link", { name: "תדריך" }).click();
  await page.waitForSelector(".stories");
  await page.screenshot({ path: `${SHOTS}/briefing-desktop.png` });
  await page.getByRole("button", { name: "הבא" }).click();
  check(page.url().includes("i=1"), "briefing next updates URL");
  await page.getByRole("button", { name: "השהיה" }).click();
  await page.getByRole("button", { name: "המשך" }).click();
  await page.getByRole("button", { name: "הקודם" }).click();
  await page.locator(".story-bar").last().click();
  await page.waitForTimeout(900);
  check(await page.getByRole("button", { name: "מההתחלה" }).isVisible(), "last slide shows summary");
  await page.getByRole("button", { name: "מההתחלה" }).click();

  // Archive
  await page.getByRole("link", { name: "ארכיון" }).click();
  await page.waitForSelector(".heat");
  await page.waitForTimeout(800);
  await page.locator(".heat-cell:not([disabled])").first().click();
  await page.waitForTimeout(900);
  check(await page.locator(".archive-detail").isVisible() && page.url().includes("date="), "heat cell opens digest");
  await page.screenshot({ path: `${SHOTS}/archive-desktop.png` });
  await page.locator(".archive-detail button", { hasText: "סגירה" }).click();

  // Saved
  await page.getByRole("link", { name: "שמורות", exact: true }).click();
  await page.waitForSelector(".page.saved");

  // Topics & settings
  await page.getByRole("link", { name: "נושאים והגדרות" }).click();
  await page.waitForSelector(".topic-row");
  clearReq();
  await page.fill(".add-form input", "תחבורה ציבורית");
  await page.locator(".swatch-btn").nth(3).click();
  await page.getByRole("button", { name: "הוספה למעקב" }).click();
  await page.waitForTimeout(800);
  const ins = requests.find((r) => r.method === "POST" && r.path === "radar_topics");
  check(ins && ins.body.includes("תחבורה ציבורית") && ins.body.includes("#F56565"), "add topic inserts keyword and color");
  check(requests.some((r) => r.path === "radar-scan"), "new topic triggers first scan");
  clearReq();
  await page.locator(".topic-row").nth(1).getByRole("button", { name: "למעלה" }).click();
  await page.waitForTimeout(300);
  check(requests.filter((r) => r.method === "PATCH" && r.path === "radar_topics").length === 3, "reorder patches sort_order");
  clearReq();
  await page.locator(".topic-row").first().getByRole("button", { name: "השהיה" }).click();
  await page.waitForTimeout(300);
  check(requests.some((r) => r.body === '{"is_active":false}'), "pause sends is_active=false");
  clearReq();
  await page.locator(".topic-row").first().getByRole("button", { name: "מחיקה" }).click();
  await page.locator(".topic-row").first().getByRole("button", { name: "ביטול" }).click();
  await page.locator(".topic-row").first().getByRole("button", { name: "מחיקה" }).click();
  await page.locator(".topic-row").first().getByRole("button", { name: "מחיקה סופית" }).click();
  await page.waitForTimeout(300);
  check(requests.some((r) => r.method === "DELETE" && r.path === "radar_topics"), "delete sends DELETE");
  clearReq();
  await page.locator(".switch").click();
  await page.selectOption(".settings select", "8").catch(() => {});
  await page.fill(".inline-form input", "example.com");
  await page.getByRole("button", { name: "הסתרה" }).click();
  await page.getByRole("button", { name: "הסרה", exact: true }).first().click();
  await page.waitForTimeout(400);
  check(requests.some((r) => r.path === "radar_settings" && r.body.includes('"auto_scan":false')), "auto scan toggle saves");
  check(requests.some((r) => r.path === "radar_settings" && r.body.includes("example.com")), "blocked source saves");
  await page.screenshot({ path: `${SHOTS}/topics-desktop.png`, fullPage: true });

  // 404 + brand link
  await page.goto(BASE + "/nowhere");
  await page.waitForSelector("text=אין כאן אות.");
  await page.locator(".brand").click();
  await page.waitForSelector(".card");
  check(page.url() === BASE + "/", "brand links home");

  // Installability
  await page.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  check(installabilityErrors.length === 0, `installable (${JSON.stringify(installabilityErrors)})`);
  await ctx.close();

  // Mobile
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "he-IL" });
  const mp = await m.newPage();
  mp.on("pageerror", (e) => errors.push(String(e)));
  await mock(mp);
  for (const [path, name] of [["/", "home"], [`/topic/${T[0].id}`, "topic"], ["/briefing", "briefing"], ["/archive", "archive"], ["/saved", "saved"], ["/topics", "topics"]]) {
    await mp.goto(BASE + path);
    await mp.waitForTimeout(1600);
    const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(over <= 0, `mobile ${name}: no horizontal scroll (${over})`);
    await mp.screenshot({ path: `${SHOTS}/${name}-mobile.png`, fullPage: name !== "briefing" });
  }
  await m.close();
} finally {
  await browser.close();
  server.kill();
}

const realErrors = errors.filter((e) => !/favicon|Failed to load resource/.test(e));
check(realErrors.length === 0, `no console errors ${realErrors.slice(0, 3).join(" | ")}`);
console.log(failures ? `\n${failures} FAILED` : "\nALL GREEN");
process.exit(failures ? 1 : 0);
