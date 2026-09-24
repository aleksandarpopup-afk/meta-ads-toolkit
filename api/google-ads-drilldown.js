const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GADS_VERSION = "v25";

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

async function gadsSearch(customerId, accessToken, query, loginCustomerId) {
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;
  const r = await fetch(`https://googleads.googleapis.com/${GADS_VERSION}/customers/${customerId}/googleAds:search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data));
  return data;
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
  if (!r.ok) throw new Error(data.error?.message || JSON.stringify(data));
  return data;
}

function convert(amount, fromCur, toCur, rates) {
  if (fromCur === toCur) return amount;
  const rFrom = fromCur === "EUR" ? 1 : rates[fromCur];
  const rTo = toCur === "EUR" ? 1 : rates[toCur];
  if (!rFrom || !rTo) return null;
  return amount * (rTo / rFrom);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { client_id, campaign_id, ad_group_id, days, from, to } = req.query;
  if (!client_id || !campaign_id) return res.status(400).json({ error: "Missing client_id or campaign_id" });

  let startStr, endStr;
  if (from && to) {
    startStr = from;
    endStr = to;
  } else {
    const periodDays = parseInt(days) || 30;
    const endDateTmp = new Date();
    endDateTmp.setDate(endDateTmp.getDate() - 1);
    const startDateTmp = new Date();
    startDateTmp.setDate(startDateTmp.getDate() - periodDays);
    startStr = startDateTmp.toISOString().split("T")[0];
    endStr = endDateTmp.toISOString().split("T")[0];
  }

  const supaHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  try {
    const gadsConnR = await fetch(
      `${SUPABASE_URL}/rest/v1/google_ads_connections?client_id=eq.${client_id}&select=customer_id,manager_id,currency_code,refresh_token`,
      { headers: supaHeaders }
    );
    const gadsConnData = await gadsConnR.json();
    if (!gadsConnData.length) return res.status(404).json({ error: "no_gads" });
    const { customer_id, manager_id, currency_code: gadsCurrency, refresh_token: gadsRefreshToken } = gadsConnData[0];

    const ga4ConnR = await fetch(
      `${SUPABASE_URL}/rest/v1/ga4_connections?client_id=eq.${client_id}&select=property_id,refresh_token,currency_code`,
      { headers: supaHeaders }
    );
    const ga4ConnData = await ga4ConnR.json();
    if (!ga4ConnData.length) return res.status(404).json({ error: "no_ga4" });
    const { property_id, refresh_token: ga4RefreshToken, currency_code: ga4Currency } = ga4ConnData[0];

    const [gadsAccessToken, ga4AccessToken] = await Promise.all([
      refreshAccessToken(gadsRefreshToken),
      refreshAccessToken(ga4RefreshToken)
    ]);

    let level, items;

    if (!ad_group_id) {
      level = "ad_group";
      const query = `SELECT ad_group.id, ad_group.name, metrics.cost_micros, metrics.clicks, metrics.impressions FROM ad_group WHERE campaign.id = ${campaign_id} AND segments.date BETWEEN '${startStr}' AND '${endStr}'`;
      const data = await gadsSearch(customer_id, gadsAccessToken, query, manager_id || undefined);
      items = (data.results || []).map((r) => ({
        id: r.adGroup.id,
        name: r.adGroup.name || `Ad grupa ${r.adGroup.id}`,
        spend: (parseInt(r.metrics?.costMicros) || 0) / 1000000,
        clicks: parseInt(r.metrics?.clicks) || 0,
        impressions: parseInt(r.metrics?.impressions) || 0
      }));
    } else {
      level = "ad";
      const query = `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, metrics.cost_micros, metrics.clicks, metrics.impressions FROM ad_group_ad WHERE campaign.id = ${campaign_id} AND ad_group.id = ${ad_group_id} AND segments.date BETWEEN '${startStr}' AND '${endStr}'`;
      const data = await gadsSearch(customer_id, gadsAccessToken, query, manager_id || undefined);
      items = (data.results || []).map((r) => ({
        id: r.adGroupAd.ad.id,
        name: r.adGroupAd.ad.name || `Oglas ${r.adGroupAd.ad.id}`,
        spend: (parseInt(r.metrics?.costMicros) || 0) / 1000000,
        clicks: parseInt(r.metrics?.clicks) || 0,
        impressions: parseInt(r.metrics?.impressions) || 0
      }));
    }

    // GA4 revenue - blendovano po ad_group ID ili creative (ad) ID, isti auto-tagging mehanizam kao za campaign ID
    if (items.length) {
      const ids = items.map((i) => i.id);
      const ga4Dimension = level === "ad_group" ? "sessionGoogleAdsAdGroupId" : "sessionGoogleAdsCreativeId";
      const ga4Report = await ga4Fetch(property_id, ga4AccessToken, {
        dateRanges: [{ startDate: startStr, endDate: endStr }],
        dimensions: [{ name: ga4Dimension }],
        metrics: [{ name: "totalRevenue" }, { name: "transactions" }],
        dimensionFilter: { filter: { fieldName: ga4Dimension, inListFilter: { values: ids } } },
        limit: 500
      });
      const revenueById = {};
      for (const row of ga4Report.rows || []) {
        revenueById[row.dimensionValues[0].value] = {
          revenue: parseFloat(row.metricValues[0].value) || 0,
          conversions: parseFloat(row.metricValues[1].value) || 0
        };
      }
      items = items.map((i) => {
        const rd = revenueById[i.id] || { revenue: 0, conversions: 0 };
        return { ...i, revenue: rd.revenue, conversions: rd.conversions };
      });
    }

    // Valuta - EUR uvek glavna, isti princip kao Kampanje
    const showSpendNative = (gadsCurrency || "EUR") !== "EUR";
    const showRevenueNative = (ga4Currency || "EUR") !== "EUR";
    let rates = null;
    if (showSpendNative || showRevenueNative) {
      const rateR = await fetch(`${SUPABASE_URL}/rest/v1/exchange_rates?id=eq.1&select=rates`, { headers: supaHeaders });
      const rateData = await rateR.json();
      if (rateData.length) rates = rateData[0].rates;
    }
    items = items.map((i) => {
      const spendEUR = rates ? convert(i.spend, gadsCurrency || "EUR", "EUR", rates) : i.spend;
      const revenueEUR = rates ? convert(i.revenue, ga4Currency || "EUR", "EUR", rates) : i.revenue;
      return { ...i, spendEUR, revenueEUR, roas: spendEUR > 0 ? revenueEUR / spendEUR : 0 };
    });

    items.sort((a, b) => b.spend - a.spend);

    return res.status(200).json({
      level,
      gadsCurrency: gadsCurrency || "EUR",
      currency: ga4Currency || "EUR",
      showSpendNative,
      showRevenueNative,
      items
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
