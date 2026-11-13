// api/investigate.js — Investigate, faza 1: "Nešto se promenilo? Saznaj šta i zašto."
// Načelo: SERVER računa sve brojeve i nalaze, AI samo povezuje i objašnjava (ne piše brojeve – koristi oznake {{...}}
// koje server zamenjuje pravim vrednostima).
// Odgovor se šalje u delovima (NDJSON: jedan JSON po redu), da ekran prikazuje napredak provera uživo:
//   {type:"start", checks:[...]}  →  {type:"check", id, status:"done"|"failed"|"skipped", summary}  →  {type:"result", ...}
// GET /api/investigate?client_id=..&from=YYYY-MM-DD&to=YYYY-MM-DD (ili &days=7)&q=<pitanje>&qtype=revenue_drop|roas_drop|spend_up|other&lang=sr|en
import { guard, clientInWorkspace, dbHeaders, SUPABASE_URL } from "./_lib/auth.js";
import { ga4FetchAll, createLimiter, newMeter, meterDone } from "./_lib/ga4.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";
const PAID_GADS_CHANNELS = ["Paid Search", "Cross-network", "Paid Shopping", "Paid Video"]; // isto kao campaigns.js

// ───────────────────────── pomoćne funkcije ─────────────────────────
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayDiff = (a, b) => Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);
const ga4Date = (raw) => `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
const num = (v) => { const x = parseFloat(v); return isFinite(x) ? x : 0; };
const pct = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : null); // null = nema smisla (prethodno 0)
const rate = (a, b) => (b > 0 ? a / b : 0);

async function refreshAccessToken(refresh_token) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, grant_type: "refresh_token" })
  });
  const data = await r.json();
  if (!r.ok) throw new Error("Google token: " + JSON.stringify(data).slice(0, 200));
  return data.access_token;
}

async function db(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: dbHeaders, ...opts });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error("Baza: " + JSON.stringify(d).slice(0, 200));
  return d;
}

function convert(amount, fromCur, toCur, rates) {
  if (fromCur === toCur) return amount;
  const rFrom = fromCur === "EUR" ? 1 : rates && rates[fromCur];
  const rTo = toCur === "EUR" ? 1 : rates && rates[toCur];
  if (!rFrom || !rTo) return null;
  return amount * (rTo / rFrom);
}

// Formatiranje (jezik ekrana)
// Novac: kao u ostalim modulima, glavna valuta je EUR; ako je GA4 u drugoj valuti, originalni iznos ide u zagradu.
// eurFactor = koliko EUR vredi 1 jedinica GA4 valute (null = kurs nije dostupan → ostaje originalna valuta).
function makeFmt(lang, currency, eurFactor) {
  const loc = lang === "sr" ? "sr-RS" : "en-GB";
  const nativeF = new Intl.NumberFormat(loc, { style: "currency", currency, maximumFractionDigits: 0 });
  const eurF = new Intl.NumberFormat(loc, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const useEur = currency !== "EUR" && eurFactor > 0;
  const two = (a, sign) => (useEur ? `${sign}${eurF.format(a * eurFactor)} (${sign}${nativeF.format(a)})` : `${sign}${nativeF.format(a)}`);
  const intF = new Intl.NumberFormat(loc, { maximumFractionDigits: 0 });
  const decF = new Intl.NumberFormat(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const p = (v) => {
    if (v == null) return lang === "sr" ? "novo" : "new";
    const a = Math.abs(v);
    const s = a < 10 && a > 0 ? (Math.round(a * 10) / 10).toLocaleString(loc) : Math.round(a).toLocaleString(loc);
    return (v > 0 ? "+" : v < 0 ? "−" : "") + s + "%";
  };
  const money = (v) => two(Math.abs(v), v < 0 ? "−" : "");
  const moneyDelta = (v) => two(Math.abs(v), v > 0 ? "+" : v < 0 ? "−" : "");
  const date = (s) => { const [y, m, d] = s.split("-"); return lang === "sr" ? `${+d}. ${+m}.` : `${+d}/${+m}`; };
  const pp = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + (Math.round(Math.abs(v) * 10) / 10).toLocaleString(loc) + " p.p.";
  return { money, moneyDelta, int: (v) => intF.format(v), dec: (v) => decF.format(v), pct: p, date, pp, cr: (v) => decF.format(v * 100) + "%" };
}

// GA4 izveštaj sa dva perioda → { key: { cur: {...}, prev: {...} } }
function twoRangeMap(report, dimCount, metricNames) {
  const out = {};
  for (const row of report.rows || []) {
    const dv = row.dimensionValues.map((d) => d.value);
    const rangeIdx = dv[dimCount]; // GA4 dodaje "date_range_0/1" posle naših dimenzija
    const key = dimCount ? dv.slice(0, dimCount).join(" | ") : "_total";
    const m = {};
    metricNames.forEach((n, i) => { m[n] = num(row.metricValues[i].value); });
    const o = out[key] || (out[key] = { key, dims: dv.slice(0, dimCount), cur: null, prev: null });
    const slot = rangeIdx === "date_range_1" ? "prev" : "cur";
    if (o[slot]) { for (const n of metricNames) o[slot][n] += m[n]; } else o[slot] = m;
  }
  const zero = Object.fromEntries(metricNames.map((n) => [n, 0]));
  for (const o of Object.values(out)) { o.cur = o.cur || { ...zero }; o.prev = o.prev || { ...zero }; }
  return out;
}

// ───────────────────────── glavni deo ─────────────────────────
export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const ctx = await guard(req, res);
  if (!ctx) return;
  const { client_id, from, to, days } = req.query;
  if (!client_id || !/^\d{1,12}$/.test(String(client_id))) return res.status(400).json({ error: "Missing client_id" });
  if (!(await clientInWorkspace(client_id, ctx.membership.workspace_id))) return res.status(404).json({ error: "client_not_found" });

  const lang = req.query.lang === "en" ? "en" : "sr";
  const sr = lang === "sr";
  const qtype = ["revenue_drop", "roas_drop", "spend_up", "other"].includes(req.query.qtype) ? req.query.qtype : "other";
  const question = String(req.query.q || "").trim().slice(0, 300);
  const focusCampaignId = /^\d{1,20}$/.test(String(req.query.campaign_id || "")) ? String(req.query.campaign_id) : null;

  // Periodi: tekući, prethodni (iste dužine, odmah pre) i isti period prošle godine (364 dana ranije – isti dani u nedelji)
  let curS, curE;
  const yesterday = addDays(new Date().toISOString().slice(0, 10), -1);
  if (from || to) {
    if (!DATE_OK.test(from || "") || !DATE_OK.test(to || "")) return res.status(400).json({ error: "Invalid period" });
    curS = from; curE = to;
  } else {
    const n = Math.min(Math.max(parseInt(days) || 7, 1), 92);
    curE = yesterday; curS = addDays(curE, -(n - 1));
  }
  const len = dayDiff(curS, curE) + 1;
  if (!(len >= 1 && len <= 92)) return res.status(400).json({ error: sr ? "Period mora biti od 1 do 92 dana" : "Period must be 1–92 days" });
  const prevE = addDays(curS, -1), prevS = addDays(prevE, -(len - 1));
  const yoyS = addDays(curS, -364), yoyE = addDays(curE, -364), yoyPrevS = addDays(prevS, -364), yoyPrevE = addDays(prevE, -364);
  const CUR = { startDate: curS, endDate: curE }, PREV = { startDate: prevS, endDate: prevE };

  // Učitavanje veza (pre početka slanja, da greške mogu da budu obični JSON odgovori)
  let ga4Conn, gadsConn = null;
  try {
    const g = await db(`ga4_connections?client_id=eq.${client_id}&select=property_id,refresh_token,currency_code`);
    if (!Array.isArray(g) || !g.length) return res.status(404).json({ error: "no_ga4" });
    ga4Conn = g[0];
    const a = await db(`google_ads_connections?client_id=eq.${client_id}&select=customer_id,manager_id,currency_code,refresh_token`);
    if (Array.isArray(a) && a.length) gadsConn = a[0];
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
  const currency = ga4Conn.currency_code || "EUR";
  // Kurs za prikaz u EUR (isti izvor kao ostali moduli)
  let rates = null;
  try { const fx = await db("exchange_rates?id=eq.1&select=rates"); rates = fx && fx[0] ? fx[0].rates : null; } catch (e) { rates = null; }
  const eurFactor = currency === "EUR" ? 1 : convert(1, currency, "EUR", rates);
  const F = makeFmt(lang, currency, eurFactor);

  // ── Slanje u delovima ──
  res.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" });
  let closed = false;
  req.on("close", () => { closed = true; });
  const send = (obj) => { if (!closed) { try { res.write(JSON.stringify(obj) + "\n"); } catch (e) { closed = true; } } };

  const t0 = Date.now();
  const meter = newMeter(`investigate client=${client_id} period=${curS}..${curE}`);
  const limit = createLimiter(process.env.GA4_PARALLEL === "0" ? 1 : 4);

  const L = (srTxt, enTxt) => (sr ? srTxt : enTxt);
  const CHECKS = [
    { id: "totals", label: L("Ukupni brojevi", "Overall numbers") },
    { id: "decomp", label: L("Saobraćaj, konverzija ili korpa?", "Traffic, conversion or basket?") },
    { id: "tracking", label: L("Provera merenja", "Tracking check") },
    { id: "channels", label: L("Kanali i izvori", "Channels and sources") },
    { id: "devices", label: L("Uređaji", "Devices") },
    { id: "newret", label: L("Novi i povratni posetioci", "New vs returning visitors") },
    { id: "funnel", label: L("Koraci kupovine", "Purchase steps") },
    { id: "daily", label: L("Kretanje po danima", "Day by day") },
    { id: "landing", label: L("Landing stranice", "Landing pages") },
    { id: "products", label: L("Kategorije i proizvodi", "Categories and products") },
    { id: "gads", label: L("Google Ads kampanje", "Google Ads campaigns") },
    { id: "yoy", label: L("Isti period prošle godine", "Same period last year") },
    { id: "ai", label: L("Povezujem nalaze i pišem objašnjenje", "Connecting findings and writing the explanation") }
  ];
  send({ type: "start", checks: CHECKS, period: { curS, curE, prevS, prevE, len }, currency, eurFactor });

  const findings = [];     // { check, impact (u valuti prihoda, sa znakom), text, facts, label, force }
  const facts = {};        // činjenice koje AI sme da koristi preko oznaka {{...}}
  const doneInfo = {};     // za "Kako sam došao do ovoga": broj stavki po proveri
  const warnings = [];
  const markDone = (id, summary, count) => { doneInfo[id] = { count: count ?? null }; send({ type: "check", id, status: "done", summary }); };
  const markFail = (id, err) => { warnings.push({ check: id, error: String(err && err.message || err).slice(0, 200) }); send({ type: "check", id, status: "failed", summary: L("Provera nije uspela", "Check failed") }); };
  const markSkip = (id, why) => send({ type: "check", id, status: "skipped", summary: why });

  try {
    const token = await refreshAccessToken(ga4Conn.refresh_token);
    const pid = ga4Conn.property_id;
    const run = (body, maxRows = 20000) => ga4FetchAll(pid, token, body, { maxRows, meter, limit });
    const two = (dims, metrics, extra = {}, maxRows) =>
      run({ dateRanges: [CUR, PREV], dimensions: dims.map((name) => ({ name })), metrics: metrics.map((name) => ({ name })), ...extra }, maxRows)
        .then((r) => twoRangeMap(r, dims.length, metrics));

    const BASE = ["sessions", "transactions", "totalRevenue"];

    // Svi GA4 upiti kreću odmah (limiter pazi na najviše 4 istovremeno)
    const lookbackWindows = Math.max(0, Math.min(8, Math.floor(400 / len)));
    const dailyStart = addDays(curS, -lookbackWindows * len);
    const P = {
      totals: two([], BASE),
      funnel: two([], ["itemViewEvents", "addToCarts", "checkouts", "ecommercePurchases"]),
      daily: run({ dateRanges: [{ startDate: dailyStart, endDate: curE }], dimensions: [{ name: "date" }], metrics: BASE.map((name) => ({ name })) }, 1000),
      channels: two(["sessionDefaultChannelGroup"], BASE),
      sources: two(["sessionSourceMedium"], BASE, { orderBys: [{ metric: { metricName: "totalRevenue" }, desc: true }] }, 4000),
      devices: two(["deviceCategory"], BASE),
      newret: two(["newVsReturning"], BASE),
      landing: two(["landingPage"], BASE, { orderBys: [{ metric: { metricName: "sessions" }, desc: true }] }, 10000),
      categories: two(["itemCategory"], ["itemsViewed", "itemsAddedToCart", "itemsPurchased", "itemRevenue"], {}, 10000),
      products: two(["itemId", "itemName"], ["itemsViewed", "itemsAddedToCart", "itemsPurchased", "itemRevenue"], { orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }] }, 100000),
      yoy: run({ dateRanges: [{ startDate: yoyS, endDate: yoyE }, { startDate: yoyPrevS, endDate: yoyPrevE }], metrics: BASE.map((name) => ({ name })) }).then((r) => twoRangeMap(r, 0, BASE)),
      // Proizvodi fokusirane kampanje u oba perioda (samo kad je istraga pokrenuta iz kampanje)
      focusProducts: focusCampaignId ? two(["itemId", "itemName"], ["itemsViewed", "itemsPurchased", "itemRevenue"], { dimensionFilter: { filter: { fieldName: "sessionGoogleAdsCampaignId", stringFilter: { matchType: "EXACT", value: focusCampaignId } } }, orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }] }, 20000) : Promise.resolve(null),
      gadsRev: gadsConn ? two(["sessionGoogleAdsCampaignId", "sessionGoogleAdsCampaignName"], BASE, { dimensionFilter: { filter: { fieldName: "sessionDefaultChannelGroup", inListFilter: { values: PAID_GADS_CHANNELS } } } }) : Promise.resolve(null),
      gadsSpendCur: gadsConn ? db("rpc/get_campaign_spend_totals", { method: "POST", body: JSON.stringify({ p_client_id: Number(client_id), p_start: curS, p_end: curE }) }) : Promise.resolve(null),
      gadsSpendPrev: gadsConn ? db("rpc/get_campaign_spend_totals", { method: "POST", body: JSON.stringify({ p_client_id: Number(client_id), p_start: prevS, p_end: prevE }) }) : Promise.resolve(null),
      rates: Promise.resolve(rates)
    };
    // Rok za celu istragu: provera koja nije gotova za ~100 s od početka označava se kao neuspela,
    // a istraga se završava sa onim što ima (korisnik nikad ne čeka minutima na prazan ekran)
    const DEADLINE = t0 + 100000;
    for (const k of Object.keys(P)) {
      const orig = P[k];
      P[k] = Promise.race([orig, new Promise((_, rej) => { const tm = setTimeout(() => rej(new Error(sr ? "Google nije odgovorio na vreme" : "Google did not respond in time")), Math.max(0, DEADLINE - Date.now())); if (tm.unref) tm.unref(); })]);
      // Odbijeno obećanje ne sme da sruši ostale provere
      P[k].catch(() => {}); orig.catch(() => {});
    }

    // ── 1. Ukupni brojevi + 2. razlaganje ──
    let T = null, dR = 0, R0 = 0, R1 = 0;
    try {
      const t = (await P.totals)._total || { cur: { sessions: 0, transactions: 0, totalRevenue: 0 }, prev: { sessions: 0, transactions: 0, totalRevenue: 0 } };
      const c = t.cur, p = t.prev;
      R1 = c.totalRevenue; R0 = p.totalRevenue; dR = R1 - R0;
      T = {
        cur: { revenue: R1, orders: c.transactions, sessions: c.sessions, cr: rate(c.transactions, c.sessions), aov: rate(R1, c.transactions) },
        prev: { revenue: R0, orders: p.transactions, sessions: p.sessions, cr: rate(p.transactions, p.sessions), aov: rate(R0, p.transactions) }
      };
      T.pct = { revenue: pct(T.cur.revenue, T.prev.revenue), orders: pct(T.cur.orders, T.prev.orders), sessions: pct(T.cur.sessions, T.prev.sessions), cr: pct(T.cur.cr, T.prev.cr), aov: pct(T.cur.aov, T.prev.aov) };
      markDone("totals", `${L("Prihod", "Revenue")} ${F.pct(T.pct.revenue)} · ${L("porudžbine", "orders")} ${F.pct(T.pct.orders)} · ${L("posete", "sessions")} ${F.pct(T.pct.sessions)}`);
    } catch (e) { markFail("totals", e); }

    const significantBase = Math.max(Math.abs(dR), R0 * 0.03, 1); // ispod ovoga promene smatramo šumom
    const addFinding = (f) => { if (Math.abs(f.impact) >= significantBase * 0.05 || f.force) findings.push(f); };

    let decomp = null;
    if (T) {
      // Prihod = posete × konverzija × prosečna porudžbina; uticaj svakog dela (redom, zbir = ukupna promena)
      const s0 = T.prev.sessions, s1 = T.cur.sessions, c0 = T.prev.cr, c1 = T.cur.cr, a0 = T.prev.aov, a1 = T.cur.aov;
      decomp = { traffic: (s1 - s0) * c0 * a0, conversion: s1 * (c1 - c0) * a0, basket: s1 * c1 * (a1 - a0) };
      const parts = [["traffic", L("posete", "traffic"), L("broja poseta", "traffic"), T.pct.sessions], ["conversion", L("konverzija", "conversion"), L("konverzije", "conversion rate"), T.pct.cr], ["basket", L("prosečna porudžbina", "avg. order value"), L("prosečne porudžbine", "avg. order value"), T.pct.aov]];
      markDone("decomp", parts.map(([, n, , v]) => `${n} ${F.pct(v)}`).join(" · "));
      for (const [k, name, gen, v] of parts) {
        addFinding({ check: "decomp", impact: decomp[k], label: `${name} ${F.pct(v)}`,
          text: `${L("Uticaj promene", "Effect of change in")} ${gen} (${F.pct(v)}): ${F.moneyDelta(decomp[k])} ${L("prihoda", "revenue")}` });
      }
    } else markSkip("decomp", L("Nema ukupnih brojeva", "No totals"));

    // ── Zajednička analiza jedne dimenzije (kanali, uređaji, novi/povratni, landing) ──
    const dimAnalysis = (map, check, nameOf, opts = {}) => {
      const rows = Object.values(map).map((o) => {
        const c = o.cur, p = o.prev;
        return { name: nameOf(o), raw: o.dims[0], c, p, dRev: c.totalRevenue - p.totalRevenue,
          revPct: pct(c.totalRevenue, p.totalRevenue), sesPct: pct(c.sessions, p.sessions), crPct: pct(rate(c.transactions, c.sessions), rate(p.transactions, p.sessions)) };
      }).sort((a, b) => Math.abs(b.dRev) - Math.abs(a.dRev));
      const top = rows.slice(0, opts.top || 3);
      for (const r of top) {
        addFinding({ check, impact: r.dRev, label: `${r.name}: ${L("prihod", "revenue")} ${F.pct(r.revPct)}`,
          text: `${r.name}: ${L("prihod", "revenue")} ${F.moneyDelta(r.dRev)} (${F.pct(r.revPct)}) · ${L("posete", "sessions")} ${F.pct(r.sesPct)} · ${L("konverzija", "conversion")} ${F.pct(r.crPct)}`,
          share: dR ? r.dRev / dR : null, drill: opts.drill && r.raw && r.raw !== "(not set)" ? { type: opts.drill, arg: r.raw, name: r.name } : null });
      }
      // Da li je promena ravnomerna (svuda slično) ili skoncentrisana
      const big = rows.filter((r) => r.p.totalRevenue >= R0 * 0.05 || r.c.totalRevenue >= R1 * 0.05);
      const tp = T ? T.pct.revenue : null;
      const uniform = tp != null && big.length >= 2 && big.every((r) => r.revPct != null && Math.sign(r.revPct) === Math.sign(tp) && Math.abs(r.revPct - tp) <= 12);
      const topShare = dR && rows[0] ? rows[0].dRev / dR : 0;
      let summary;
      if (!rows.length) summary = L("Nema podataka", "No data");
      else if (uniform) summary = L("Promena je slična u svim većim stavkama – nije problem jedne stavke", "Change is similar across all major items – not a single-item issue");
      else if (topShare >= 0.5) summary = `${L("Najveći deo promene", "Most of the change")}: ${rows[0].name} (${F.moneyDelta(rows[0].dRev)}, ${F.pct(rows[0].revPct)})`;
      else summary = top.map((r) => `${r.name} ${F.pct(r.revPct)}`).join(" · ");
      const dimLabel = (CHECKS.find((x) => x.id === check) || {}).label || check;
      if (uniform) addFinding({ check, impact: dR * 0.5, force: true, label: `${dimLabel}: ${L("ravnomerna promena", "uniform change")}`, text: `${dimLabel}: ${summary}` });
      return { rows, summary, uniform };
    };

    // ── 4. Kanali i izvori ──
    let channelMap = null;
    try {
      channelMap = await P.channels;
      const a = dimAnalysis(channelMap, "channels", (o) => o.dims[0] || "(not set)", { drill: "channel" });
      try {
        const src = await P.sources;
        const sr2 = Object.values(src).map((o) => ({ name: o.dims[0], d: o.cur.totalRevenue - o.prev.totalRevenue, p: pct(o.cur.totalRevenue, o.prev.totalRevenue) })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
        if (sr2[0]) {
          addFinding({ check: "channels", impact: sr2[0].d, label: `${sr2[0].name}: ${F.pct(sr2[0].p)}`, text: `${L("Izvor", "Source")} ${sr2[0].name}: ${L("prihod", "revenue")} ${F.moneyDelta(sr2[0].d)} (${F.pct(sr2[0].p)})` });
        }
        doneInfo.sources = { count: sr2.length };
      } catch (e) { warnings.push({ check: "sources", error: e.message.slice(0, 200) }); }
      markDone("channels", a.summary, a.rows.length);
    } catch (e) { markFail("channels", e); }

    // ── 5. Uređaji ──
    try {
      const dn = { mobile: L("mobilni", "mobile"), desktop: L("računar", "desktop"), tablet: "tablet", smart_tv: "smart TV" };
      const a = dimAnalysis(await P.devices, "devices", (o) => dn[o.dims[0]] || o.dims[0], { drill: "device" });
      markDone("devices", a.summary, a.rows.length);
    }
    catch (e) { markFail("devices", e); }

    // ── 6. Novi i povratni ──
    try {
      const nm = (v) => (v === "new" ? L("novi posetioci", "new visitors") : v === "returning" ? L("povratni posetioci", "returning visitors") : v || "(not set)");
      const a = dimAnalysis(await P.newret, "newret", (o) => nm(o.dims[0]), { top: 2 });
      markDone("newret", a.summary, a.rows.length);
    } catch (e) { markFail("newret", e); }

    // ── 7. Koraci kupovine ──
    try {
      const f = (await P.funnel)._total;
      if (!f) throw new Error("no data");
      const steps = [
        ["view_cart", L("pregled → korpa", "view → cart"), rate(f.cur.addToCarts, f.cur.itemViewEvents), rate(f.prev.addToCarts, f.prev.itemViewEvents)],
        ["cart_checkout", L("korpa → plaćanje", "cart → checkout"), rate(f.cur.checkouts, f.cur.addToCarts), rate(f.prev.checkouts, f.prev.addToCarts)],
        ["checkout_purchase", L("plaćanje → kupovina", "checkout → purchase"), rate(f.cur.ecommercePurchases, f.cur.checkouts), rate(f.prev.ecommercePurchases, f.prev.checkouts)]
      ].map(([id, name, c, p]) => ({ id, name, c, p, ch: pct(c, p) }));
      const valid = steps.filter((s) => s.p > 0);
      if (!valid.length) { markSkip("funnel", L("Sajt ne šalje korake kupovine (view_item / add_to_cart / begin_checkout)", "Site does not send purchase-step events")); }
      else {
        const worst = [...valid].sort((a, b) => (a.ch ?? 0) - (b.ch ?? 0))[0];
        const best = [...valid].sort((a, b) => (b.ch ?? 0) - (a.ch ?? 0))[0];
        const pick = qtype === "revenue_drop" || qtype === "roas_drop" || (T && T.pct.revenue != null && T.pct.revenue < 0) ? worst : best;
        if (pick && pick.ch != null && Math.abs(pick.ch) >= 10) {
          // Grub uticaj: promena tog koraka × prihod prethodnog perioda
          addFinding({ check: "funnel", impact: R0 * (pick.ch / 100), label: `${pick.name} ${F.pct(pick.ch)}`,
            text: `${L("Korak", "Step")} ${pick.name}: ${F.cr(pick.p)} → ${F.cr(pick.c)} (${F.pct(pick.ch)})` });
        }
        markDone("funnel", valid.map((s) => `${s.name} ${F.pct(s.ch)}`).join(" · "), valid.length);
      }
    } catch (e) { markFail("funnel", e); }

    // ── 9. Landing stranice (pre provere merenja, jer i ona koristi ove podatke) ──
    let finishFlag = null;
    try {
      const m = await P.landing;
      const a = dimAnalysis(m, "landing", (o) => o.dims[0] || "(not set)", { drill: "landing" });
      // Sesije koje POČINJU na stranici završetka kupovine/plaćanja = kupac se vratio sa stranice banke/kredita,
      // GA4 je započeo novu sesiju i prodaja se pripisuje pogrešnom izvoru.
      const FINISH = /(finish|thank|hvala|uspesn|success|confirm|potvrd|order-received|narudzbina-primljena|payment|placanje)/i;
      const fin = Object.values(m).filter((o) => FINISH.test(o.dims[0] || ""));
      if (fin.length && T) {
        const fc = fin.reduce((x, o) => x + o.cur.totalRevenue, 0), fp = fin.reduce((x, o) => x + o.prev.totalRevenue, 0);
        const sc = rate(fc, R1) * 100, sp = rate(fp, R0) * 100;
        if (sc >= 3) {
          const ex = [...fin].sort((x, y) => y.cur.totalRevenue - x.cur.totalRevenue).slice(0, 2).map((o) => o.dims[0]).join(", ");
          finishFlag = L(`${Math.round(sc)}% prihoda (ranije ${Math.round(sp)}%) dolazi iz sesija koje počinju na stranici završetka kupovine/plaćanja (${ex}) – kupac se vraća sa stranice banke ili kredita, GA4 započinje novu sesiju i ta prodaja se pripisuje pogrešnom izvoru (rešenje: GA4 → Admin → Data streams → Configure tag settings → List unwanted referrals – dodati domene banke i kreditnih partnera)`,
                         `${Math.round(sc)}% of revenue (before ${Math.round(sp)}%) comes from sessions that start on an order-finish/payment page (${ex}) – buyers return from a bank/credit page, GA4 starts a new session and the sale is attributed to the wrong source (fix: GA4 → Admin → Data streams → Configure tag settings → List unwanted referrals – add bank/credit partner domains)`);
        }
      }
      markDone("landing", a.summary, a.rows.length);
    } catch (e) { markFail("landing", e); }

    // ── 8. Kretanje po danima + 3. provera merenja ──
    let daily = null;
    try {
      const r = await P.daily;
      const byDay = {};
      for (const row of r.rows || []) {
        byDay[ga4Date(row.dimensionValues[0].value)] = { s: num(row.metricValues[0].value), o: num(row.metricValues[1].value), r: num(row.metricValues[2].value) };
      }
      const get = (d) => byDay[d] || { s: 0, o: 0, r: 0 };
      daily = byDay;
      // Tačka promene: dan posle kog se prosečan dnevni prihod najviše razlikuje (prethodni + tekući period)
      const series = [];
      for (let d = prevS; d <= curE; d = addDays(d, 1)) series.push({ d, ...get(d) });
      let best = null;
      if (series.length >= 4) {
        const sum = series.reduce((a, x) => a + x.r, 0);
        let left = 0;
        left = series[0].r;
        for (let k = 2; k <= series.length - 2; k++) {
          left += series[k - 1].r; // zbir prvih k dana
          const mL = left / k, mR = (sum - left) / (series.length - k);
          let sse = 0;
          for (let i = 0; i < series.length; i++) { const m = i < k ? mL : mR; sse += (series[i].r - m) ** 2; }
          if (!best || sse < best.sse) best = { k, sse, mL, mR };
        }
      }
      let changeTxt = "";
      if (best && best.mL > 0 && Math.abs(best.mR - best.mL) / best.mL >= 0.15) {
        const startDay = series[best.k].d;
        const ch = pct(best.mR, best.mL);
        changeTxt = `${L("Promena počinje oko", "Change starts around")} ${F.date(startDay)} (${L("dnevni prihod", "daily revenue")} ${F.pct(ch)} ${L("u odnosu na dane pre toga", "vs. the days before")})`;
        addFinding({ check: "daily", impact: dR * 0.3, force: true, label: `${L("od", "from")} ${F.date(startDay)}`, text: changeTxt, facts: { change_start: F.date(startDay) } });
      }
      // Normalno kolebanje: zbir istih perioda unazad (do 8)
      let oscTxt = "";
      if (lookbackWindows >= 3 && T) {
        const sums = [];
        for (let w = 1; w <= lookbackWindows; w++) {
          const s = addDays(curS, -w * len); let tot = 0;
          for (let i = 0; i < len; i++) tot += get(addDays(s, i)).r;
          sums.push(tot);
        }
        const mean = sums.reduce((a, b) => a + b, 0) / sums.length;
        const sd = Math.sqrt(sums.reduce((a, b) => a + (b - mean) ** 2, 0) / sums.length);
        const z = sd > 0 ? (R1 - mean) / sd : 0;
        const minS = Math.min(...sums), maxS = Math.max(...sums);
        if (R1 >= minS && R1 <= maxS && Math.abs(z) < 1.5) {
          oscTxt = L(` · tekući period je u granicama uobičajenog za ovog klijenta (poslednjih ${sums.length} perioda: ${F.money(minS)}–${F.money(maxS)})`, ` · current period is within this client's normal range (last ${sums.length} periods: ${F.money(minS)}–${F.money(maxS)})`);
          addFinding({ check: "daily", impact: dR * 0.4, force: true, label: L("u granicama uobičajenog", "within normal range"), text: oscTxt.slice(3) });
        } else if (sums.length) {
          oscTxt = L(` · izvan uobičajenog (poslednjih ${sums.length} perioda: ${F.money(minS)}–${F.money(maxS)})`, ` · outside normal range (last ${sums.length} periods: ${F.money(minS)}–${F.money(maxS)})`);
        }
      }
      markDone("daily", (changeTxt || L("Nema jasnog dana od kog počinje promena", "No clear day where the change starts")) + oscTxt, series.length);

      // Provera merenja
      const flags = [];
      const curDays = []; for (let d = curS; d <= curE; d = addDays(d, 1)) curDays.push({ d, ...get(d) });
      const medS = (() => { const a = Object.values(byDay).map((x) => x.s).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; })();
      const gaps = curDays.filter((x) => medS > 50 && x.s < medS * 0.3);
      if (gaps.length) flags.push(`${L("dani sa skoro bez poseta (moguća rupa u merenju)", "days with almost no sessions (possible tracking gap)")}: ${gaps.map((x) => F.date(x.d)).join(", ")}`);
      const noRev = curDays.filter((x) => x.o >= 3 && x.r <= 0);
      if (noRev.length) flags.push(`${L("dani sa kupovinama bez prihoda", "days with purchases but no revenue")}: ${noRev.map((x) => F.date(x.d)).join(", ")}`);
      const noOrders = curDays.filter((x) => medS > 50 && x.s >= medS * 0.5 && x.o === 0 && T && T.prev.orders / len >= 3);
      if (noOrders.length) flags.push(`${L("dani sa normalnim posetama a bez ijedne kupovine", "days with normal traffic but zero purchases")}: ${noOrders.map((x) => F.date(x.d)).join(", ")}`);
      if (channelMap) {
        const un = Object.values(channelMap).find((o) => o.dims[0] === "Unassigned");
        const totS = (side) => Object.values(channelMap).reduce((a, o) => a + o[side].sessions, 0);
        if (un) {
          const sc = rate(un.cur.sessions, totS("cur")) * 100, sp = rate(un.prev.sessions, totS("prev")) * 100;
          if (sc - sp >= 5) flags.push(`${L("udeo neprepoznatog saobraćaja (Unassigned)", "share of Unassigned traffic")}: ${Math.round(sp)}% → ${Math.round(sc)}%`);
        }
      }
      if (finishFlag) flags.push(finishFlag);
      if (flags.length) {
        flags.forEach((t) => addFinding({ check: "tracking", impact: dR * 0.5, force: true, label: L("moguć problem u merenju", "possible tracking issue"), text: t }));
        markDone("tracking", flags[0] + (flags.length > 1 ? ` (+${flags.length - 1})` : ""), flags.length);
      } else markDone("tracking", L("Nema znakova problema sa merenjem", "No signs of tracking problems"), 0);
    } catch (e) { markFail("daily", e); markFail("tracking", e); }


    // ── 10. Kategorije i proizvodi ──
    try {
      const IT = ["itemsViewed", "itemsAddedToCart", "itemsPurchased", "itemRevenue"];
      const cats = Object.values(await P.categories).map((o) => ({ name: o.dims[0] || "(not set)", c: o.cur, p: o.prev, d: o.cur.itemRevenue - o.prev.itemRevenue }))
        .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
      for (const c of cats.slice(0, 3)) {
        // Prosečna cena po prodatom komadu – otkriva promenu "miksa" (prodaje se skuplje/jeftinije unutar kategorije)
        const upc = pct(rate(c.c.itemRevenue, c.c.itemsPurchased), rate(c.p.itemRevenue, c.p.itemsPurchased));
        const mix = upc != null && Math.abs(upc) >= 25 ? (upc > 0 ? L(" – prodaju se skuplji proizvodi nego ranije", " – more expensive items are selling than before") : L(" – prodaju se jeftiniji proizvodi nego ranije", " – cheaper items are selling than before")) : "";
        addFinding({ check: "products", impact: c.d, drill: c.name !== "(not set)" ? { type: "category", arg: c.name, name: c.name } : null, label: `${L("kategorija", "category")} ${c.name} ${F.pct(pct(c.c.itemRevenue, c.p.itemRevenue))}`,
          text: `${L("Kategorija", "Category")} ${c.name}: ${L("prihod", "revenue")} ${F.moneyDelta(c.d)} (${F.pct(pct(c.c.itemRevenue, c.p.itemRevenue))}) · ${L("pregledi", "views")} ${F.pct(pct(c.c.itemsViewed, c.p.itemsViewed))} · ${L("korpa", "cart")} ${F.pct(pct(c.c.itemsAddedToCart, c.p.itemsAddedToCart))} · ${L("kupljeno", "purchased")} ${F.pct(pct(c.c.itemsPurchased, c.p.itemsPurchased))} · ${L("prosečna cena po komadu", "avg. price per unit")} ${F.pct(upc)}${mix}` });
      }
      const prodMap = await P.products;
      // Isti itemId sa više naziva → saberi
      const byId = {};
      for (const o of Object.values(prodMap)) {
        const id = o.dims[0];
        const t = byId[id] || (byId[id] = { id, name: o.dims[1], c: Object.fromEntries(IT.map((n) => [n, 0])), p: Object.fromEntries(IT.map((n) => [n, 0])) });
        for (const n of IT) { t.c[n] += o.cur[n]; t.p[n] += o.prev[n]; }
      }
      const prods = Object.values(byId).map((x) => ({ ...x, d: x.c.itemRevenue - x.p.itemRevenue }));
      const sorted = [...prods].sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
      for (const x of sorted.slice(0, 3)) {
        addFinding({ check: "products", impact: x.d, label: `${x.name} ${F.pct(pct(x.c.itemRevenue, x.p.itemRevenue))}`,
          text: `${L("Proizvod", "Product")} ${x.name}: ${L("prihod", "revenue")} ${F.moneyDelta(x.d)} (${F.pct(pct(x.c.itemRevenue, x.p.itemRevenue))}) · ${L("pregledi", "views")} ${F.pct(pct(x.c.itemsViewed, x.p.itemsViewed))} · ${L("kupljeno", "purchased")} ${F.pct(pct(x.c.itemsPurchased, x.p.itemsPurchased))}` });
      }
      // "Nestali" proizvodi: ranije dosta pregleda, sada skoro ništa
      const gone = prods.filter((x) => x.p.itemsViewed >= 50 && x.c.itemsViewed <= x.p.itemsViewed * 0.1);
      if (gone.length) {
        const lost = gone.reduce((a, x) => a + x.p.itemRevenue - x.c.itemRevenue, 0);
        addFinding({ check: "products", impact: -lost, force: lost > 0, label: L(`${gone.length} „nestalih" proizvoda`, `${gone.length} "vanished" products`),
          text: L(`${gone.length} proizvoda je ranije imalo bar 50 pregleda, a sada skoro nijedan (npr. ${gone.slice(0, 3).map((x) => x.name).join(", ")}) – ranije su doneli ${F.money(gone.reduce((a, x) => a + x.p.itemRevenue, 0))}`,
                  `${gone.length} products had 50+ views before and almost none now (e.g. ${gone.slice(0, 3).map((x) => x.name).join(", ")}) – they brought ${F.money(gone.reduce((a, x) => a + x.p.itemRevenue, 0))} before`) });
      }
      // Promena cene: proizvodi sa bar 5 kupovina u oba perioda i prosečnom cenom većom/manjom za 10%+
      const priced = prods.filter((x) => x.c.itemsPurchased >= 5 && x.p.itemsPurchased >= 5).map((x) => ({ ...x, pc: rate(x.c.itemRevenue, x.c.itemsPurchased), pp: rate(x.p.itemRevenue, x.p.itemsPurchased) }))
        .map((x) => ({ ...x, ch: pct(x.pc, x.pp) })).filter((x) => x.ch != null && Math.abs(x.ch) >= 10);
      if (priced.length) {
        const up = priced.filter((x) => x.ch > 0), down = priced.filter((x) => x.ch < 0);
        const top = [...priced].sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 3);
        addFinding({ check: "products", impact: top.reduce((a, x) => a + x.d, 0), label: L("promene cena", "price changes"),
          text: L(`Prosečna prodajna cena se promenila za 10%+ kod ${priced.length} proizvoda (${up.length} poskupelo, ${down.length} pojeftinilo), npr. ${top.map((x) => `${x.name} ${F.pct(x.ch)}`).join(", ")}`,
                  `Average selling price changed 10%+ for ${priced.length} products (${up.length} up, ${down.length} down), e.g. ${top.map((x) => `${x.name} ${F.pct(x.ch)}`).join(", ")}`) });
      }
      const catTxt = cats[0] ? `${L("Najveća promena", "Biggest change")}: ${cats[0].name} (${F.moneyDelta(cats[0].d)})` : L("Nema kategorija", "No categories");
      markDone("products", `${catTxt} · ${L("provereno", "checked")} ${F.int(prods.length)} ${L("proizvoda", "products")}${gone.length ? ` · ${gone.length} ${L("nestalih", "vanished")}` : ""}`, prods.length);
      doneInfo.categories = { count: cats.length };
    } catch (e) { markFail("products", e); }

    // ── 11. Google Ads kampanje ──
    let gadsTotals = null;
    if (!gadsConn) markSkip("gads", L("Google Ads nije povezan", "Google Ads not connected"));
    else {
      try {
        const [rev, sc, sp, rates] = await Promise.all([P.gadsRev, P.gadsSpendCur, P.gadsSpendPrev, P.rates]);
        const gCur = gadsConn.currency_code || "EUR";
        let fxMissing = false;
        const toRev = (v) => { const x = convert(v, gCur, currency, rates); if (x == null) { fxMissing = true; return v; } return x; };
        const camps = {};
        const get = (id, name) => camps[id] || (camps[id] = { id, name: name || id, sc: 0, sp: 0, rc: 0, rp: 0, kc: 0, kp: 0, ic: 0, ip: 0 });
        for (const r of sc || []) { const c = get(String(r.campaign_id), r.campaign_name); c.sc += toRev(num(r.total_spend)); c.kc += num(r.total_clicks); c.ic += num(r.total_impressions); }
        for (const r of sp || []) { const c = get(String(r.campaign_id), r.campaign_name); c.sp += toRev(num(r.total_spend)); c.kp += num(r.total_clicks); c.ip += num(r.total_impressions); }
        for (const o of Object.values(rev || {})) {
          const id = o.dims[0]; if (!id || id === "(not set)") continue;
          const c = get(id, o.dims[1] && o.dims[1] !== "(not set)" ? o.dims[1] : null); c.rc += o.cur.totalRevenue; c.rp += o.prev.totalRevenue;
          if (c.name === id && o.dims[1] && o.dims[1] !== "(not set)") c.name = o.dims[1];
        }
        const list = Object.values(camps);
        const S1 = list.reduce((a, c) => a + c.sc, 0), S0 = list.reduce((a, c) => a + c.sp, 0);
        const G1 = list.reduce((a, c) => a + c.rc, 0), G0 = list.reduce((a, c) => a + c.rp, 0);
        gadsTotals = { spendCur: S1, spendPrev: S0, revCur: G1, revPrev: G0, roasCur: rate(G1, S1), roasPrev: rate(G0, S0), fxMissing };
        const sorted = [...list].sort((a, b) => Math.max(Math.abs(b.rc - b.rp), Math.abs(b.sc - b.sp)) - Math.max(Math.abs(a.rc - a.rp), Math.abs(a.sc - a.sp)));
        for (const c of sorted.slice(0, 3)) {
          const dRev = c.rc - c.rp, dSp = c.sc - c.sp;
          const status = c.sp === 0 && c.sc > 0 ? L(" (nova u ovom periodu)", " (new this period)") : c.sc === 0 && c.sp > 0 ? L(" (bez potrošnje u ovom periodu – pauzirana?)", " (no spend this period – paused?)") : "";
          const cpcTxt = c.kp > 0 && c.kc > 0 ? ` · CPC ${F.pct(pct(rate(c.sc, c.kc), rate(c.sp, c.kp)))} · CTR ${F.pct(pct(rate(c.kc, c.ic), rate(c.kp, c.ip)))}` : "";
          addFinding({ check: "gads", impact: Math.abs(dRev) >= Math.abs(dSp) ? dRev : -dSp, label: `${c.name}${status}`, drill: { type: "campaign", arg: c.id, name: c.name },
            text: `${L("Kampanja", "Campaign")} ${c.name}${status}: ${L("potrošnja", "spend")} ${F.money(c.sp)} → ${F.money(c.sc)} · ${L("prihod", "revenue")} ${F.money(c.rp)} → ${F.money(c.rc)} · ROAS ${F.dec(rate(c.rp, c.sp))} → ${F.dec(rate(c.rc, c.sc))}${cpcTxt}` });
        }
        // Fokusirana kampanja: uvek u nalazima, sa svojim brojevima i proizvodima koji su se najviše promenili
        if (focusCampaignId) {
          const fc = camps[focusCampaignId];
          if (fc) {
            const fRoasC = rate(fc.rc, fc.sc), fRoasP = rate(fc.rp, fc.sp);
            addFinding({ check: "gads", impact: 1e15, force: true, label: `${fc.name}: ROAS ${F.dec(fRoasP)} → ${F.dec(fRoasC)}`,
              text: `${L("Izabrana kampanja", "Selected campaign")} ${fc.name}: ${L("potrošnja", "spend")} ${F.money(fc.sp)} → ${F.money(fc.sc)} (${F.pct(pct(fc.sc, fc.sp))}) · ${L("prihod", "revenue")} ${F.money(fc.rp)} → ${F.money(fc.rc)} (${F.pct(pct(fc.rc, fc.rp))}) · ROAS ${F.dec(fRoasP)} → ${F.dec(fRoasC)}`,
              facts: { focus_campaign: fc.name, focus_roas: `${F.dec(fRoasP)} → ${F.dec(fRoasC)}`, focus_revenue_pct: F.pct(pct(fc.rc, fc.rp)), focus_spend_pct: F.pct(pct(fc.sc, fc.sp)) } });
          }
          try {
            const fp = await P.focusProducts;
            const items = Object.values(fp || {}).map((o) => ({ name: o.dims[1] || o.dims[0], c: o.cur, p: o.prev, d: o.cur.itemRevenue - o.prev.itemRevenue }))
              .sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 3);
            if (items.length) addFinding({ check: "gads", impact: 1e15 - 1, force: true, label: L("proizvodi izabrane kampanje", "selected campaign's products"),
              text: `${L("Proizvodi kampanje sa najvećom promenom", "Campaign products with the biggest change")}: ${items.map((x) => `${x.name} ${F.moneyDelta(x.d)} (${F.pct(pct(x.c.itemRevenue, x.p.itemRevenue))})`).join("; ")}` });
          } catch (e) { warnings.push({ check: "focusProducts", error: String(e.message).slice(0, 200) }); }
        }
        markDone("gads", `${L("Potrošnja", "Spend")} ${F.pct(pct(S1, S0))} · ${L("prihod iz Google Ads", "Google Ads revenue")} ${F.pct(pct(G1, G0))} · ROAS ${F.dec(rate(G0, S0))} → ${F.dec(rate(G1, S1))}${fxMissing ? L(" · kurs nedostaje", " · FX rate missing") : ""}`, list.length);
      } catch (e) { markFail("gads", e); }
    }

    // ── 12. Isti period prošle godine ──
    try {
      const y = (await P.yoy)._total;
      if (!y || (y.cur.sessions === 0 && y.prev.sessions === 0)) markSkip("yoy", L("Nema podataka za prošlu godinu", "No data for last year"));
      else {
        const lyCh = pct(y.cur.totalRevenue, y.prev.totalRevenue);
        const yoyRev = pct(R1, y.cur.totalRevenue);
        const seasonal = T && T.pct.revenue != null && lyCh != null && Math.sign(lyCh) === Math.sign(T.pct.revenue) && Math.abs(lyCh) >= Math.abs(T.pct.revenue) * 0.5;
        const txt = L(`Prošle godine je u istim nedeljama promena bila ${F.pct(lyCh)}${seasonal ? " – slično kao sada, verovatno sezona" : ""} · prihod u odnosu na prošlu godinu ${F.pct(yoyRev)}`,
                      `Last year the same weeks changed ${F.pct(lyCh)}${seasonal ? " – similar to now, likely seasonal" : ""} · revenue vs last year ${F.pct(yoyRev)}`);
        addFinding({ check: "yoy", impact: seasonal ? dR * 0.6 : dR * 0.1, force: seasonal, label: seasonal ? L("sezonski obrazac", "seasonal pattern") : L("prošla godina", "last year"), text: txt });
        markDone("yoy", txt);
      }
    } catch (e) { markFail("yoy", e); }


    // ── DRUGI KRUG: dublje provere za najveće nalaze (najviše 3) ──
    // Server sam bira gde da kopa (po težini nalaza), radi dodatne GA4/Google Ads upite i računa nove nalaze.
    const drills = [];
    const want = (d) => { if (d && d.arg != null && drills.length < 3 && !drills.some((x) => x.type === d.type)) drills.push(d); };
    if (focusCampaignId && gadsConn) {
      const ff = findings.find((f) => f.facts && f.facts.focus_campaign);
      want({ type: "campaign", arg: focusCampaignId, name: ff ? ff.facts.focus_campaign : focusCampaignId });
    }
    for (const f of findings.filter((x) => !x.force && x.drill).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))) {
      if (f.drill.type === "campaign" && !gadsConn) continue;
      want(f.drill);
    }
    if (drills.length < 3) drills.push({ type: "geo", arg: "", name: "" });

    const short = (x, n = 40) => (String(x).length > n ? String(x).slice(0, n - 1) + "…" : String(x));
    const drillLabel = (d) => `${L("Dublje", "Deeper")}: ${d.type === "geo" ? L("zemlje i gradovi", "countries and cities")
      : d.type === "category" ? `${L("kategorija", "category")} ${short(d.name)}`
      : d.type === "campaign" ? `${L("kampanja", "campaign")} ${short(d.name)}`
      : d.type === "landing" ? `landing ${short(d.name)}` : short(d.name)}`;
    const ex = (field, value) => ({ filter: { fieldName: field, stringFilter: { matchType: "EXACT", value: String(value) } } });
    const addDeep = (f) => { if (Math.abs(f.impact) >= significantBase * 0.03) findings.push({ ...f, deep: true }); };
    const segTxt = (c, p) => `${L("prihod", "revenue")} ${F.moneyDelta(c.totalRevenue - p.totalRevenue)} (${F.pct(pct(c.totalRevenue, p.totalRevenue))}) · ${L("posete", "sessions")} ${F.pct(pct(c.sessions, p.sessions))} · ${L("konverzija", "conversion")} ${F.pct(pct(rate(c.transactions, c.sessions), rate(p.transactions, p.sessions)))}`;
    const topChanges = (map, n, key = "totalRevenue") => Object.values(map || {}).map((o) => ({ o, d: o.cur[key] - o.prev[key] })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, n);
    const IT = ["itemsViewed", "itemsAddedToCart", "itemsPurchased", "itemRevenue"];

    const DRILL = {
      // Uređaj: operativni sistem/pregledač + koraci kupovine samo na tom uređaju
      device: async (d) => {
        const [osb, fun] = await Promise.all([
          two(["operatingSystem", "browser"], BASE, { dimensionFilter: ex("deviceCategory", d.arg), orderBys: [{ metric: { metricName: "sessions" }, desc: true }] }, 2000),
          two([], ["itemViewEvents", "addToCarts", "checkouts", "ecommercePurchases"], { dimensionFilter: ex("deviceCategory", d.arg) })
        ]);
        const tops = topChanges(osb, 2);
        for (const { o, d: dd } of tops) addDeep({ check: "drill_device", impact: dd, label: `${d.name} – ${o.dims[0]} / ${o.dims[1]}`, text: `${d.name} – ${o.dims[0]} / ${o.dims[1]}: ${segTxt(o.cur, o.prev)}` });
        const devPrev = Object.values(osb).reduce((a, o) => a + o.prev.totalRevenue, 0);
        const f = fun && fun._total;
        let stepTxt = "";
        if (f) {
          const steps = [[L("pregled → korpa", "view → cart"), f.cur.addToCarts / (f.cur.itemViewEvents || NaN), f.prev.addToCarts / (f.prev.itemViewEvents || NaN)],
            [L("korpa → plaćanje", "cart → checkout"), f.cur.checkouts / (f.cur.addToCarts || NaN), f.prev.checkouts / (f.prev.addToCarts || NaN)],
            [L("plaćanje → kupovina", "checkout → purchase"), f.cur.ecommercePurchases / (f.cur.checkouts || NaN), f.prev.ecommercePurchases / (f.prev.checkouts || NaN)]]
            .filter(([, c, p]) => isFinite(c) && isFinite(p) && p > 0).map(([n, c, p]) => ({ n, c, p, ch: pct(c, p) }));
          const w = [...steps].sort((a, b) => (dR < 0 ? a.ch - b.ch : b.ch - a.ch))[0];
          if (w && Math.abs(w.ch) >= 10) {
            stepTxt = ` · ${w.n} ${F.pct(w.ch)}`;
            addDeep({ check: "drill_device", impact: devPrev * (w.ch / 100), label: `${d.name}: ${w.n} ${F.pct(w.ch)}`, text: `${d.name} – ${L("korak", "step")} ${w.n}: ${F.cr(w.p)} → ${F.cr(w.c)} (${F.pct(w.ch)})` });
          }
        }
        return { summary: (tops[0] ? `${tops[0].o.dims[0]} / ${tops[0].o.dims[1]} ${F.pct(pct(tops[0].o.cur.totalRevenue, tops[0].o.prev.totalRevenue))}` : L("Nema podataka", "No data")) + stepTxt, count: Object.keys(osb).length };
      },
      // Kanal: izvor/medijum i UTM kampanja unutar tog kanala (npr. koja Meta kampanja u Paid Social)
      channel: async (d) => {
        const m = await two(["sessionSourceMedium", "sessionCampaignName"], BASE, { dimensionFilter: ex("sessionDefaultChannelGroup", d.arg), orderBys: [{ metric: { metricName: "totalRevenue" }, desc: true }] }, 5000);
        const tops = topChanges(m, 3);
        for (const { o, d: dd } of tops) {
          const camp = o.dims[1] && o.dims[1] !== "(not set)" && o.dims[1] !== "(direct)" && o.dims[1] !== "(organic)" ? ` · ${L("kampanja", "campaign")} ${o.dims[1]}` : "";
          addDeep({ check: "drill_channel", impact: dd, label: `${d.name} – ${o.dims[0]}${camp}`, text: `${d.name} – ${o.dims[0]}${camp}: ${segTxt(o.cur, o.prev)}` });
        }
        return { summary: tops[0] ? `${tops[0].o.dims[0]}${tops[0].o.dims[1] && tops[0].o.dims[1] !== "(not set)" ? " · " + short(tops[0].o.dims[1], 30) : ""} ${F.moneyDelta(tops[0].d)}` : L("Nema podataka", "No data"), count: Object.keys(m).length };
      },
      // Kategorija: proizvodi u njoj + podela po uređajima (da se vidi da li je to "isti problem" kao uređaj)
      category: async (d) => {
        const [items, dev] = await Promise.all([
          two(["itemId", "itemName"], IT, { dimensionFilter: ex("itemCategory", d.arg), orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }] }, 20000),
          two(["deviceCategory"], IT, { dimensionFilter: ex("itemCategory", d.arg) })
        ]);
        const ti = topChanges(items, 3, "itemRevenue");
        if (ti.length) addDeep({ check: "drill_category", impact: ti.reduce((a, x) => a + x.d, 0), label: `${L("kategorija", "category")} ${d.name}: ${L("proizvodi", "products")}`,
          text: `${L("Kategorija", "Category")} ${d.name} – ${L("proizvodi sa najvećom promenom", "products with the biggest change")}: ${ti.map(({ o, d: dd }) => `${o.dims[1] || o.dims[0]} ${F.moneyDelta(dd)} (${F.pct(pct(o.cur.itemRevenue, o.prev.itemRevenue))})`).join("; ")}` });
        const dn = { mobile: L("mobilni", "mobile"), desktop: L("računar", "desktop"), tablet: "tablet" };
        const devs = Object.values(dev).filter((o) => o.prev.itemRevenue > 0 || o.cur.itemRevenue > 0).sort((a, b) => b.prev.itemRevenue - a.prev.itemRevenue);
        if (devs.length >= 2) {
          const big = devs.reduce((a, o) => (Math.abs(o.cur.itemRevenue - o.prev.itemRevenue) > Math.abs(a.cur.itemRevenue - a.prev.itemRevenue) ? o : a));
          addDeep({ check: "drill_category", impact: big.cur.itemRevenue - big.prev.itemRevenue, label: `${L("kategorija", "category")} ${d.name} ${L("po uređajima", "by device")}`,
            text: `${L("Kategorija", "Category")} ${d.name} ${L("po uređajima", "by device")}: ${devs.map((o) => `${dn[o.dims[0]] || o.dims[0]} ${F.pct(pct(o.cur.itemRevenue, o.prev.itemRevenue))}`).join(" · ")}` });
        }
        return { summary: ti[0] ? `${short(ti[0].o.dims[1] || ti[0].o.dims[0], 30)} ${F.moneyDelta(ti[0].d)}` : L("Nema podataka", "No data"), count: Object.keys(items).length };
      },
      // Landing stranica: po uređaju i po kanalu
      landing: async (d) => {
        const [dev, ch] = await Promise.all([
          two(["deviceCategory"], BASE, { dimensionFilter: ex("landingPage", d.arg) }),
          two(["sessionDefaultChannelGroup"], BASE, { dimensionFilter: ex("landingPage", d.arg) })
        ]);
        const dn = { mobile: L("mobilni", "mobile"), desktop: L("računar", "desktop"), tablet: "tablet" };
        const td = topChanges(dev, 1), tc = topChanges(ch, 1);
        if (td[0]) addDeep({ check: "drill_landing", impact: td[0].d, label: `${short(d.name)} – ${dn[td[0].o.dims[0]] || td[0].o.dims[0]}`, text: `${d.name} – ${dn[td[0].o.dims[0]] || td[0].o.dims[0]}: ${segTxt(td[0].o.cur, td[0].o.prev)}` });
        if (tc[0]) addDeep({ check: "drill_landing", impact: tc[0].d, label: `${short(d.name)} – ${tc[0].o.dims[0]}`, text: `${d.name} – ${tc[0].o.dims[0]}: ${segTxt(tc[0].o.cur, tc[0].o.prev)}` });
        return { summary: [td[0] && `${dn[td[0].o.dims[0]] || td[0].o.dims[0]} ${F.pct(pct(td[0].o.cur.totalRevenue, td[0].o.prev.totalRevenue))}`, tc[0] && `${tc[0].o.dims[0]} ${F.pct(pct(tc[0].o.cur.totalRevenue, tc[0].o.prev.totalRevenue))}`].filter(Boolean).join(" · ") || L("Nema podataka", "No data") };
      },
      // Kampanja: ad grupe – potrošnja, klikovi i prikazi uživo iz Google Ads-a + prihod iz GA4
      campaign: async (d) => {
        const gCur = gadsConn.currency_code || "EUR";
        const toRev = (v) => { const x = convert(v, gCur, currency, rates); return x == null ? v : x; };
        const [ga, ads] = await Promise.all([
          two(["sessionGoogleAdsAdGroupId", "sessionGoogleAdsAdGroupName"], BASE, { dimensionFilter: ex("sessionGoogleAdsCampaignId", d.arg) }, 5000),
          (async () => {
            const tok = await refreshAccessToken(gadsConn.refresh_token);
            const headers = { "Content-Type": "application/json", Authorization: `Bearer ${tok}` };
            // Isti način poziva kao google-ads-drilldown.js (koji radi)
            if (gadsConn.manager_id) headers["login-customer-id"] = String(gadsConn.manager_id);
            const query = `SELECT ad_group.id, ad_group.name, segments.date, metrics.cost_micros, metrics.clicks, metrics.impressions FROM ad_group WHERE campaign.id = ${d.arg} AND segments.date BETWEEN '${prevS}' AND '${curE}'`;
            let all = [], pageToken;
            do {
              const r = await fetch(`https://googleads.googleapis.com/v25/customers/${gadsConn.customer_id}/googleAds:search`, { method: "POST", headers, body: JSON.stringify(pageToken ? { query, pageToken } : { query }), signal: AbortSignal.timeout(30000) });
              const j = await r.json().catch(() => ({}));
              if (!r.ok) throw new Error("Google Ads: " + JSON.stringify(j).slice(0, 200));
              all = all.concat(j.results || []); pageToken = j.nextPageToken;
            } while (pageToken);
            return all;
          })()
        ]);
        const g = {};
        const get = (id, name) => g[id] || (g[id] = { id, name: name || id, sc: 0, sp: 0, kc: 0, kp: 0, ic: 0, ip: 0, rc: 0, rp: 0 });
        for (const r of ads) {
          const a = get(String(r.adGroup.id), r.adGroup.name); const cur = r.segments.date >= curS;
          const cost = toRev((parseInt(r.metrics?.costMicros) || 0) / 1e6), cl = parseInt(r.metrics?.clicks) || 0, im = parseInt(r.metrics?.impressions) || 0;
          if (cur) { a.sc += cost; a.kc += cl; a.ic += im; } else { a.sp += cost; a.kp += cl; a.ip += im; }
        }
        for (const o of Object.values(ga)) { if (!o.dims[0] || o.dims[0] === "(not set)") continue; const a = get(o.dims[0], o.dims[1] !== "(not set)" ? o.dims[1] : null); a.rc += o.cur.totalRevenue; a.rp += o.prev.totalRevenue; }
        const list = Object.values(g);
        if (!list.length) return { summary: L("Kampanja nema ad grupe (npr. Performance Max) – dublje nije moguće", "Campaign has no ad groups (e.g. Performance Max)"), count: 0 };
        const tops = list.sort((a, b) => Math.max(Math.abs(b.rc - b.rp), Math.abs(b.sc - b.sp)) - Math.max(Math.abs(a.rc - a.rp), Math.abs(a.sc - a.sp))).slice(0, 3);
        for (const a of tops) {
          const cpc = a.kp > 0 && a.kc > 0 ? ` · CPC ${F.pct(pct(rate(a.sc, a.kc), rate(a.sp, a.kp)))} · CTR ${F.pct(pct(rate(a.kc, a.ic), rate(a.kp, a.ip)))}` : "";
          addDeep({ check: "drill_campaign", impact: Math.abs(a.rc - a.rp) >= Math.abs(a.sc - a.sp) ? a.rc - a.rp : -(a.sc - a.sp), label: `${L("ad grupa", "ad group")} ${a.name}`,
            text: `${d.name} – ${L("ad grupa", "ad group")} ${a.name}: ${L("potrošnja", "spend")} ${F.money(a.sp)} → ${F.money(a.sc)} · ${L("prihod", "revenue")} ${F.money(a.rp)} → ${F.money(a.rc)} · ROAS ${F.dec(rate(a.rp, a.sp))} → ${F.dec(rate(a.rc, a.sc))}${cpc}` });
        }
        return { summary: `${short(tops[0].name, 30)}: ROAS ${F.dec(rate(tops[0].rp, tops[0].sp))} → ${F.dec(rate(tops[0].rc, tops[0].sc))}`, count: list.length };
      },
      // Lokacija: zemlje, a ako je skoro sve iz jedne zemlje – gradovi u njoj
      geo: async () => {
        const c = await two(["country"], BASE, {}, 500);
        const rows = Object.values(c).sort((a, b) => b.cur.totalRevenue - a.cur.totalRevenue);
        const tot = rows.reduce((a, o) => a + o.cur.totalRevenue, 0);
        let map = c, what = L("zemlja", "country");
        if (rows[0] && tot > 0 && rows[0].cur.totalRevenue / tot > 0.9) {
          map = await two(["city"], BASE, { dimensionFilter: ex("country", rows[0].dims[0]), orderBys: [{ metric: { metricName: "totalRevenue" }, desc: true }] }, 3000);
          what = L("grad", "city");
        }
        const tops = topChanges(map, 2);
        for (const { o, d: dd } of tops) addDeep({ check: "drill_geo", impact: dd, label: `${what} ${o.dims[0]}`, text: `${L("Lokacija", "Location")} (${what}) ${o.dims[0]}: ${segTxt(o.cur, o.prev)}` });
        return { summary: tops.map(({ o }) => `${o.dims[0]} ${F.pct(pct(o.cur.totalRevenue, o.prev.totalRevenue))}`).join(" · ") || L("Nema podataka", "No data"), count: Object.keys(map).length };
      }
    };

    if (!closed && drills.length && Date.now() < DEADLINE - 10000) {
      const drillDeadline = Math.max(Date.now() + 20000, DEADLINE);
      const aiIdx = CHECKS.findIndex((c) => c.id === "ai");
      const jobs = drills.map((d, i) => {
        const chk = { id: `drill_${d.type}`, label: drillLabel(d) };
        CHECKS.splice(aiIdx + i, 0, chk);
        send({ type: "check_add", check: chk, before: "ai" });
        return Promise.race([
          DRILL[d.type](d),
          new Promise((_, rej) => { const tm = setTimeout(() => rej(new Error(L("Google nije odgovorio na vreme", "Google did not respond in time"))), Math.max(0, drillDeadline - Date.now())); if (tm.unref) tm.unref(); })
        ]).then((r) => markDone(chk.id, r.summary, r.count)).catch((e) => { warnings.push({ check: chk.id, error: String(e && e.message || e).slice(0, 200) }); send({ type: "check", id: chk.id, status: "failed", summary: L("Provera nije uspela", "Check failed") }); });
      });
      await Promise.all(jobs);
    }

    // ── Rangiranje nalaza po težini i oznake N1, N2… ──
    // "Obavezni" nalazi (merenje, sezona, uobičajeno kolebanje, dan promene) uvek ulaze; ostatak po težini, ukupno do 14.
    findings.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
    // Obavezni nalazi + najbolji nalazi drugog kruga (do 4) uvek ulaze; ostatak po težini, ukupno do 16
    const forced = findings.filter((f) => f.force).slice(0, 6);
    const deepKeep = findings.filter((f) => !f.force && f.deep).slice(0, 4);
    const rest = findings.filter((f) => !f.force && !deepKeep.includes(f)).slice(0, Math.max(0, 16 - forced.length - deepKeep.length));
    const top = [...forced, ...deepKeep, ...rest].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
    top.forEach((f, i) => { f.id = "N" + (i + 1); if (dR && f.share == null && !f.force) f.share = f.impact / dR; });
    for (const f of findings) if (f.facts) Object.assign(facts, f.facts);

    if (T) {
      Object.assign(facts, {
        revenue_pct: F.pct(T.pct.revenue), orders_pct: F.pct(T.pct.orders), sessions_pct: F.pct(T.pct.sessions), cr_pct: F.pct(T.pct.cr), aov_pct: F.pct(T.pct.aov),
        revenue_cur: F.money(T.cur.revenue), revenue_prev: F.money(T.prev.revenue), revenue_delta: F.moneyDelta(dR)
      });
    }
    if (gadsTotals) Object.assign(facts, { gads_spend_pct: F.pct(pct(gadsTotals.spendCur, gadsTotals.spendPrev)), gads_roas_cur: F.dec(gadsTotals.roasCur), gads_roas_prev: F.dec(gadsTotals.roasPrev) });
    for (const f of top) {
      facts[f.id] = f.label;
      if (f.share != null && Math.abs(f.share) <= 1.5) facts[f.id + "_share"] = "≈" + Math.round(Math.abs(f.share) * 100) + "%";
      if (f.facts) for (const [k, v] of Object.entries(f.facts)) facts[k] = v;
    }
    facts.period_cur = `${F.date(curS)}–${F.date(curE)}`;
    facts.period_prev = `${F.date(prevS)}–${F.date(prevE)}`;

    // ── AI: jedan poziv, povezuje nalaze ──
    let ai = null, unavailable = null;
    const failedCount = warnings.filter((w) => w.check !== "sources").length;
    if (!T) {
      // Bez ukupnih brojeva nema istrage – AI bi samo nagađao (npr. "problem u merenju"), a uzrok je Google
      unavailable = L("Google Analytics trenutno ne odgovara za ovaj nalog (provere nisu dobile podatke na vreme). To je privremeni problem na Google-ovoj strani, ne u vašem merenju. Pokušajte ponovo za nekoliko minuta.",
                      "Google Analytics is not responding for this property right now (checks did not get data in time). This is a temporary problem on Google's side, not in your tracking. Please try again in a few minutes.");
      markSkip("ai", L("Preskočeno – nema podataka", "Skipped – no data"));
    } else if (closed) { markSkip("ai", L("Otkazano", "Cancelled")); }
    else if (!ANTHROPIC_API_KEY) { markFail("ai", "ANTHROPIC_API_KEY"); }
    else {
      try {
        ai = await explain({ lang, question, qtype, period: { curS, curE, prevS, prevE }, totals: T, decomp, gadsTotals, findings: top, facts, warnings, F, focus: focusCampaignId ? facts.focus_campaign || focusCampaignId : null });
        markDone("ai", L("Objašnjenje napisano", "Explanation written"));
      } catch (e) { markFail("ai", e); }
    }

    const checksDone = CHECKS.filter((c) => doneInfo[c.id]).map((c) => ({ id: c.id, label: c.label, count: doneInfo[c.id].count }));
    const perf = meterDone(meter, { findings: top.length, ai: !!ai, warnings: warnings.length });
    send({
      type: "result",
      question, qtype,
      period: { curS, curE, prevS, prevE, len },
      currency, eurFactor, lang,
      totals: T, decomp, gads: gadsTotals,
      findings: top.map(({ id, check, impact, share, text }) => ({ id, check, impact, share, text })),
      ai, unavailable, checksDone, warnings, failedCount,
      durationMs: Date.now() - t0,
      _perf: perf
    });
  } catch (e) {
    console.error("[investigate] FAILED", e.message);
    send({ type: "error", error: e.message });
  }
  res.end();
}

// ───────────────────────── AI deo ─────────────────────────
// Odgovor se traži kroz "alat" sa tačnom šemom – Anthropic tada vraća već ispravan JSON objekat
const REPORT_TOOL = {
  name: "report",
  description: "Objašnjenje istrage za marketing tim / Investigation explanation for a marketing team",
  input_schema: {
    type: "object",
    properties: {
      what: { type: "string" },
      why: { type: "string" },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      evidence: { type: "array", items: { type: "string" } },
      cannot_confirm: { type: "array", items: { type: "string" } },
      next_steps: { type: "array", items: { type: "string" } }
    },
    required: ["what", "why", "confidence", "evidence", "cannot_confirm", "next_steps"]
  }
};
async function explain({ lang, question, qtype, period, totals, decomp, gadsTotals, findings, facts, warnings, F, focus }) {
  const sr = lang === "sr";
  const qtxt = question || { revenue_drop: sr ? "Zašto je prihod pao?" : "Why did revenue drop?", roas_drop: sr ? "Zašto je ROAS pao?" : "Why did ROAS drop?", spend_up: sr ? "Potrošnja raste, a prihod ne – zašto?" : "Spend is up but revenue isn't – why?", other: sr ? "Šta se promenilo i zašto?" : "What changed and why?" }[qtype];

  const factList = Object.entries(facts).map(([k, v]) => `{{${k}}} = ${v}`).join("\n");
  // Udeo se navodi samo kad ima smisla (ne kad se promene međusobno poništavaju pa udeo prelazi 150%)
  const findingList = findings.map((f) => `${f.id} [${f.check}${f.deep ? (sr ? ", drugi krug" : ", second round") : ""}] ${f.text}${facts[f.id + "_share"] ? ` (${sr ? "udeo u ukupnoj promeni" : "share of total change"}: {{${f.id}_share}})` : ""}`).join("\n");
  // Zašto provera nije uspela – da AI ne bi neuspeh tehničkog upita tumačio kao problem u merenju sajta
  const failed = warnings.map((w) => `${w.check} (${/odgovor|respond|30 s|502|504|timeout/i.test(w.error) ? (sr ? "Google nije odgovorio na vreme – tehnički problem kod Google-a, NE problem merenja na sajtu" : "Google did not respond in time – a technical issue at Google, NOT a site tracking issue") : (sr ? "tehnička greška upita" : "technical query error")})`).join("; ");

  const system = sr
    ? `Ti si iskusan analitičar e-commerce performansi. Dobijaš NALAZE koje je server izračunao iz GA4 i Google Ads podataka. Tvoj posao je da ih povežeš u jasno objašnjenje za marketing tim.
PRAVILA:
- NE PIŠI NIJEDAN BROJ, procenat, iznos ni datum svojim rečima. Svaki broj ubaci ISKLJUČIVO preko oznake iz liste ČINJENICE, tačno u obliku {{kljuc}} (npr. {{revenue_pct}}, {{N4}}). Server će oznaku zameniti pravom vrednošću.
- Ovo važi za SVE brojeve: i broj proizvoda, dana, nedelja, procenat udela. Ako za nešto nema oznake, opiši bez broja ("više proizvoda", "nekoliko dana").
- Oznaka {{Nx}} se zamenjuje kratkim opisom nalaza (npr. "mobilni: prihod −34%"), pa je koristi u rečenici prirodno. Ne ponavljaj isti broj dvaput u istoj rečenici.
- {{period_cur}} je tekući period, {{period_prev}} prethodni. {{change_start}} je samo DAN OD KOG počinje promena, nije period.
- Korelacija NIJE dokaz uzroka. Koristi "verovatno", "ukazuje na". Ako nalazi ne objašnjavaju promenu dobro, to jasno reci i daj nisku sigurnost.
- Ako je tekući period u granicama uobičajenog ili je sezonski obrazac, to je važan zaključak.
- Nalazi označeni "drugi krug" su dublji pogled na najveće nalaze (npr. pregledač na mobilnom, proizvodi u kategoriji, ad grupe kampanje). Koristi ih da precizno kažeš GDE je problem; ako dva nalaza opisuju isti problem (npr. kategorija i uređaj), reci da je to jedan uzrok.
- Ako postoji moguć problem u merenju, stavi ga na prvo mesto u proveri.
- Meta i ostala potrošnja van Google Ads-a NIJE dostupna; izmene na sajtu, cene kod konkurencije, zalihe i promocije NISU u podacima.
- Piši kratko, srpski latinicom, bez žargona gde nije potreban.
Odgovor upiši ISKLJUČIVO pozivom alata "report". Za navodnike u tekstu koristi „ i “.
what = 1-2 rečenice: šta se desilo; why = 2-4 rečenice: zašto se verovatno dešava, glavni pa drugi uzrok; evidence = 2-5 najvažnijih oznaka nalaza; cannot_confirm i next_steps = po 2-4 kratke stavke.`
    : `You are an experienced e-commerce performance analyst. You receive FINDINGS computed by the server from GA4 and Google Ads data. Connect them into a clear explanation for a marketing team.
RULES:
- DO NOT WRITE ANY number, percentage, amount or date yourself. Insert every number ONLY via a placeholder from the FACTS list, exactly as {{key}} (e.g. {{revenue_pct}}, {{N4}}). The server replaces placeholders with real values.
- This applies to ALL numbers: product counts, days, weeks, share percentages. If there is no placeholder, describe without a number ("several products", "a few days").
- {{Nx}} is replaced by a short finding label (e.g. "mobile: revenue −34%"); use it naturally in a sentence. Do not repeat the same number twice in a sentence.
- {{period_cur}} is the current period, {{period_prev}} the previous one. {{change_start}} is only the DAY the change starts, not a period.
- Correlation is NOT proof of cause. Use "likely", "suggests". If findings explain the change poorly, say so and give low confidence.
- If the current period is within normal range or matches a seasonal pattern, that is an important conclusion.
- Findings marked "second round" are a deeper look at the biggest findings (e.g. browser on mobile, products in a category, campaign ad groups). Use them to say precisely WHERE the problem is; if two findings describe the same problem (e.g. category and device), say it is one cause.
- If a possible tracking issue exists, put it first in next steps.
- Meta and other non-Google-Ads spend is NOT available; site changes, competitor prices, stock and promotions are NOT in the data.
- Be concise, plain English.
Reply ONLY by calling the "report" tool.
what = 1-2 sentences: what happened; why = 2-4 sentences: why it likely happens, main then secondary cause; evidence = 2-5 most important finding ids; cannot_confirm and next_steps = 2-4 short items each.`;

  const user = `${sr ? "PITANJE" : "QUESTION"}: ${qtxt}
${sr ? "PERIOD" : "PERIOD"}: ${period.curS}..${period.curE} vs ${period.prevS}..${period.prevE}
${sr ? "ČINJENICE (koristi samo preko oznaka)" : "FACTS (use only via placeholders)"}:
${factList}

${sr ? "NALAZI (poređani po težini, najveći uticaj prvi)" : "FINDINGS (ranked by weight, biggest impact first)"}:
${findingList || (sr ? "(nema značajnih nalaza)" : "(no significant findings)")}
${failed ? `\n${sr ? "PROVERE KOJE NISU USPELE" : "FAILED CHECKS"}: ${failed}` : ""}
${focus ? `\n${sr ? "FOKUS: pitanje je o kampanji" : "FOCUS: the question is about campaign"} {{focus_campaign}}. ${sr ? "Prvo objasni šta se desilo sa njom (oznake {{focus_roas}}, {{focus_revenue_pct}}, {{focus_spend_pct}} i nalaz o njenim proizvodima), pa tek onda kako se to uklapa u promene celog sajta." : "First explain what happened to it (placeholders {{focus_roas}}, {{focus_revenue_pct}}, {{focus_spend_pct}} and the finding about its products), then how it fits the site-wide changes."}` : ""}`;

  // Do 2 pokušaja: AI ponekad bude zauzet (429/529) ili vrati nepotpun JSON (predug odgovor) – tada se pokušava još jednom
  let out = null, d = null, lastErr = null;
  for (let attempt = 0; attempt < 2 && !out; attempt++) {
    try {
      const msgs = [{ role: "user", content: user }];
      if (attempt > 0 && lastErr && /max_tokens|alat|tool/.test(lastErr.message)) msgs[0].content += sr ? "\n\nVAŽNO: piši kraće i odgovori isključivo pozivom alata report." : "\n\nIMPORTANT: be shorter and reply only by calling the report tool.";
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: MODEL, max_tokens: 2500, system, messages: msgs, tools: [REPORT_TOOL], tool_choice: { type: "tool", name: "report" } }),
        signal: AbortSignal.timeout(60000)
      });
      d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`AI HTTP ${r.status}: ` + JSON.stringify(d).slice(0, 200));
      if (d.stop_reason === "max_tokens") throw new Error("AI: odgovor predugačak (max_tokens) – nepotpun JSON");
      const tu = (d.content || []).find((c) => c.type === "tool_use" && c.name === "report");
      if (!tu || !tu.input || typeof tu.input.what !== "string") throw new Error("AI: nije vratio alat report");
      out = tu.input;
    } catch (e) {
      lastErr = e;
      console.error(`[investigate] AI pokušaj ${attempt + 1}: ${e.message}`);
      if (attempt === 0) await new Promise((res) => setTimeout(res, 2000));
    }
  }
  if (!out) throw lastErr || new Error("AI: nepoznata greška");

  // Zamena oznaka pravim vrednostima; nepoznate oznake se uklanjaju
  const fill = (s) => String(s || "").replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, k) => (facts[k] != null ? `**${facts[k]}**` : ""));
  const strayDigits = (s) => /\d/.test(String(s || "").replace(/\{\{[^}]*\}\}/g, ""));
  const all = [out.what, out.why, ...(out.cannot_confirm || []), ...(out.next_steps || [])];
  if (all.some(strayDigits)) console.warn("[investigate] AI je napisao broj mimo oznaka");
  const ids = new Set(findings.map((f) => f.id));
  return {
    what: fill(out.what),
    why: fill(out.why),
    confidence: ["high", "medium", "low"].includes(out.confidence) ? out.confidence : "medium",
    evidence: (out.evidence || []).filter((x) => ids.has(x)).slice(0, 5),
    cannot_confirm: (out.cannot_confirm || []).map(fill).slice(0, 4),
    next_steps: (out.next_steps || []).map(fill).slice(0, 4),
    usage: d.usage || null
  };
}
