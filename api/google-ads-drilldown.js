import { guard, clientInWorkspace } from "./_lib/auth.js";
import { ga4FetchAll, createLimiter, newMeter, meterDone } from "./_lib/ga4.js";

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
  let allResults = [];
  let pageToken;
  do {
    const body = { query };
    if (pageToken) body.pageToken = pageToken;
    const r = await fetch(`https://googleads.googleapis.com/${GADS_VERSION}/customers/${customerId}/googleAds:search`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(data));
    allResults = allResults.concat(data.results || []);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return { results: allResults };
}

function convert(amount, fromCur, toCur, rates) {
  if (fromCur === toCur) return amount;
  const rFrom = fromCur === "EUR" ? 1 : rates[fromCur];
  const rTo = toCur === "EUR" ? 1 : rates[toCur];
  if (!rFrom || !rTo) return null;
  return amount * (rTo / rFrom);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  // Samo prijavljen korisnik, i samo za klijenta iz svog radnog prostora
  const ctx = await guard(req, res);
  if (!ctx) return;
  if (!(await clientInWorkspace(req.query.client_id, ctx.membership.workspace_id))) return res.status(404).json({ error: "client_not_found" });

  const { client_id, campaign_id, ad_group_id, days, from, to } = req.query;
  if (!client_id || !campaign_id) return res.status(400).json({ error: "Missing client_id or campaign_id" });
  // ID-jevi i datumi idu direktno u Google Ads upit, zato su dozvoljeni samo brojevi i ispravni datumi
  if (!/^\d{1,20}$/.test(String(campaign_id)) || (ad_group_id && !/^\d{1,20}$/.test(String(ad_group_id)))) return res.status(400).json({ error: "Invalid id" });
  const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
  if ((from || to) && !(DATE_OK.test(from || "") && DATE_OK.test(to || ""))) return res.status(400).json({ error: "Invalid period" });

  let startStr, endStr;
  if (from && to) {
    startStr = from;
    endStr = to;
  } else {
    const periodDays = Math.min(Math.max(parseInt(days) || 30, 1), 730); // 1 dan – 2 godine
    const endDateTmp = new Date();
    endDateTmp.setDate(endDateTmp.getDate() - 1);
    const startDateTmp = new Date();
    startDateTmp.setDate(startDateTmp.getDate() - periodDays);
    startStr = startDateTmp.toISOString().split("T")[0];
    endStr = endDateTmp.toISOString().split("T")[0];
  }

  const supaHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  const meter = newMeter("google-ads-drilldown");
  const limit = createLimiter(process.env.GA4_PARALLEL === "0" ? 1 : 4); // najviše 4 istovremena upita ka GA4
  try {
    const gadsConnR = await fetch(
      `${SUPABASE_URL}/rest/v1/google_ads_connections?client_id=eq.${client_id}&select=customer_id,manager_id,currency_code,refresh_token`,
      { headers: supaHeaders }
    );
    const gadsConnData = await gadsConnR.json();
    if (!gadsConnR.ok || !Array.isArray(gadsConnData)) throw new Error("Baza: " + JSON.stringify(gadsConnData).slice(0, 200));
    if (!gadsConnData.length) return res.status(404).json({ error: "no_gads" });
    const { customer_id, manager_id, currency_code: gadsCurrency, refresh_token: gadsRefreshToken } = gadsConnData[0];

    const ga4ConnR = await fetch(
      `${SUPABASE_URL}/rest/v1/ga4_connections?client_id=eq.${client_id}&select=property_id,refresh_token,currency_code`,
      { headers: supaHeaders }
    );
    const ga4ConnData = await ga4ConnR.json();
    if (!ga4ConnR.ok || !Array.isArray(ga4ConnData)) throw new Error("Baza: " + JSON.stringify(ga4ConnData).slice(0, 200));
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
      // Svi redovi (ranije najviše 500 – kod naloga sa puno ad grupa/oglasa deo prihoda je mogao da fali)
      const ga4Report = await ga4FetchAll(property_id, ga4AccessToken, {
        dateRanges: [{ startDate: startStr, endDate: endStr }],
        dimensions: [{ name: ga4Dimension }],
        metrics: [{ name: "totalRevenue" }, { name: "transactions" }],
        dimensionFilter: { filter: { fieldName: ga4Dimension, inListFilter: { values: ids } } }
      }, { maxRows: 50000, meter, limit });
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
    // Ako kurs fali, iznos ostaje u originalnoj valuti i šalje se upozorenje (ranije je iznos mogao biti prazan, a ROAS 0)
    let fxMissing = false;
    const toEUR = (amount, cur) => {
      if (cur === "EUR") return amount;
      const v = rates ? convert(amount, cur, "EUR", rates) : null;
      if (v == null) { fxMissing = true; return amount; }
      return v;
    };
    items = items.map((i) => {
      const spendEUR = toEUR(i.spend, gadsCurrency || "EUR");
      const revenueEUR = toEUR(i.revenue, ga4Currency || "EUR");
      return { ...i, spendEUR, revenueEUR, roas: spendEUR > 0 ? revenueEUR / spendEUR : 0 };
    });

    items.sort((a, b) => b.spend - a.spend);
    meterDone(meter, { client: Number(client_id), level, items: items.length });

    return res.status(200).json({
      level,
      gadsCurrency: gadsCurrency || "EUR",
      currency: ga4Currency || "EUR",
      showSpendNative,
      showRevenueNative,
      fxMissing,
      items
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
