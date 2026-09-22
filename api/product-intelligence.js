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

// Razvrstavanje sirovog GA4 izvora u jednu od naših 6 kategorija.
// Koristimo i medium (ne samo source) da izbegnemo mešanje slučajeva
// kao "(direct)/(none)" sa nečim drugim.
function bucketSource(source, medium) {
  const s = (source || "").toLowerCase();
  const m = (medium || "").toLowerCase();
  if (s.includes("facebook") || s.includes("instagram") || s === "fb") return "meta";
  if (s.includes("google")) return "google";
  if (s.includes("tiktok")) return "tiktok";
  if (s === "(direct)" && (m === "(none)" || m === "")) return "direct";
  if (["bing", "yahoo", "duckduckgo", "yandex"].some((e) => s.includes(e))) return "organic";
  return "other";
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

  // Trenutni i prethodni period (prethodni = isti broj dana, odmah pre trenutnog)
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
    // 1. Nađi GA4 konekciju za ovog klijenta
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

    // 2. Glavni izveštaj - ceo katalog, trenutni + prethodni period odjednom
    const report = await ga4Fetch(property_id, accessToken, {
      dateRanges: [currentRange, previousRange],
      dimensions: [{ name: "itemName" }],
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
      const name = row.dimensionValues[0].value;
      const rangeIdx = row.dimensionValues[1].value;
      const metrics = {
        viewed: parseInt(row.metricValues[0].value) || 0,
        addedToCart: parseInt(row.metricValues[1].value) || 0,
        purchased: parseInt(row.metricValues[2].value) || 0,
        revenue: parseFloat(row.metricValues[3].value) || 0
      };
      if (!byItem[name]) byItem[name] = { name, current: null, previous: null };
      if (rangeIdx === "date_range_0") byItem[name].current = metrics;
      else byItem[name].previous = metrics;
    }

    const catalog = Object.values(byItem).map((item) => {
      const cur = item.current || { viewed: 0, addedToCart: 0, purchased: 0, revenue: 0 };
      const prev = item.previous || { viewed: 0, addedToCart: 0, purchased: 0, revenue: 0 };
      const viewedChangePct = prev.viewed > 0 ? ((cur.viewed - prev.viewed) / prev.viewed) * 100 : (cur.viewed > 0 ? 100 : 0);
      const conversionRate = cur.viewed > 0 ? (cur.purchased / cur.viewed) * 100 : 0;
      return { name: item.name, ...cur, viewedChangePct, conversionRate };
    });

    const totalRevenue = catalog.reduce((s, i) => s + i.revenue, 0);

    // 3. Best-selleri - top 10 po prihodu
    const bestsellers = [...catalog].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // 4. Skokovi - min 20 pregleda, rast preko 50%
    const spikes = catalog
      .filter((i) => i.viewed >= 20 && i.viewedChangePct >= 50)
      .sort((a, b) => b.viewedChangePct - a.viewedChangePct)
      .slice(0, 10);

    // 5. Napuštene korpe
    const abandoned = catalog
      .filter((i) => i.addedToCart >= 10 && i.conversionRate < 5)
      .sort((a, b) => b.addedToCart - a.addedToCart)
      .slice(0, 10);

    // 6. Izvor saobraćaja za Skokove (samo ti proizvodi, da štedimo pozive)
    let spikeSources = {};
    if (spikes.length > 0) {
      const sourceReportSpikes = await ga4Fetch(property_id, accessToken, {
        dateRanges: [currentRange],
        dimensions: [{ name: "itemName" }, { name: "sessionSource" }],
        metrics: [{ name: "itemsViewed" }],
        dimensionFilter: {
          filter: { fieldName: "itemName", inListFilter: { values: spikes.map((s) => s.name) } }
        },
        orderBys: [{ metric: { metricName: "itemsViewed" }, desc: true }],
        limit: 100
      });
      for (const row of sourceReportSpikes.rows || []) {
        const name = row.dimensionValues[0].value;
        const source = row.dimensionValues[1].value;
        if (!spikeSources[name]) spikeSources[name] = source;
      }
    }
    const spikesWithSource = spikes.map((s) => ({ ...s, topSource: spikeSources[s.name] || "N/A" }));

    // 7. Izvori kartica - svi proizvodi grupisani po kanalu (Meta/Google/TikTok/Direct/Organic/Ostalo)
    const sourceReport = await ga4Fetch(property_id, accessToken, {
      dateRanges: [currentRange],
      dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }, { name: "itemName" }],
      metrics: [
        { name: "itemsViewed" },
        { name: "itemsAddedToCart" },
        { name: "itemsPurchased" },
        { name: "itemRevenue" }
      ],
      orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }],
      limit: 5000
    });

    const sourceTotals = { meta: 0, google: 0, tiktok: 0, direct: 0, organic: 0, other: 0 };
    const sourceCatalogMap = { meta: {}, google: {}, tiktok: {}, direct: {}, organic: {}, other: {} };

    for (const row of sourceReport.rows || []) {
      const src = row.dimensionValues[0].value;
      const med = row.dimensionValues[1].value;
      const itemName = row.dimensionValues[2].value;
      const bucket = bucketSource(src, med);
      const m = {
        viewed: parseInt(row.metricValues[0].value) || 0,
        addedToCart: parseInt(row.metricValues[1].value) || 0,
        purchased: parseInt(row.metricValues[2].value) || 0,
        revenue: parseFloat(row.metricValues[3].value) || 0
      };
      sourceTotals[bucket] += m.revenue;
      if (!sourceCatalogMap[bucket][itemName]) {
        sourceCatalogMap[bucket][itemName] = { name: itemName, viewed: 0, addedToCart: 0, purchased: 0, revenue: 0 };
      }
      const t = sourceCatalogMap[bucket][itemName];
      t.viewed += m.viewed;
      t.addedToCart += m.addedToCart;
      t.purchased += m.purchased;
      t.revenue += m.revenue;
    }

    const sourceCatalog = {};
    for (const bucket of Object.keys(sourceCatalogMap)) {
      sourceCatalog[bucket] = Object.values(sourceCatalogMap[bucket])
        .map((i) => ({ ...i, conversionRate: i.viewed > 0 ? (i.purchased / i.viewed) * 100 : 0 }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 200);
    }

    return res.status(200).json({
      periodDays: periodLabel,
      totalProducts: catalog.length,
      totalRevenue,
      catalog,
      bestsellers,
      spikes: spikesWithSource,
      abandoned,
      sourceTotals,
      sourceCatalog
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
