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

// Konverzija preko EUR kao "pivot" valute (kurseve čuvamo kao EUR -> sve ostalo)
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

  const { client_id, days, from, to } = req.query;
  if (!client_id) return res.status(400).json({ error: "No client_id" });

  let startStr, endStr, periodLabel;
  if (from && to) {
    startStr = from;
    endStr = to;
    const lengthMs = new Date(to) - new Date(from);
    periodLabel = Math.round(lengthMs / (24 * 60 * 60 * 1000)) + 1;
  } else {
    const periodDays = parseInt(days) || 30;
    const endDateTmp = new Date();
    endDateTmp.setDate(endDateTmp.getDate() - 1);
    const startDateTmp = new Date();
    startDateTmp.setDate(startDateTmp.getDate() - periodDays);
    startStr = startDateTmp.toISOString().split("T")[0];
    endStr = endDateTmp.toISOString().split("T")[0];
    periodLabel = periodDays;
  }

  const supaHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  try {
    // 1. Google Ads konekcija (potrebna da bi ovaj modul uopšte imao smisla)
    const gadsConnR = await fetch(
      `${SUPABASE_URL}/rest/v1/google_ads_connections?client_id=eq.${client_id}&select=customer_id,currency_code`,
      { headers: supaHeaders }
    );
    const gadsConnData = await gadsConnR.json();
    if (!gadsConnData.length) {
      return res.status(404).json({ error: "no_gads" });
    }
    const gadsCurrency = gadsConnData[0].currency_code || "EUR";

    // 2. GA4 konekcija (potrebna za revenue stranu)
    const ga4ConnR = await fetch(
      `${SUPABASE_URL}/rest/v1/ga4_connections?client_id=eq.${client_id}&select=property_id,refresh_token,currency_code`,
      { headers: supaHeaders }
    );
    const ga4ConnData = await ga4ConnR.json();
    if (!ga4ConnData.length) {
      return res.status(404).json({ error: "no_ga4" });
    }
    const { property_id, refresh_token, currency_code } = ga4ConnData[0];
    const ga4Currency = currency_code || "EUR";

    // 3. Spend/klikovi/impresije - IZ NAŠE BAZE (već sinhronizovano cron poslom, brzo, bez novog API poziva)
    const spendR = await fetch(
      `${SUPABASE_URL}/rest/v1/google_ads_daily_spend?client_id=eq.${client_id}&date=gte.${startStr}&date=lte.${endStr}&select=campaign_id,campaign_name,spend,clicks,impressions`,
      { headers: supaHeaders }
    );
    const spendRows = await spendR.json();

    const byCampaign = {};
    for (const row of spendRows) {
      if (!byCampaign[row.campaign_id]) {
        byCampaign[row.campaign_id] = { campaign_id: row.campaign_id, campaign_name: row.campaign_name, spend: 0, clicks: 0, impressions: 0 };
      }
      byCampaign[row.campaign_id].spend += parseFloat(row.spend) || 0;
      byCampaign[row.campaign_id].clicks += parseInt(row.clicks) || 0;
      byCampaign[row.campaign_id].impressions += parseInt(row.impressions) || 0;
    }

    // 4. Revenue/konverzije PO KAMPANJI - ŽIVO iz GA4, filtrirano po sessionGoogleAdsCampaignId (auto-tagging, ne UTM)
    const accessToken = await refreshAccessToken(refresh_token);
    const ga4Report = await ga4Fetch(property_id, accessToken, {
      dateRanges: [{ startDate: startStr, endDate: endStr }],
      dimensions: [{ name: "sessionGoogleAdsCampaignId" }],
      metrics: [{ name: "totalRevenue" }, { name: "conversions" }],
      limit: 500
    });

    const revenueByCampaignId = {};
    for (const row of ga4Report.rows || []) {
      const id = row.dimensionValues[0].value;
      revenueByCampaignId[id] = {
        revenue: parseFloat(row.metricValues[0].value) || 0,
        conversions: parseFloat(row.metricValues[1].value) || 0
      };
    }

    // 4.5 Kursevi valuta (potrebni ako Spend ili Revenue nije već u EUR - EUR je naša "glavna" prikazna valuta)
    const needsRates = gadsCurrency !== "EUR" || ga4Currency !== "EUR";
    let rates = null;
    let rateDate = null;
    if (needsRates) {
      const rateR = await fetch(`${SUPABASE_URL}/rest/v1/exchange_rates?id=eq.1&select=rates,updated_at`, { headers: supaHeaders });
      const rateData = await rateR.json();
      if (rateData.length) {
        rates = rateData[0].rates;
        rateDate = rateData[0].updated_at;
      }
    }

    // 5. Spajanje - svaka kampanja sa spend-om dobija svoj GA4 revenue (0 ako nema)
    // Spend i Revenue se uvek prikazuju u EUR (glavno), original valuta ostaje kao referenca
    const campaigns = Object.values(byCampaign).map((c) => {
      const ga4Data = revenueByCampaignId[c.campaign_id] || { revenue: 0, conversions: 0 };
      const spendEUR = rates ? convert(c.spend, gadsCurrency, "EUR", rates) : c.spend;
      const revenueEUR = rates ? convert(ga4Data.revenue, ga4Currency, "EUR", rates) : ga4Data.revenue;
      return {
        ...c,
        revenue: ga4Data.revenue,
        revenueEUR,
        conversions: ga4Data.conversions,
        spendEUR,
        roas: spendEUR>0 ? revenueEUR / spendEUR : 0
      };
    }).sort((a, b) => b.spend - a.spend);

    // 6. Neraspoređeno - GA4 revenue bez prepoznatog campaign ID-a ("(not set)" ili prazno)
    const unattributedKeys = Object.keys(revenueByCampaignId).filter(
      (k) => k === "(not set)" || k === "" || !k
    );
    const unattributed = unattributedKeys.reduce(
      (acc, k) => ({
        revenue: acc.revenue + revenueByCampaignId[k].revenue,
        conversions: acc.conversions + revenueByCampaignId[k].conversions
      }),
      { revenue: 0, conversions: 0 }
    );
    unattributed.revenueEUR = rates ? convert(unattributed.revenue, ga4Currency, "EUR", rates) : unattributed.revenue;

    const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
    const totalSpendEUR = campaigns.reduce((s, c) => s + c.spendEUR, 0);
    const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
    const totalRevenueEUR = campaigns.reduce((s, c) => s + c.revenueEUR, 0);

    return res.status(200).json({
      periodDays: periodLabel,
      currency: ga4Currency,
      gadsCurrency,
      rateDate,
      showSpendNative: gadsCurrency !== "EUR",
      showRevenueNative: ga4Currency !== "EUR",
      campaigns,
      unattributed,
      totalSpend,
      totalSpendEUR,
      totalRevenue,
      totalRevenueEUR,
      totalRoas: totalSpendEUR > 0 ? totalRevenueEUR / totalSpendEUR : 0
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
