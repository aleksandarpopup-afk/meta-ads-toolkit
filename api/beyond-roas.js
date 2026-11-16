// api/beyond-roas.js — Beyond ROAS (korak 1): podešavanje po klijentu i učitavanje nabavnih cena / zarade.
// Fajl se čita i prepoznaje u PREGLEDAČU (CSV, Excel, XML feed); ovde stižu samo već očišćeni redovi
// u delovima (najviše 5.000 redova po pozivu), pa nema problema sa Vercel-ovim limitom od 4,5 MB.
// Novi fajl se upisuje kao nova "serija" (batch); tek kad stignu SVI delovi ("commit") postaje važeći.
// Podrazumevano novi fajl DOPUNJUJE stare podatke: proizvodi kojih nema u novom fajlu zadržavaju poslednju
// poznatu vrednost (feed obično sadrži samo trenutnu ponudu). "replace" briše sve stare podatke.
// Ako učitavanje pukne na pola, stari podaci ostaju netaknuti.
// Korak 2: GET ?action=report – profit po proizvodu (GA4 prodaja × nabavna cena / zarada).
// Korak 3: GET ?action=campaigns – profit po Google Ads kampanji i proizvod × kampanja, sa troškom oglasa
//          (potrošnja kampanje iz Google Ads-a; trošak po proizvodu iz shopping_performance_view za Shopping/PMax).
import { guard, clientInWorkspace, dbHeaders, SUPABASE_URL, UUID_RE } from "./_lib/auth.js";
import { createLimiter, ga4FetchAll, newMeter, meterStep, meterDone } from "./_lib/ga4.js";
import { cacheKey, cacheGet, cacheSet } from "./_lib/cache.js";

const CALC_VERSION = "br-3"; // br-2: cena u GA4 ispod 20% cene iz fajla = sumnjivo; br-3: PDV stopa po proizvodu
const CACHE_TTL_SEC = 30 * 60;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

async function refreshAccessToken(refresh_token) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, grant_type: "refresh_token" })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data));
  return data.access_token;
}

const GADS_VERSION = "v25";
// Google Ads pretraga (isti način kao google-ads-drilldown.js; developer token više nije potreban)
async function gadsSearch(customerId, accessToken, query, loginCustomerId) {
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;
  let all = [];
  let pageToken;
  do {
    const body = { query };
    if (pageToken) body.pageToken = pageToken;
    const r = await fetch(`https://googleads.googleapis.com/${GADS_VERSION}/customers/${customerId}/googleAds:search`, {
      method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(45000)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error("Google Ads: " + JSON.stringify(data).slice(0, 300));
    all = all.concat(data.results || []);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return all;
}

// Kursevi: tabela exchange_rates (jedan red, osnova EUR: rates[X] = koliko X vredi 1 EUR)
function convert(amount, from, to, rates) {
  if (from === to) return amount;
  if (!rates) return null;
  const rf = from === "EUR" ? 1 : rates[from];
  const rt = to === "EUR" ? 1 : rates[to];
  if (!rf || !rt) return null;
  return (amount / rf) * rt;
}
// GA4 ponekad šalje nazive sa HTML oznakama (&amp; i sl.)
const unesc = (t) => String(t || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d));
const r2 = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 100) / 100);

const MAX_CHUNK = 5000;
const CUR_RE = /^[A-Z]{3}$/;

const db = (path, init = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...dbHeaders, ...(init.headers || {}) } });

async function dbJson(path, init) {
  const r = await db(path, init);
  const txt = await r.text();
  let d = null;
  try { d = txt ? JSON.parse(txt) : null; } catch { d = txt; }
  if (!r.ok) {
    const msg = typeof d === "object" && d ? (d.message || JSON.stringify(d)) : String(d);
    // Tabela ne postoji = SQL (br.sql) još nije pokrenut
    if (/br_settings|br_costs|br_commit|committed/.test(msg) && /does not exist|Could not find/i.test(msg)) throw new Error("setup_missing");
    throw new Error(`Baza ${r.status}: ${String(msg).slice(0, 200)}`);
  }
  return d;
}

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
const str = (v, max) => (v === null || v === undefined ? null : String(v).slice(0, max));

// Samo dozvoljena polja podešavanja, sa proverom vrednosti
function cleanSettings(s) {
  const out = {};
  if (!s || typeof s !== "object") return out;
  if (typeof s.prices_include_vat === "boolean") out.prices_include_vat = s.prices_include_vat;
  if (s.vat_rate !== undefined) { const v = Number(s.vat_rate); if (isFinite(v) && v >= 0 && v <= 50) out.vat_rate = v; }
  if (s.value_type === "cost" || s.value_type === "margin") out.value_type = s.value_type;
  if (typeof s.value_includes_vat === "boolean") out.value_includes_vat = s.value_includes_vat;
  if (s.value_currency === null || (typeof s.value_currency === "string" && CUR_RE.test(s.value_currency))) out.value_currency = s.value_currency;
  if (s.category_margins && typeof s.category_margins === "object" && !Array.isArray(s.category_margins)) {
    const cm = {};
    for (const [k, v] of Object.entries(s.category_margins).slice(0, 500)) { const n = Number(v); if (isFinite(n) && n >= 0 && n <= 100) cm[String(k).slice(0, 200)] = n; }
    out.category_margins = cm;
  }
  return out;
}

async function getSettings(clientId) {
  const rows = await dbJson(`br_settings?client_id=eq.${clientId}&select=*`);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function saveSettings(clientId, fields) {
  await dbJson(`br_settings?on_conflict=client_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ client_id: clientId, ...fields, updated_at: new Date().toISOString() })
  });
}

async function countBatch(clientId, batch) {
  const r = await db(`br_costs?client_id=eq.${clientId}&batch=eq.${batch}&select=sku&limit=1`, { headers: { Prefer: "count=exact" } });
  if (!r.ok) throw new Error(`Baza ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const cr = r.headers.get("content-range") || "";
  const n = parseInt(cr.split("/")[1], 10);
  return isFinite(n) ? n : 0;
}

// Sve važeće vrednosti klijenta (Supabase vraća najviše 1.000 redova po pozivu → delovi istovremeno, po 4)
async function loadCosts(clientId) {
  const PAGE = 1000;
  const base = `br_costs?client_id=eq.${clientId}&committed=eq.true&select=sku,value,price,currency,title,vat_rate&order=sku`;
  const r = await db(`${base}&limit=${PAGE}&offset=0`, { headers: { Prefer: "count=exact" } });
  const txt = await r.text();
  if (!r.ok) {
    if (/committed|vat_rate/.test(txt) && /does not exist|column/i.test(txt)) throw new Error("setup_missing");
    throw new Error(`Baza ${r.status}: ${txt.slice(0, 200)}`);
  }
  const first = JSON.parse(txt || "[]");
  const total = parseInt((r.headers.get("content-range") || "").split("/")[1], 10) || first.length;
  const offsets = [];
  for (let o = PAGE; o < total; o += PAGE) offsets.push(o);
  const limit = createLimiter(4);
  const pages = await Promise.all(offsets.map((o) => limit(() => dbJson(`${base}&limit=${PAGE}&offset=${o}`))));
  return first.concat(...pages);
}

// Pravila računice (zajednička za proizvode i kampanje): vraća f(sku, komada, prihod) → {st, rn, cogs, gp}
function makeCalc(s, currency, rates, costs) {
  const costMap = new Map();
  for (const c of costs) costMap.set(String(c.sku).trim().toLowerCase(), c);
  const vat = Number(s.vat_rate) || 0;
  const pvOf = (rate) => (s.prices_include_vat === false ? 1 : 1 + rate / 100);
  const vvOf = (rate) => (s.value_includes_vat ? 1 + rate / 100 : 1);
  const isMargin = s.value_type === "margin";
  const fxCache = {};
  const fxTo = (cur) => { const c = cur || s.value_currency || currency; if (!(c in fxCache)) fxCache[c] = convert(1, c, currency, rates); return fxCache[c]; };
  const calc = (id, q, r) => {
    const c = costMap.get(String(id).trim().toLowerCase());
    const rate = c && c.vat_rate != null ? Number(c.vat_rate) : vat;
    const pv = pvOf(rate), vv = vvOf(rate);
    const rn = r / pv;
    if (!c) return { st: "missing", rn, cogs: null, gp: null };
    const f = fxTo(c.currency);
    if (f == null) return { st: "missing", rn, cogs: null, gp: null, noFx: true };
    const v = (Number(c.value) * f) / vv;
    const p = c.price != null ? (Number(c.price) * f) / pv : null;
    const bad = !(q > 0) || (isMargin ? (p != null && v > p) : (v <= 0 || (p != null && v > p))) || (p != null && p > 0 && rn / q < p * 0.2);
    if (bad) return { st: "susp", rn, cogs: null, gp: null };
    if (isMargin && p == null) { const gp = q * v; return { st: "ok", rn, cogs: rn - gp, gp }; }
    const unitCost = isMargin ? p - v : v;
    const cogs = q * unitCost;
    return { st: "ok", rn, cogs, gp: rn - cogs };
  };
  calc.title = (id) => { const c = costMap.get(String(id).trim().toLowerCase()); return c ? c.title : null; };
  return { calc, vat };
}

// Tačni datumi perioda (za Google Ads su potrebni pravi datumi, ne "30daysAgo")
function periodDates(q) {
  const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
  if (q.from || q.to) {
    if (!(DATE_OK.test(q.from || "") && DATE_OK.test(q.to || "") && q.from <= q.to)) return null;
    return { startDate: q.from, endDate: q.to, days: null };
  }
  const days = Math.min(Math.max(parseInt(q.days) || 30, 1), 730);
  const end = new Date(); end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(); start.setUTCDate(start.getUTCDate() - days);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), days };
}

async function campaigns(req, res, clientId, s) {
  const per = periodDates(req.query);
  if (!per) return res.status(400).json({ error: "Invalid period" });
  if (!s || !s.row_count) return res.status(200).json({ empty: true });
  const [g4, ga] = await Promise.all([
    dbJson(`ga4_connections?client_id=eq.${clientId}&select=property_id,refresh_token,currency_code`),
    dbJson(`google_ads_connections?client_id=eq.${clientId}&select=customer_id,manager_id,currency_code,refresh_token`)
  ]);
  if (!Array.isArray(g4) || !g4.length) return res.status(200).json({ error: "no_ga4" });
  if (!Array.isArray(ga) || !ga.length) return res.status(200).json({ error: "no_gads" });
  const { property_id, refresh_token: g4Token, currency_code: g4Cur } = g4[0];
  const { customer_id, manager_id, currency_code: adsCurRaw, refresh_token: adsToken } = ga[0];
  const currency = g4Cur || "EUR";
  const adsCur = adsCurRaw || "EUR";
  const range = { startDate: per.startDate, endDate: per.endDate };
  const meter = newMeter(`beyond-roas-campaigns client=${clientId} ${range.startDate}..${range.endDate}`);
  const key = cacheKey({ kind: "br-camp", v: CALC_VERSION, client: clientId, property: String(property_id), customer: String(customer_id), currency, range, up: s.uploaded_at, set: s.updated_at });
  if (req.query.refresh !== "1") {
    const hit = await cacheGet(key);
    if (hit) { hit.data._perf = meterDone(meter, { cache: "hit" }); return res.status(200).json(hit.data); }
  }
  const t = Date.now();
  const limit = createLimiter(4);
  const [g4At, adsAt] = await Promise.all([refreshAccessToken(g4Token), refreshAccessToken(adsToken)]);
  const login = manager_id || undefined;
  const dq = `segments.date BETWEEN '${range.startDate}' AND '${range.endDate}'`;
  const [ga4rep, campRows, shopRows, costs, fx] = await Promise.all([
    ga4FetchAll(property_id, g4At, {
      dateRanges: [range],
      dimensions: [{ name: "sessionGoogleAdsCampaignId" }, { name: "itemId" }, { name: "itemName" }],
      metrics: [{ name: "itemsPurchased" }, { name: "itemRevenue" }],
      orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }]
    }, { maxRows: 300000, meter, limit }),
    gadsSearch(customer_id, adsAt, `SELECT campaign.id, campaign.name, campaign.advertising_channel_type, campaign.status, metrics.cost_micros, metrics.clicks FROM campaign WHERE ${dq} AND metrics.cost_micros > 0`, login),
    // Trošak po proizvodu postoji samo za Shopping i Performance Max (ako ga nema, nastavlja se bez njega)
    gadsSearch(customer_id, adsAt, `SELECT campaign.id, segments.product_item_id, metrics.cost_micros, metrics.clicks FROM shopping_performance_view WHERE ${dq} AND metrics.cost_micros > 0`, login)
      .catch((e) => { console.warn("[beyond-roas] shopping_performance_view:", e.message.slice(0, 200)); return null; }),
    loadCosts(clientId),
    dbJson("exchange_rates?id=eq.1&select=rates").catch(() => null)
  ]);
  meterStep(meter, `ga4+ads(${(ga4rep.rows || []).length} ga4, ${campRows.length} camp, ${shopRows ? shopRows.length : "-"} shop, ${costs.length} costs)`, t);
  const rates = fx && fx[0] ? fx[0].rates : null;
  const eurFactor = currency === "EUR" ? 1 : convert(1, currency, "EUR", rates);
  const adsFx = convert(1, adsCur, currency, rates);
  if (adsFx == null) return res.status(200).json({ error: "no_fx" });
  const { calc } = makeCalc(s, currency, rates, costs);

  // Kampanje sa potrošnjom
  const C = new Map();
  const camp = (id) => {
    let c = C.get(id);
    if (!c) { c = { id, name: null, type: null, status: null, spend: 0, clicks: 0, r: 0, rn: 0, rOk: 0, gp: 0, nOk: 0, nItems: 0, items: new Map(), hasShop: false }; C.set(id, c); }
    return c;
  };
  for (const row of campRows) {
    const c = camp(String(row.campaign.id));
    c.name = row.campaign.name; c.type = row.campaign.advertisingChannelType; c.status = row.campaign.status;
    c.spend += ((parseInt(row.metrics.costMicros) || 0) / 1e6) * adsFx;
    c.clicks += parseInt(row.metrics.clicks) || 0;
  }
  // GA4 prodaja po kampanji × proizvodu
  for (const row of ga4rep.rows || []) {
    const cid = row.dimensionValues[0].value;
    if (!/^\d+$/.test(cid) || cid === "0") continue;
    const id = String(row.dimensionValues[1].value || "").trim();
    if (!id || id === "(not set)") continue;
    const q = parseFloat(row.metricValues[0].value) || 0;
    const r = parseFloat(row.metricValues[1].value) || 0;
    if (!(q > 0 || r !== 0)) continue;
    const c = camp(cid);
    let it = c.items.get(id.toLowerCase());
    if (!it) { it = { id, n: unesc(row.dimensionValues[2].value), q: 0, r: 0, ad: null }; c.items.set(id.toLowerCase(), it); }
    it.q += q; it.r += r;
  }
  // Trošak oglasa po proizvodu (Shopping / PMax)
  if (shopRows) for (const row of shopRows) {
    const c = camp(String(row.campaign.id));
    const pid = String(row.segments.productItemId || "").trim();
    if (!pid) continue;
    c.hasShop = true;
    let it = c.items.get(pid.toLowerCase());
    if (!it) { it = { id: pid, n: null, q: 0, r: 0, ad: 0 }; c.items.set(pid.toLowerCase(), it); }
    it.ad = (it.ad || 0) + ((parseInt(row.metrics.costMicros) || 0) / 1e6) * adsFx;
  }

  const out = [];
  const TT = { spend: 0, r: 0, rOk: 0, gp: 0, gpEst: 0, profit: 0, nUnknown: 0, spendUnknown: 0 };
  for (const c of C.values()) {
    const items = [];
    for (const it of c.items.values()) {
      const k = it.r !== 0 || it.q > 0 ? calc(it.id, it.q, it.r) : { st: "nosale", rn: 0, cogs: 0, gp: 0 };
      if (k.st !== "nosale") { c.nItems++; c.r += it.r; c.rn += k.rn; if (k.st === "ok") { c.nOk++; c.rOk += it.r; c.gp += k.gp; } }
      const ad = c.hasShop ? (it.ad || 0) : null;
      const gpVal = k.st === "nosale" ? 0 : k.gp;
      items.push({ id: it.id, n: it.n || calc.title(it.id) || null, q: r2(it.q), r: r2(it.r), rn: r2(k.rn), gp: r2(gpVal), st: k.st, ad: r2(ad), pa: ad != null && gpVal != null ? r2(gpVal - ad) : null });
    }
    if (!c.name && !c.spend && !c.r) continue;
    const cov = c.r > 0 ? c.rOk / c.r : null;
    // Procena za ceo prihod kampanje: profit poznatih proizvoda × (ceo prihod / prihod sa cenom). Samo kad je pokriveno ≥ 50%.
    const gpEst = c.rOk > 0 && cov >= 0.5 ? c.gp * (c.r / c.rOk) : (c.r === 0 ? 0 : null);
    const profit = gpEst != null ? gpEst - c.spend : null;
    TT.spend += c.spend; TT.r += c.r; TT.rOk += c.rOk; TT.gp += c.gp;
    if (gpEst != null) { TT.gpEst += gpEst; TT.profit += profit; } else { TT.nUnknown++; TT.spendUnknown += c.spend; }
    // Proizvodi: najveći prihod + najveći trošak bez prodaje (čist gubitak)
    const byRev = items.filter((i) => i.st !== "nosale").sort((a, b) => b.r - a.r).slice(0, 250);
    const noSale = items.filter((i) => i.st === "nosale" && i.ad > 0).sort((a, b) => b.ad - a.ad);
    const noSaleTop = noSale.slice(0, 50);
    out.push({
      id: c.id, name: c.name || `#${c.id}`, type: c.type, status: c.status, spend: r2(c.spend), clicks: c.clicks,
      r: r2(c.r), rn: r2(c.rn), rOk: r2(c.rOk), gp: r2(c.gp), cov: cov == null ? null : r2(cov * 100),
      gpEst: r2(gpEst), profit: r2(profit), roas: c.spend > 0 ? r2(c.r / c.spend) : null, beRoas: c.gp > 0 && c.rOk > 0 ? r2(c.rOk / c.gp) : null,
      hasShop: c.hasShop, nItems: c.nItems, nOk: c.nOk,
      noSaleCount: noSale.length, noSaleSpend: r2(noSale.reduce((a, i) => a + i.ad, 0)),
      items: byRev.concat(noSaleTop), itemsTruncated: items.length > byRev.length + noSaleTop.length
    });
  }
  out.sort((a, b) => (b.spend || 0) - (a.spend || 0) || (b.r || 0) - (a.r || 0));
  const payload = {
    currency, eurFactor: eurFactor ? Math.round(eurFactor * 1e8) / 1e8 : null, adsCurrency: adsCur, range, periodDays: per.days,
    shopping: !!shopRows,
    totals: { spend: r2(TT.spend), r: r2(TT.r), rOk: r2(TT.rOk), gp: r2(TT.gp), gpEst: r2(TT.gpEst), profit: r2(TT.profit), nUnknown: TT.nUnknown, spendUnknown: r2(TT.spendUnknown),
      roas: TT.spend > 0 ? r2(TT.r / TT.spend) : null, beRoas: TT.gp > 0 && TT.rOk > 0 ? r2(TT.rOk / TT.gp) : null, cov: TT.r > 0 ? r2((TT.rOk / TT.r) * 100) : null },
    campaigns: out
  };
  const json = JSON.stringify(payload);
  await cacheSet(key, { clientId, kind: "br-camp", json, ttlSec: CACHE_TTL_SEC });
  payload._perf = meterDone(meter, { cache: "miss", campaigns: out.length, bytes: json.length });
  return res.status(200).json(payload);
}

async function report(req, res, clientId, s) {
  const { days, from, to } = req.query;
  const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
  if ((from || to) && !(DATE_OK.test(from || "") && DATE_OK.test(to || "") && from <= to)) return res.status(400).json({ error: "Invalid period" });
  const periodDays = Math.min(Math.max(parseInt(days) || 30, 1), 730);
  const range = from && to ? { startDate: from, endDate: to } : { startDate: `${periodDays}daysAgo`, endDate: "yesterday" };
  if (!s || !s.row_count) return res.status(200).json({ empty: true });

  const conn = await dbJson(`ga4_connections?client_id=eq.${clientId}&select=property_id,refresh_token,currency_code`);
  if (!Array.isArray(conn) || !conn.length) return res.status(200).json({ error: "no_ga4" });
  const { property_id, refresh_token, currency_code } = conn[0];
  const currency = currency_code || "EUR";
  const todayUtc = new Date().toISOString().slice(0, 10);
  const meter = newMeter(`beyond-roas client=${clientId} period=${from && to ? from + ".." + to : periodDays + "d"}`);
  // Ključ sadrži i vreme poslednjeg učitavanja / izmene podešavanja → novi fajl ili PDV odmah daju nov rezultat
  const key = cacheKey({ kind: "br-report", v: CALC_VERSION, client: clientId, property: String(property_id), currency, range, today: from && to ? null : todayUtc, up: s.uploaded_at, set: s.updated_at });
  if (req.query.refresh !== "1") {
    const hit = await cacheGet(key);
    if (hit) { hit.data._perf = meterDone(meter, { cache: "hit" }); return res.status(200).json(hit.data); }
  }
  let t = Date.now();
  const limit = createLimiter(4);
  const accessToken = await refreshAccessToken(refresh_token);
  const [rep, costs, fx] = await Promise.all([
    ga4FetchAll(property_id, accessToken, {
      dateRanges: [range],
      dimensions: [{ name: "itemId" }, { name: "itemName" }, { name: "itemCategory" }],
      metrics: [{ name: "itemsPurchased" }, { name: "itemRevenue" }],
      orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }]
    }, { maxRows: 300000, meter, limit }),
    loadCosts(clientId),
    dbJson("exchange_rates?id=eq.1&select=rates").catch(() => null)
  ]);
  meterStep(meter, `ga4+costs(${(rep.rows || []).length} rows, ${costs.length} costs)`, t);
  const rates = fx && fx[0] ? fx[0].rates : null;
  const eurFactor = currency === "EUR" ? 1 : convert(1, currency, "EUR", rates);

  // GA4 redovi → po šifri (isti proizvod može da ima više naziva/kategorija)
  const byId = new Map();
  for (const row of rep.rows || []) {
    const id = String(row.dimensionValues[0].value || "").trim();
    if (!id || id === "(not set)") continue;
    const q = parseFloat(row.metricValues[0].value) || 0;
    const rev = parseFloat(row.metricValues[1].value) || 0;
    let it = byId.get(id);
    if (!it) { it = { id, n: unesc(row.dimensionValues[1].value), cat: unesc(row.dimensionValues[2].value), q: 0, r: 0 }; byId.set(id, it); }
    it.q += q; it.r += rev;
  }
  const costMap = new Map();
  for (const c of costs) costMap.set(String(c.sku).trim().toLowerCase(), c);

  const vat = Number(s.vat_rate) || 0;
  // PDV: stopa proizvoda iz fajla (ako postoji), inače stopa klijenta
  const pvOf = (rate) => (s.prices_include_vat === false ? 1 : 1 + rate / 100);   // cene na sajtu / u GA4
  const vvOf = (rate) => (s.value_includes_vat ? 1 + rate / 100 : 1);            // vrednost iz fajla
  const pv = pvOf(vat);
  const isMargin = s.value_type === "margin";
  const vatCount = {};
  const fxCache = {};
  const fxTo = (cur) => {
    const c = cur || s.value_currency || currency;
    if (!(c in fxCache)) fxCache[c] = convert(1, c, currency, rates);
    return fxCache[c];
  };

  const T = { r: 0, rn: 0, rOk: 0, rnOk: 0, cogs: 0, gp: 0, nItems: 0, nOk: 0, nMissing: 0, nSusp: 0, nNeg: 0, rMissing: 0, rSusp: 0, gpNeg: 0, noFx: 0 };
  const items = [];
  for (const it of byId.values()) {
    if (!(it.q > 0 || it.r !== 0)) continue;
    const c = costMap.get(it.id.toLowerCase());
    const rate = c && c.vat_rate != null ? Number(c.vat_rate) : vat;
    const pvI = pvOf(rate), vvI = vvOf(rate);
    const rn = it.r / pvI;
    T.nItems++; T.r += it.r; T.rn += rn;
    let st = "missing", cogs = null, gp = null;
    if (c) {
      if (c.vat_rate != null) vatCount[rate] = (vatCount[rate] || 0) + 1;
      const f = fxTo(c.currency);
      if (f == null) { T.noFx++; }
      else {
        const v = (Number(c.value) * f) / vvI;
        const p = c.price != null ? (Number(c.price) * f) / pvI : null;
        let unitCost = null;
        if (isMargin) { if (p != null) unitCost = p - v; }
        else unitCost = v;
        // Sumnjivo: vrednost nema smisla, ili je prodajna cena po komadu u GA4 manja od 20% cene iz fajla
        // (poklon uz drugi proizvod, kupon 100%, pogrešno poslata cena) – takav red bi napravio "maržu" od −300.000%
        const bad = !(it.q > 0) || (isMargin ? (p != null && v > p) : (v <= 0 || (p != null && v > p))) || (p != null && p > 0 && rn / it.q < p * 0.2);
        if (bad) st = "susp";
        else {
          st = "ok";
          if (unitCost != null) { cogs = it.q * unitCost; gp = rn - cogs; }
          else { gp = it.q * v; cogs = rn - gp; } // zarada bez cene u fajlu: zarada × komada
        }
      }
    }
    if (st === "ok") {
      T.nOk++; T.rOk += it.r; T.rnOk += rn; T.cogs += cogs; T.gp += gp;
      if (gp < 0) { T.nNeg++; T.gpNeg += gp; }
    } else if (st === "susp") { T.nSusp++; T.rSusp += it.r; }
    else { T.nMissing++; T.rMissing += it.r; }
    items.push({ id: it.id, n: it.n, cat: it.cat && it.cat !== "(not set)" ? it.cat : null, q: r2(it.q), r: r2(it.r), rn: r2(rn), cogs: r2(cogs), gp: r2(gp), st });
  }
  items.sort((a, b) => b.r - a.r);
  const totals = {
    ...Object.fromEntries(Object.entries(T).map(([k, v]) => [k, r2(v)])),
    marginPct: T.rnOk > 0 ? r2((T.gp / T.rnOk) * 100) : null,
    beRoas: T.gp > 0 ? r2(T.rOk / T.gp) : null,          // ROAS (prihod sa PDV-om kao u GA4 / potrošnja) pri kome je profit posle oglasa = 0
    coveragePct: T.r > 0 ? r2((T.rOk / T.r) * 100) : null
  };
  const payload = {
    currency, eurFactor: eurFactor ? Math.round(eurFactor * 1e8) / 1e8 : null,
    range, periodDays: from && to ? null : periodDays,
    basis: { valueType: s.value_type, pricesIncludeVat: s.prices_include_vat !== false, vatRate: vat, valueIncludesVat: !!s.value_includes_vat, valueCurrency: s.value_currency || currency,
      itemVat: Object.keys(vatCount).length ? vatCount : null },   // {stopa: broj prodatih proizvoda} kad fajl ima PDV po proizvodu
    totals, items: items.slice(0, 8000), truncated: items.length > 8000
  };
  const json = JSON.stringify(payload);
  await cacheSet(key, { clientId, kind: "br-report", json, ttlSec: CACHE_TTL_SEC });
  payload._perf = meterDone(meter, { cache: "miss", items: items.length, bytes: json.length });
  return res.status(200).json(payload);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  const ctx = await guard(req, res);
  if (!ctx) return;

  const body = req.method === "POST" ? (typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {})) : {};
  const clientIdRaw = req.method === "POST" ? body.client_id : req.query.client_id;
  const clientId = Number(clientIdRaw);
  if (!(await clientInWorkspace(clientId, ctx.membership.workspace_id))) return res.status(404).json({ error: "client_not_found" });

  try {
    // ── Stanje: podešavanje + šta je učitano ──
    if (req.method === "GET" && req.query.action === "report") {
      return await report(req, res, clientId, await getSettings(clientId));
    }
    if (req.method === "GET" && req.query.action === "campaigns") {
      return await campaigns(req, res, clientId, await getSettings(clientId));
    }
    if (req.method === "GET") {
      const s = await getSettings(clientId);
      let sample = [];
      if (s && s.active_batch && req.query.sample === "1") {
        sample = await dbJson(`br_costs?client_id=eq.${clientId}&batch=eq.${s.active_batch}&select=sku,value,price,title,category,currency&limit=20`);
      }
      return res.status(200).json({ settings: s, sample });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "method" });

    const action = body.action;

    if (action === "settings") {
      const fields = cleanSettings(body.settings);
      if (!Object.keys(fields).length) return res.status(400).json({ error: "no_fields" });
      await saveSettings(clientId, fields);
      return res.status(200).json({ ok: true, settings: await getSettings(clientId) });
    }

    if (action === "upload_chunk") {
      const batch = String(body.batch || "");
      if (!UUID_RE.test(batch)) return res.status(400).json({ error: "bad_batch" });
      const rows = Array.isArray(body.rows) ? body.rows : null;
      if (!rows || !rows.length || rows.length > MAX_CHUNK) return res.status(400).json({ error: "bad_rows" });
      const out = [];
      const seen = new Set();
      for (const r of rows) {
        const sku = str(r && r.s, 200);
        const value = num(r && r.v);
        if (!sku || !sku.trim() || value === null || !isFinite(value) || Math.abs(value) >= 1e10) continue;
        const k = sku.trim();
        if (seen.has(k)) continue;
        seen.add(k);
        const price = num(r.p);
        const cur = typeof r.cur === "string" && CUR_RE.test(r.cur) ? r.cur : null;
        const vr = num(r.vr);
        const row = { client_id: clientId, batch, sku: k, value, price: price !== null && isFinite(price) && Math.abs(price) < 1e10 ? price : null, title: str(r.t, 300), category: str(r.c, 200), currency: cur };
        if (vr !== null && isFinite(vr) && vr >= 0 && vr <= 50) row.vat_rate = vr; // samo kad fajl ima kolonu PDV (inače ostaje prazno = stopa klijenta)
        out.push(row);
      }
      if (out.length) {
        await dbJson(`br_costs?on_conflict=client_id,batch,sku`, {
          method: "POST",
          headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
          body: JSON.stringify(out)
        });
      }
      return res.status(200).json({ ok: true, saved: out.length });
    }

    if (action === "upload_commit") {
      const batch = String(body.batch || "");
      if (!UUID_RE.test(batch)) return res.status(400).json({ error: "bad_batch" });
      const expected = Number(body.row_count);
      const have = await countBatch(clientId, batch);
      // Svi delovi moraju biti tu – inače se novi fajl NE uključuje (stari ostaje važeći)
      if (!have || (isFinite(expected) && have !== expected)) {
        await db(`br_costs?client_id=eq.${clientId}&batch=eq.${batch}`, { method: "DELETE" }).catch(() => {});
        return res.status(409).json({ error: "incomplete", have, expected });
      }
      // Uključi novi fajl (u bazi, jednim potezom): dopuna ili potpuna zamena
      const total = await dbJson(`rpc/br_commit`, { method: "POST", body: JSON.stringify({ p_client: clientId, p_batch: batch, p_replace: body.replace === true }) });
      const fields = cleanSettings(body.settings);
      const cm = body.column_map && typeof body.column_map === "object" ? body.column_map : null;
      await saveSettings(clientId, {
        ...fields,
        column_map: cm && JSON.stringify(cm).length < 20000 ? cm : null,
        source_name: str(body.source_name, 200),
        row_count: Number(total) || have,
        active_batch: batch,
        uploaded_at: new Date().toISOString()
      });
      return res.status(200).json({ ok: true, row_count: have, total: Number(total) || have, settings: await getSettings(clientId) });
    }

    if (action === "upload_abort") {
      const batch = String(body.batch || "");
      if (!UUID_RE.test(batch)) return res.status(400).json({ error: "bad_batch" });
      const s = await getSettings(clientId);
      if (s && s.active_batch === batch) return res.status(400).json({ error: "active_batch" });
      await db(`br_costs?client_id=eq.${clientId}&batch=eq.${batch}&committed=eq.false`, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "unknown_action" });
  } catch (err) {
    console.error("[beyond-roas]", err.message);
    return res.status(err.message === "setup_missing" ? 503 : 500).json({ error: err.message });
  }
}
