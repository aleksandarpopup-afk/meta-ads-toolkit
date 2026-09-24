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
  if (!r.ok) throw new Error(data.error?.message || JSON.stringify(data));
  return data;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { client_id, category, days, from, to } = req.query;
  if (!client_id) return res.status(400).json({ error: "Missing client_id" });

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

    // BEZ ?category= - vraćamo listu SVIH kategorija (za picker)
    if (!category) {
      const catReport = await ga4Fetch(property_id, accessToken, {
        dateRanges: [{ startDate: startStr, endDate: endStr }],
        dimensions: [{ name: "itemCategory" }],
        metrics: [{ name: "itemRevenue" }, { name: "itemsPurchased" }],
        orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }],
        limit: 50
      });
      const categories = (catReport.rows || []).map((row) => ({
        name: row.dimensionValues[0].value,
        revenue: parseFloat(row.metricValues[0].value) || 0,
        purchased: parseInt(row.metricValues[1].value) || 0
      }));
      const realCategories = categories.filter((c) => c.name && c.name !== "(not set)");
      const hasCategories = realCategories.length > 0;
      return res.status(200).json({ currency, categories: hasCategories ? realCategories : [], hasCategories });
    }

    // SA ?category= - raščlanjenje TE kategorije po kampanjama (isti obrazac kao products-by-campaign.js)
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
        filter: { fieldName: "itemCategory", stringFilter: { matchType: "EXACT", value: category } }
      },
      orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }],
      limit: 200
    });

    const catByCampaignId = {};
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
        catByCampaignId[id] = m;
      }
    }

    const matchedIds = Object.keys(catByCampaignId);
    if (!matchedIds.length) {
      return res.status(200).json({ currency, results: [], unattributed, noMatch: true });
    }

    const spendR = await fetch(
      `${SUPABASE_URL}/rest/v1/google_ads_daily_spend?client_id=eq.${client_id}&date=gte.${startStr}&date=lte.${endStr}&campaign_id=in.(${matchedIds.join(",")})&select=campaign_id,campaign_name,spend`,
      { headers: supaHeaders }
    );
    const spendRows = await spendR.json();
    const campaignInfo = {};
    for (const row of spendRows) {
      if (!campaignInfo[row.campaign_id]) campaignInfo[row.campaign_id] = { campaign_name: row.campaign_name, totalSpend: 0 };
      campaignInfo[row.campaign_id].totalSpend += parseFloat(row.spend) || 0;
    }

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
      const p = catByCampaignId[id];
      const info = campaignInfo[id] || { campaign_name: `Kampanja ${id}`, totalSpend: 0 };
      const totalRev = campaignTotalRevenue[id] || 0;
      return {
        campaign_id: id,
        campaign_name: info.campaign_name,
        categoryViewed: p.viewed,
        categoryAddedToCart: p.addedToCart,
        categoryPurchased: p.purchased,
        categoryRevenue: p.revenue,
        campaignTotalSpend: info.totalSpend,
        campaignTotalRevenue: totalRev,
        campaignRoas: info.totalSpend > 0 ? totalRev / info.totalSpend : 0
      };
    }).sort((a, b) => b.categoryRevenue - a.categoryRevenue);

    return res.status(200).json({ currency, results, unattributed, noMatch: false });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
