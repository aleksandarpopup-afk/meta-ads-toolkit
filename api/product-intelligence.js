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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { client_id, days } = req.query;
  const periodDays = parseInt(days) || 30;

  if (!client_id) return res.status(400).json({ error: "No client_id" });

  const supaHeaders = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`
  };

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

    // 2. Jedan poziv, dva perioda odjednom (trenutni + prethodni, za poređenje)
    const report = await ga4Fetch(property_id, accessToken, {
      dateRanges: [
        { startDate: `${periodDays}daysAgo`, endDate: "yesterday" },
        { startDate: `${periodDays * 2}daysAgo`, endDate: `${periodDays + 1}daysAgo` }
      ],
      dimensions: [{ name: "itemName" }],
      metrics: [
        { name: "itemsViewed" },
        { name: "itemsAddedToCart" },
        { name: "itemsPurchased" },
        { name: "itemRevenue" }
      ],
      orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }],
      limit: 500
    });

    // 3. Spajamo trenutni i prethodni period po nazivu proizvoda
    const byItem = {};
    for (const row of report.rows || []) {
      const name = row.dimensionValues[0].value;
      const rangeIdx = row.dimensionValues[1].value; // "date_range_0" (trenutni) ili "date_range_1" (prethodni)
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

    // 4. Best-selleri - top 10 po prihodu
    const bestsellers = [...catalog].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // 5. Skokovi - min 20 pregleda u tekućem periodu, i rast preko 50%
    const spikes = catalog
      .filter((i) => i.viewed >= 20 && i.viewedChangePct >= 50)
      .sort((a, b) => b.viewedChangePct - a.viewedChangePct)
      .slice(0, 10);

    // 6. Napuštene korpe - dosta dodavanja u korpu, mala stopa konverzije
    const abandoned = catalog
      .filter((i) => i.addedToCart >= 10 && i.conversionRate < 5)
      .sort((a, b) => b.addedToCart - a.addedToCart)
      .slice(0, 10);

    // 7. Izvor saobraćaja - samo za proizvode iz "Skokovi" liste (štedimo pozive)
    let spikeSources = {};
    if (spikes.length > 0) {
      const sourceReport = await ga4Fetch(property_id, accessToken, {
        dateRanges: [{ startDate: `${periodDays}daysAgo`, endDate: "yesterday" }],
        dimensions: [{ name: "itemName" }, { name: "sessionSource" }],
        metrics: [{ name: "itemsViewed" }],
        dimensionFilter: {
          filter: {
            fieldName: "itemName",
            inListFilter: { values: spikes.map((s) => s.name) }
          }
        },
        orderBys: [{ metric: { metricName: "itemsViewed" }, desc: true }],
        limit: 100
      });
      for (const row of sourceReport.rows || []) {
        const name = row.dimensionValues[0].value;
        const source = row.dimensionValues[1].value;
        if (!spikeSources[name]) spikeSources[name] = source; // uzimamo samo top (prvi) izvor po proizvodu
      }
    }
    const spikesWithSource = spikes.map((s) => ({ ...s, topSource: spikeSources[s.name] || "N/A" }));

    return res.status(200).json({
      periodDays,
      totalProducts: catalog.length,
      catalog,
      bestsellers,
      spikes: spikesWithSource,
      abandoned
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
