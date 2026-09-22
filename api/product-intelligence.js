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

async function ga4Fetch(propertyId, accessToken, body) {
  const r = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body)
    }
  );
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data));
  return data;
}

// Platforma (meta/google/tiktok/direct/other) na osnovu izvora
function detectPlatform(source) {
  const s = (source || "").toLowerCase();
  if (s.includes("facebook") || s.includes("instagram") || s === "fb") return "meta";
  if (s.includes("google")) return "google";
  if (s.includes("tiktok")) return "tiktok";
  if (s === "(direct)") return "direct";
  return "other";
}

// Plaćeno ili organsko, na osnovu GA4-ovog sopstvenog channel group-a.
// Cross-network (Performance Max i slične kampanje) je TAKOĐE plaćeno, samo ne počinje rečju "Paid".
function isPaid(channelGroup) {
  const cg = (channelGroup || "").toLowerCase();
  return cg.startsWith("paid") || cg === "cross-network";
}

function dateStr(d) {
  return d.toISOString().split("T")[0];
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { client_id, days, from, to } = req.query;
  if (!client_id) return res.status(400).json({ error: "No client_id" });

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
    const periodDays = parseInt(days) || 30;
    currentRange = { startDate: `${periodDays}daysAgo`, endDate: "yesterday" };
    previousRange = { startDate: `${periodDays * 2}daysAgo`, endDate: `${periodDays + 1}daysAgo` };
    periodLabel = periodDays;
  }

  const supaHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  try {
    const connR = await fetch(
      `${SUPABASE_URL}/rest/v1/ga4_connections?client_id=eq.${client_id}&select=property_id,refresh_token`,
      { headers: supaHeaders }
    );
    const connData = await connR.json();
    if (!connData.length) {
      return res.status(404).json({ error: "GA4 nije povezan za ovog klijenta" });
    }
    const { property_id, refresh_token } = connData[0];
    const accessToken = await refreshAccessToken(refresh_token);

    // 1. Glavni izveštaj - ceo katalog, grupisano po itemId (ne po nazivu - varijante se ne mešaju!)
    const report = await ga4Fetch(property_id, accessToken, {
      dateRanges: [currentRange, previousRange],
      dimensions: [{ name: "itemId" }, { name: "itemName" }],
      metrics: [
        { name: "itemsViewed" },
        { name: "itemsAddedToCart" },
        { name: "itemsPurchased" },
        { name: "itemRevenue" }
      ],
      orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }],
      limit: 2000
    });

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
        purchasedChangePct: pctChange(cur.purchased, prev.purchased)
      };
    });

    const totalRevenue = catalog.reduce((s, i) => s + i.revenue, 0);

    // 2. Izvori - PRAVI ukupni prihod po kanalu (totalRevenue, isti nivo merenja kao GA4-ov sopstveni izveštaj).
    // Ovo je NAMERNO odvojeno od proizvod-nivo podataka ispod - itemRevenue zna da bude manji od totalRevenue
    // kad transakcija nema potpune podatke o proizvodu (GA4-ovo poznato ograničenje, ne naša greška).
    const totalsReport = await ga4Fetch(property_id, accessToken, {
      dateRanges: [currentRange],
      dimensions: [{ name: "sessionSource" }, { name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "totalRevenue" }],
      limit: 500
    });

    const sourceTotals = {
      paid: { meta: 0, google: 0, tiktok: 0 },
      organic: { meta: 0, google: 0, tiktok: 0, direct: 0, other: 0 }
    };
    for (const row of totalsReport.rows || []) {
      const src = row.dimensionValues[0].value;
      const channelGroup = row.dimensionValues[1].value;
      const platform = detectPlatform(src);
      const paid = (platform === "direct" || platform === "other") ? false : isPaid(channelGroup);
      const bucket = paid ? "paid" : "organic";
      const revenue = parseFloat(row.metricValues[0].value) || 0;
      sourceTotals[bucket][platform] += revenue;
    }

    // 3. Izvori - proizvod-nivo raščlanjavanje PO kanalu (za tabelu kad klikneš na kanal)
    const sourceReport = await ga4Fetch(property_id, accessToken, {
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
      orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }],
      limit: 5000
    });

    const sourceCatalogMap = {
      paid: { meta: {}, google: {}, tiktok: {} },
      organic: { meta: {}, google: {}, tiktok: {}, direct: {}, other: {} }
    };

    for (const row of sourceReport.rows || []) {
      const src = row.dimensionValues[0].value;
      const channelGroup = row.dimensionValues[1].value;
      const itemId = row.dimensionValues[2].value;
      const itemName = row.dimensionValues[3].value;
      const platform = detectPlatform(src);
      const paid = (platform === "direct" || platform === "other") ? false : isPaid(channelGroup);
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

    return res.status(200).json({
      periodDays: periodLabel,
      totalProducts: catalog.length,
      totalRevenue,
      catalog,
      sourceTotals,
      sourceCatalog
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
