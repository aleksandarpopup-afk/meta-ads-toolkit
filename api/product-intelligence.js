import { guard, clientInWorkspace } from "./_lib/auth.js";
import { createLimiter, ga4Fetch as ga4FetchLib, ga4FetchAll as ga4FetchAllLib, newMeter, meterStep, meterDone } from "./_lib/ga4.js";
import { cacheEnabled, cacheKey, cacheGet, cacheSet, singleFlight } from "./_lib/cache.js";

// Verzija računice: kad se promeni bilo šta u obradi ispod, poveća se, pa se stari keš više ne koristi
const CALC_VERSION = "pi-2"; // pi-2: granica 300.000 redova (ranije 100.000) – stari keš se ne koristi
const MAX_ROWS = 300000;      // najviše redova po izveštaju (katalog i izvori)
const CACHE_TTL_SEC = 30 * 60; // 30 minuta
// GA4_PARALLEL=0 u Vercelu vraća stari način (upit po upit). Podrazumevano: najviše 4 istovremena upita.
const MAX_PARALLEL = process.env.GA4_PARALLEL === "0" ? 1 : 4;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

async function refreshAccessToken(refresh_token) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token"
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data));
  return data.access_token;
}

// Platforma (meta/google/tiktok/direct/other) na osnovu izvora
function detectPlatform(source) {
  const s = (source || "").toLowerCase();
  if (s.includes("facebook") || s.includes("instagram") || s === "fb" || s === "ig" || s === "meta") return "meta";
  if (s.includes("google")) return "google";
  if (s.includes("tiktok")) return "tiktok";
  if (s === "(direct)") return "direct";
  return "other";
}

// Plaćeno ili organsko, na osnovu GA4-ovog sopstvenog channel group-a.
// Cross-network (Performance Max i slične kampanje) je TAKOĐE plaćeno, samo ne počinje rečju "Paid".
function isPaid(channelGroup) {
  const cg = (channelGroup || "").toLowerCase();
  return cg.startsWith("paid") || cg === "cross-network" || cg === "display" || cg === "audio";
}

function dateStr(d) {
  return d.toISOString().split("T")[0];
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  // Samo prijavljen korisnik, i samo za klijenta iz svog radnog prostora
  const ctx = await guard(req, res);
  if (!ctx) return;
  if (!(await clientInWorkspace(req.query.client_id, ctx.membership.workspace_id))) return res.status(404).json({ error: "client_not_found" });

  const { client_id, days, from, to } = req.query;
  if (!client_id) return res.status(400).json({ error: "No client_id" });
  const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
  if ((from || to) && !(DATE_OK.test(from || "") && DATE_OK.test(to || ""))) return res.status(400).json({ error: "Invalid period" });

  let currentRange, previousRange, periodLabel;
  if (from && to) {
    const fromD = new Date(from);
    const toD = new Date(to);
    const lengthMs = toD - fromD;
    if (isNaN(lengthMs) || lengthMs < 0) {
      return res.status(400).json({ error: "Neispravan period (od/do)" });
    }
    const prevTo = new Date(fromD.getTime() - 24 * 60 * 60 * 1000);
    const prevFrom = new Date(prevTo.getTime() - lengthMs);
    currentRange = { startDate: from, endDate: to };
    previousRange = { startDate: dateStr(prevFrom), endDate: dateStr(prevTo) };
    periodLabel = Math.round(lengthMs / (24 * 60 * 60 * 1000)) + 1;
  } else {
    const periodDays = parseInt(days) || 7;
    currentRange = { startDate: `${periodDays}daysAgo`, endDate: "yesterday" };
    previousRange = { startDate: `${periodDays * 2}daysAgo`, endDate: `${periodDays + 1}daysAgo` };
    periodLabel = periodDays;
  }

  const supaHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
  const periodTxt = from && to ? `${from}..${to}` : `${parseInt(days) || 7}d`;
  const meter = newMeter(`product-intelligence client=${client_id} period=${periodTxt}`);
  let t = Date.now();

  try {
    const connR = await fetch(
      `${SUPABASE_URL}/rest/v1/ga4_connections?client_id=eq.${client_id}&select=property_id,refresh_token,currency_code`,
      { headers: supaHeaders }
    );
    const connData = await connR.json();
    if (!connData.length) {
      return res.status(404).json({ error: "GA4 nije povezan za ovog klijenta" });
    }
    const { property_id, refresh_token, currency_code } = connData[0];
    const currency = currency_code || "EUR";

    // ── KEŠ: ključ sadrži klijenta, GA4 nalog, TAČNE datume (relativni period + današnji datum), valutu i verziju ──
    const todayUtc = new Date().toISOString().slice(0, 10);
    const key = cacheKey({ kind: "product-intelligence", v: CALC_VERSION, client: Number(client_id), property: String(property_id), currency, current: currentRange, previous: previousRange, today: from && to ? null : todayUtc });
    const forceRefresh = req.query.refresh === "1";
    if (!forceRefresh) {
      const hit = await cacheGet(key);
      if (hit) {
        meterStep(meter, "cache-hit", t);
        hit.data._cache = { hit: true, ageSec: hit.ageSec };
        hit.data._perf = meterDone(meter, { cache: "hit", ageSec: hit.ageSec, products: hit.data.totalProducts });
        return res.status(200).json(hit.data);
      }
    }

    // Isti zahtev u isto vreme na istom serveru -> jedan odlazak ka GA4
    const result = await singleFlight(key, async () => {
      const limit = createLimiter(MAX_PARALLEL);
      const accessToken = await refreshAccessToken(refresh_token);
      meterStep(meter, "setup", t);
      const ga4Fetch = (pid, tok, body) => ga4FetchLib(pid, tok, body, { meter, limit });
      const ga4FetchAll = (pid, tok, body, maxRows = 100000) => ga4FetchAllLib(pid, tok, body, { maxRows, meter, limit });
      const tAll = Date.now();

    // Četiri izveštaja kreću ZAJEDNO (limiter pazi da ukupno ne bude više od 4 upita istovremeno)
    // 1. Glavni izveštaj - ceo katalog, grupisano po itemId (ne po nazivu - varijante se ne mešaju!)
    const reportP = ga4FetchAll(property_id, accessToken, {
      dateRanges: [currentRange, previousRange],
      dimensions: [{ name: "itemId" }, { name: "itemName" }],
      metrics: [
        { name: "itemsViewed" },
        { name: "itemsAddedToCart" },
        { name: "itemsPurchased" },
        { name: "itemRevenue" }
      ],
      orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }]
    }, MAX_ROWS);
    // 2. Izvori - PRAVI ukupni prihod po kanalu (totalRevenue, isti nivo merenja kao GA4-ov sopstveni izveštaj).
    // Ovo je NAMERNO odvojeno od proizvod-nivo podataka - itemRevenue zna da bude manji od totalRevenue
    // kad transakcija nema potpune podatke o proizvodu (GA4-ovo poznato ograničenje, ne naša greška).
    const totalsReportP = ga4FetchAll(property_id, accessToken, {
      dateRanges: [currentRange],
      dimensions: [{ name: "sessionSource" }, { name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "totalRevenue" }]
    }, 20000);
    // 3. Izvori - proizvod-nivo raščlanjavanje PO kanalu (za tabelu kad klikneš na kanal)
    const sourceReportP = ga4FetchAll(property_id, accessToken, {
      dateRanges: [currentRange],
      dimensions: [
        { name: "sessionSource" },
        { name: "sessionDefaultChannelGroup" },
        { name: "itemId" },
        { name: "itemName" }
      ],
      metrics: [
        { name: "itemsViewed" },
        { name: "itemsAddedToCart" },
        { name: "itemsPurchased" },
        { name: "itemRevenue" }
      ],
      orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }]
    }, MAX_ROWS);
    // 4. Kategorije - proizvod-nivo grupisano po itemCategory (glavni nivo, ne pod-kategorije)
    const categoryReportP = ga4FetchAll(property_id, accessToken, {
      dateRanges: [currentRange],
      dimensions: [{ name: "itemCategory" }],
      metrics: [
        { name: "itemsViewed" },
        { name: "itemsAddedToCart" },
        { name: "itemsPurchased" },
        { name: "itemRevenue" }
      ],
      orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }]
    }, 20000); // ranije najviše 250 kategorija – sada sve
    const [report, totalsReport, sourceReport, categoryReport] = await Promise.all([reportP, totalsReportP, sourceReportP, categoryReportP]);
    meterStep(meter, `ga4(catalog ${(report.rows || []).length}/${report.rowCount || 0}, sources ${(sourceReport.rows || []).length}/${sourceReport.rowCount || 0} rows)`, tAll);
    // Ako je i pored povećane granice nešto odsečeno, to se vidi u logu (zapis "TRUNCATED")
    if ((report.rowCount || 0) > MAX_ROWS || (sourceReport.rowCount || 0) > MAX_ROWS) console.warn(`[perf] product-intelligence TRUNCATED client=${client_id} catalog=${report.rowCount} sources=${sourceReport.rowCount}`);
    const tCalc = Date.now();

    const byItem = {};
    for (const row of report.rows || []) {
      const id = row.dimensionValues[0].value;
      const name = row.dimensionValues[1].value;
      const rangeIdx = row.dimensionValues[2].value;
      const metrics = {
        viewed: parseInt(row.metricValues[0].value) || 0,
        addedToCart: parseInt(row.metricValues[1].value) || 0,
        purchased: parseInt(row.metricValues[2].value) || 0,
        revenue: parseFloat(row.metricValues[3].value) || 0
      };
      if (!byItem[id]) byItem[id] = { id, name, current: null, previous: null };
      if (rangeIdx === "date_range_0") byItem[id].current = metrics;
      else byItem[id].previous = metrics;
    }

    const pctChange = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : (cur > 0 ? 100 : 0));
    const safeRate = (num, denom) => (denom > 0 ? (num / denom) * 100 : 0);

    const catalog = Object.values(byItem).map((item) => {
      const cur = item.current || { viewed: 0, addedToCart: 0, purchased: 0, revenue: 0 };
      const prev = item.previous || { viewed: 0, addedToCart: 0, purchased: 0, revenue: 0 };
      return {
        id: item.id,
        name: item.name,
        ...cur,
        viewToCartRate: safeRate(cur.addedToCart, cur.viewed),
        cartToPurchaseRate: safeRate(cur.purchased, cur.addedToCart),
        conversionRate: safeRate(cur.purchased, cur.viewed),
        viewedChangePct: pctChange(cur.viewed, prev.viewed),
        cartChangePct: pctChange(cur.addedToCart, prev.addedToCart),
        purchasedChangePct: pctChange(cur.purchased, prev.purchased),
        previousViewed: prev.viewed,
        previousAddedToCart: prev.addedToCart,
        previousPurchased: prev.purchased
      };
    });

    const totalRevenue = catalog.reduce((s, i) => s + i.revenue, 0);
    const totalProducts = catalog.length;
    // Odgovor ne sme biti prevelik: zadrzavaju se svi proizvodi sa kupovinom ili korpom (sada ili ranije),
    // pa ostali po broju pregleda. Tako best-selleri, padovi, korpe i skokovi ostaju kompletni.
    const MAX_CATALOG = 6000;
    let catalogOut = catalog;
    if (catalog.length > MAX_CATALOG) {
      const score = (i) => (i.purchased > 0 || i.addedToCart > 0 || i.previousPurchased > 0 || i.previousAddedToCart > 0 ? 1e12 : 0) + i.revenue * 1000 + i.viewed + i.previousViewed;
      catalogOut = [...catalog].sort((a, b) => score(b) - score(a)).slice(0, MAX_CATALOG);
    }

    const sourceTotals = {
      paid: { meta: 0, google: 0, tiktok: 0, other: 0 },
      organic: { meta: 0, google: 0, tiktok: 0, direct: 0, other: 0 }
    };
    for (const row of totalsReport.rows || []) {
      const src = row.dimensionValues[0].value;
      const channelGroup = row.dimensionValues[1].value;
      const platform = detectPlatform(src);
      const paid = platform === "direct" ? false : isPaid(channelGroup);
      const bucket = paid ? "paid" : "organic";
      const revenue = parseFloat(row.metricValues[0].value) || 0;
      sourceTotals[bucket][platform] += revenue;
    }

    const sourceCatalogMap = {
      paid: { meta: {}, google: {}, tiktok: {}, other: {} },
      organic: { meta: {}, google: {}, tiktok: {}, direct: {}, other: {} }
    };

    for (const row of sourceReport.rows || []) {
      const src = row.dimensionValues[0].value;
      const channelGroup = row.dimensionValues[1].value;
      const itemId = row.dimensionValues[2].value;
      const itemName = row.dimensionValues[3].value;
      const platform = detectPlatform(src);
      const paid = platform === "direct" ? false : isPaid(channelGroup);
      const bucket = paid ? "paid" : "organic";

      const m = {
        viewed: parseInt(row.metricValues[0].value) || 0,
        addedToCart: parseInt(row.metricValues[1].value) || 0,
        purchased: parseInt(row.metricValues[2].value) || 0,
        revenue: parseFloat(row.metricValues[3].value) || 0
      };

      if (!sourceCatalogMap[bucket][platform][itemId]) {
        sourceCatalogMap[bucket][platform][itemId] = { id: itemId, name: itemName, viewed: 0, addedToCart: 0, purchased: 0, revenue: 0 };
      }
      const t = sourceCatalogMap[bucket][platform][itemId];
      t.viewed += m.viewed;
      t.addedToCart += m.addedToCart;
      t.purchased += m.purchased;
      t.revenue += m.revenue;
    }

    const sourceCatalog = { paid: {}, organic: {} };
    for (const bucket of ["paid", "organic"]) {
      for (const platform of Object.keys(sourceCatalogMap[bucket])) {
        sourceCatalog[bucket][platform] = Object.values(sourceCatalogMap[bucket][platform])
          .map((i) => ({
            ...i,
            viewToCartRate: safeRate(i.addedToCart, i.viewed),
            cartToPurchaseRate: safeRate(i.purchased, i.addedToCart),
            conversionRate: safeRate(i.purchased, i.viewed)
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 200);
      }
    }

    const categoriesRaw = (categoryReport.rows || []).map((row) => {
      const viewed = parseInt(row.metricValues[0].value) || 0;
      const addedToCart = parseInt(row.metricValues[1].value) || 0;
      const purchased = parseInt(row.metricValues[2].value) || 0;
      const revenue = parseFloat(row.metricValues[3].value) || 0;
      return {
        name: row.dimensionValues[0].value,
        viewed,
        addedToCart,
        purchased,
        revenue,
        viewToCartRate: safeRate(addedToCart, viewed),
        cartToPurchaseRate: safeRate(purchased, addedToCart),
        conversionRate: safeRate(purchased, viewed)
      };
    });
    const categories = categoriesRaw.filter((c) => c.name && c.name !== "(not set)");
    const hasCategories = categories.length > 0;

    meterStep(meter, "calc", tCalc);
    const payload = {
      periodDays: periodLabel,
      totalProducts,
      totalRevenue,
      currency,
      catalog: catalogOut,
      catalogTruncated: catalogOut.length < totalProducts,
      sourceTotals,
      sourceCatalog,
      categories,
      hasCategories
    };
    const json = JSON.stringify(payload);
    await cacheSet(key, { clientId: client_id, kind: "product-intelligence", json, ttlSec: CACHE_TTL_SEC });
    return { payload, bytes: json.length };
    }); // kraj singleFlight

    result.payload._cache = { hit: false, enabled: cacheEnabled() };
    result.payload._perf = meterDone(meter, { cache: forceRefresh ? "refresh" : "miss", bytes: result.bytes, products: result.payload.totalProducts, parallel: MAX_PARALLEL });
    return res.status(200).json(result.payload);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
