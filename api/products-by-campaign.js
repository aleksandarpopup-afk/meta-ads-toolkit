const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

async function fetchAllSupabaseRows(url, headers) {
  let allRows = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const r = await fetch(url, { headers: { ...headers, Range: `${offset}-${offset + pageSize - 1}` } });
    const rows = await r.json();
    if (!Array.isArray(rows)) break;
    allRows = allRows.concat(rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return allRows;
}

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

  const { client_id, q, days, from, to } = req.query;
  if (!client_id || !q || !q.trim()) return res.status(400).json({ error: "Missing client_id or search term" });

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
    const ga4ConnR = await fetch(
      `${SUPABASE_URL}/rest/v1/ga4_connections?client_id=eq.${client_id}&select=property_id,refresh_token,currency_code`,
      { headers: supaHeaders }
    );
    const ga4ConnData = await ga4ConnR.json();
    if (!ga4ConnData.length) return res.status(404).json({ error: "no_ga4" });
    const { property_id, refresh_token, currency_code } = ga4ConnData[0];
    const currency = currency_code || "EUR";
    const accessToken = await refreshAccessToken(refresh_token);

    const gadsConnR = await fetch(
      `${SUPABASE_URL}/rest/v1/google_ads_connections?client_id=eq.${client_id}&select=currency_code`,
      { headers: supaHeaders }
    );
    const gadsConnData = await gadsConnR.json();
    const gadsCurrency = gadsConnData.length ? (gadsConnData[0].currency_code || "EUR") : "EUR";

    const showSpendNative = gadsCurrency !== "EUR";
    const showRevenueNative = currency !== "EUR";
    let rates = null;
    if (showSpendNative || showRevenueNative) {
      const rateR = await fetch(`${SUPABASE_URL}/rest/v1/exchange_rates?id=eq.1&select=rates`, { headers: supaHeaders });
      const rateData = await rateR.json();
      if (rateData.length) rates = rateData[0].rates;
    }

    // 1. GA4 - prihod/kupovine OVOG proizvoda, raščlanjeno po Google Ads kampanji (campaign ID)
    const report = await ga4Fetch(property_id, accessToken, {
      dateRanges: [{ startDate: startStr, endDate: endStr }],
      dimensions: [{ name: "sessionGoogleAdsCampaignId" }],
      metrics: [
        { name: "itemsViewed" },
        { name: "itemsAddedToCart" },
        { name: "itemsPurchased" },
        { name: "itemRevenue" }
      ],
      dimensionFilter: {
        filter: { fieldName: "itemName", stringFilter: { matchType: "CONTAINS", value: q.trim(), caseSensitive: false } }
      },
      orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }],
      limit: 200
    });

    const productByCampaignId = {};
    let unattributed = { viewed: 0, addedToCart: 0, purchased: 0, revenue: 0 };
    for (const row of report.rows || []) {
      const id = row.dimensionValues[0].value;
      const m = {
        viewed: parseInt(row.metricValues[0].value) || 0,
        addedToCart: parseInt(row.metricValues[1].value) || 0,
        purchased: parseInt(row.metricValues[2].value) || 0,
        revenue: parseFloat(row.metricValues[3].value) || 0
      };
      if (id === "(not set)" || id === "" || !id) {
        unattributed.viewed += m.viewed;
        unattributed.addedToCart += m.addedToCart;
        unattributed.purchased += m.purchased;
        unattributed.revenue += m.revenue;
      } else {
        productByCampaignId[id] = m;
      }
    }

    const matchedIds = Object.keys(productByCampaignId);
    if (!matchedIds.length) {
      return res.status(200).json({ currency, results: [], unattributed, noMatch: true });
    }

    // 2. Spend/naziv/ukupan ROAS SVAKE od ovih kampanja - iz naše baze (kontekst, NE ROAS ovog proizvoda)
    const spendRows = await fetchAllSupabaseRows(
      `${SUPABASE_URL}/rest/v1/google_ads_daily_spend?client_id=eq.${client_id}&date=gte.${startStr}&date=lte.${endStr}&campaign_id=in.(${matchedIds.join(",")})&select=campaign_id,campaign_name,spend`,
      supaHeaders
    );
    const campaignInfo = {};
    for (const row of spendRows) {
      if (!campaignInfo[row.campaign_id]) campaignInfo[row.campaign_id] = { campaign_name: row.campaign_name, totalSpend: 0 };
      campaignInfo[row.campaign_id].totalSpend += parseFloat(row.spend) || 0;
    }

    // 3. Ukupan GA4 revenue SVAKE kampanje (za "ukupan ROAS kampanje" kontekst) - odvojen poziv, cela kampanja, ne samo ovaj proizvod
    const campaignTotalsReport = await ga4Fetch(property_id, accessToken, {
      dateRanges: [{ startDate: startStr, endDate: endStr }],
      dimensions: [{ name: "sessionGoogleAdsCampaignId" }],
      metrics: [{ name: "totalRevenue" }],
      dimensionFilter: {
        filter: { fieldName: "sessionGoogleAdsCampaignId", inListFilter: { values: matchedIds } }
      },
      limit: 200
    });
    const campaignTotalRevenue = {};
    for (const row of campaignTotalsReport.rows || []) {
      campaignTotalRevenue[row.dimensionValues[0].value] = parseFloat(row.metricValues[0].value) || 0;
    }

    const results = matchedIds.map((id) => {
      const p = productByCampaignId[id];
      const info = campaignInfo[id] || { campaign_name: `Kampanja ${id}`, totalSpend: 0 };
      const totalRev = campaignTotalRevenue[id] || 0;
      const spendEUR = rates ? convert(info.totalSpend, gadsCurrency, "EUR", rates) : info.totalSpend;
      const totalRevEUR = rates ? convert(totalRev, currency, "EUR", rates) : totalRev;
      const productRevenueEUR = rates ? convert(p.revenue, currency, "EUR", rates) : p.revenue;
      return {
        campaign_id: id,
        campaign_name: info.campaign_name,
        productViewed: p.viewed,
        productAddedToCart: p.addedToCart,
        productPurchased: p.purchased,
        productRevenue: p.revenue,
        productRevenueEUR,
        campaignTotalSpend: info.totalSpend,
        campaignTotalSpendEUR: spendEUR,
        campaignTotalRevenue: totalRev,
        campaignTotalRevenueEUR: totalRevEUR,
        campaignRoas: spendEUR > 0 ? totalRevEUR / spendEUR : 0
      };
    }).sort((a, b) => b.productRevenue - a.productRevenue);

    return res.status(200).json({ currency, gadsCurrency, showSpendNative, showRevenueNative, results, unattributed, noMatch: false });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
