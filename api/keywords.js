// api/keywords.js — Campaign Intelligence: "Ključne reči" (korak A)
// Uzivo iz Google Ads (keyword_view) + GA4 prihod po kljucnoj reci. Nista se ne cuva u bazi.
// Kljucne reci postoje samo u Search kampanjama, zato se vraca i udeo Search potrosnje u ukupnoj.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GADS_VERSION = "v25";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function refreshAccessToken(refresh_token) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, grant_type: "refresh_token" }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data));
  return data.access_token;
}

// Google Ads pretraga sa stranicenjem (isti obrazac kao google-ads-sync.js)
async function gadsSearch(customerId, accessToken, query, loginCustomerId) {
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;
  let all = [], pageToken;
  do {
    const body = { query };
    if (pageToken) body.pageToken = pageToken;
    const r = await fetch(`https://googleads.googleapis.com/${GADS_VERSION}/customers/${customerId}/googleAds:search`, { method: "POST", headers, body: JSON.stringify(body) });
    const data = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(data));
    all = all.concat(data.results || []);
    pageToken = data.nextPageToken;
  } while (pageToken && all.length < 50000);
  return all;
}

function convert(amount, from, to, rates) {
  if (from === to) return amount;
  const rf = from === "EUR" ? 1 : rates && rates[from];
  const rt = to === "EUR" ? 1 : rates && rates[to];
  if (!rf || !rt) return null;
  return amount * (rt / rf);
}

const MATCH = { EXACT: "exact", PHRASE: "phrase", BROAD: "broad" };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { client_id, user_id, days, from, to } = req.query;
  const cid = Number(client_id);
  if (!Number.isInteger(cid) || cid <= 0) return res.status(400).json({ error: "Invalid client_id" });
  if (!user_id || !UUID_RE.test(user_id)) return res.status(400).json({ error: "Invalid user_id" });

  // Period: isto kao /api/campaigns (days=N zakljucno sa jucerasnjim danom, ili from/to)
  let startStr, endStr;
  if (from && to && DATE_RE.test(from) && DATE_RE.test(to)) { startStr = from; endStr = to; }
  else {
    const n = parseInt(days) || 30;
    const e = new Date(); e.setDate(e.getDate() - 1);
    const s = new Date(); s.setDate(s.getDate() - n);
    startStr = s.toISOString().split("T")[0]; endStr = e.toISOString().split("T")[0];
  }

  const h = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
  try {
    const cr = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${cid}&user_id=eq.${user_id}&select=id`, { headers: h });
    if (!(await cr.json())[0]) return res.status(404).json({ error: "client_not_found" });

    const gr = await fetch(`${SUPABASE_URL}/rest/v1/google_ads_connections?client_id=eq.${cid}&select=customer_id,manager_id,refresh_token,currency_code&order=updated_at.desc`, { headers: h });
    const gconn = (await gr.json())[0];
    if (!gconn) return res.status(404).json({ error: "no_gads" });
    const gadsCurrency = gconn.currency_code || "EUR";
    const gToken = await refreshAccessToken(gconn.refresh_token);
    const login = gconn.manager_id || undefined;

    // 1) Potrosnja po tipu kampanje (koliki deo budzeta uopste ima kljucne reci)
    const byType = await gadsSearch(gconn.customer_id, gToken,
      `SELECT campaign.advertising_channel_type, metrics.cost_micros FROM campaign WHERE segments.date BETWEEN '${startStr}' AND '${endStr}' AND metrics.cost_micros > 0`, login);
    let totalCost = 0, searchCost = 0;
    const costByType = {};
    for (const r of byType) {
      const c = (parseInt(r.metrics?.costMicros) || 0) / 1e6;
      const t = r.campaign?.advertisingChannelType || "UNKNOWN";
      totalCost += c; costByType[t] = (costByType[t] || 0) + c;
      if (t === "SEARCH") searchCost += c;
    }

    // 2) Kljucne reci
    const kwRows = await gadsSearch(gconn.customer_id, gToken,
      `SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, ad_group_criterion.criterion_id, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value FROM keyword_view WHERE segments.date BETWEEN '${startStr}' AND '${endStr}' AND metrics.impressions > 0`, login);
    const kwMap = {};
    for (const r of kwRows) {
      const key = `${r.adGroup?.id}|${r.adGroupCriterion?.criterionId}`;
      const k = kwMap[key] || (kwMap[key] = {
        campaignId: String(r.campaign?.id || ""), campaignName: r.campaign?.name || "",
        adGroupId: String(r.adGroup?.id || ""), adGroupName: r.adGroup?.name || "",
        text: r.adGroupCriterion?.keyword?.text || "", matchType: MATCH[r.adGroupCriterion?.keyword?.matchType] || "other",
        status: r.adGroupCriterion?.status || "", cost: 0, clicks: 0, impressions: 0, adsConversions: 0, adsConvValue: 0,
      });
      k.cost += (parseInt(r.metrics?.costMicros) || 0) / 1e6;
      k.clicks += parseInt(r.metrics?.clicks) || 0;
      k.impressions += parseInt(r.metrics?.impressions) || 0;
      k.adsConversions += parseFloat(r.metrics?.conversions) || 0;
      k.adsConvValue += parseFloat(r.metrics?.conversionsValue) || 0;
    }
    const keywords = Object.values(kwMap);

    // 3) GA4 prihod po kljucnoj reci (kampanja + tekst kljucne reci). Ako GA4 nije povezan, samo Google Ads podaci.
    let ga4 = false, ga4Currency = "EUR", ga4Error = null;
    const revByKey = {};
    const ar = await fetch(`${SUPABASE_URL}/rest/v1/ga4_connections?client_id=eq.${cid}&select=property_id,refresh_token,currency_code`, { headers: h });
    const aconn = (await ar.json())[0];
    if (aconn) {
      try {
        ga4Currency = aconn.currency_code || "EUR";
        const aToken = await refreshAccessToken(aconn.refresh_token);
        let offset = 0;
        while (offset < 50000) {
          const rr = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${aconn.property_id}:runReport`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${aToken}` },
            body: JSON.stringify({
              dateRanges: [{ startDate: startStr, endDate: endStr }],
              dimensions: [{ name: "sessionGoogleAdsCampaignId" }, { name: "sessionGoogleAdsKeyword" }],
              metrics: [{ name: "totalRevenue" }, { name: "transactions" }],
              dimensionFilter: { filter: { fieldName: "sessionDefaultChannelGroup", inListFilter: { values: ["Paid Search", "Cross-network", "Paid Shopping", "Paid Video"] } } },
              limit: 10000, offset,
            }),
          });
          const d = await rr.json();
          if (!rr.ok) throw new Error(d.error?.message || JSON.stringify(d));
          for (const row of d.rows || []) {
            const key = `${row.dimensionValues[0].value}|${String(row.dimensionValues[1].value).toLowerCase().trim()}`;
            const cur = revByKey[key] || (revByKey[key] = { revenue: 0, purchases: 0 });
            cur.revenue += parseFloat(row.metricValues[0].value) || 0;
            cur.purchases += parseFloat(row.metricValues[1].value) || 0;
          }
          offset += 10000;
          if (!d.rows || d.rows.length < 10000 || offset >= (d.rowCount || 0)) break;
        }
        ga4 = true;
      } catch (e) {
        if (String(e.message).includes("invalid_grant")) ga4Error = "expired";
        else ga4Error = "failed";
      }
    }

    // Kursevi (EUR je glavna valuta)
    let rates = null;
    if (gadsCurrency !== "EUR" || ga4Currency !== "EUR") {
      const fx = await fetch(`${SUPABASE_URL}/rest/v1/exchange_rates?id=eq.1&select=rates`, { headers: h });
      const fxd = await fx.json();
      rates = fxd && fxd[0] ? fxd[0].rates : null;
    }
    let fxMissing = false;
    const toEUR = (amt, cur) => { if (cur === "EUR") return amt; const v = convert(amt, cur, "EUR", rates); if (v == null) { fxMissing = true; return amt; } return v; };

    // GA4 zna samo tekst kljucne reci (ne i ad grupu/tip meca): prihod iste reci u istoj kampanji
    // deli se na njene ad grupe srazmerno klikovima (priblizno).
    const groups = {};
    keywords.forEach((k) => { const key = `${k.campaignId}|${k.text.toLowerCase().trim()}`; (groups[key] || (groups[key] = [])).push(k); });
    const matchedKeys = new Set();
    for (const [key, list] of Object.entries(groups)) {
      const g = revByKey[key];
      const clicks = list.reduce((s, k) => s + k.clicks, 0);
      list.forEach((k) => {
        const share = g ? (clicks > 0 ? k.clicks / clicks : 1 / list.length) : 0;
        k.ga4Revenue = g ? g.revenue * share : 0;
        k.ga4Purchases = g ? g.purchases * share : 0;
        k.shared = list.length > 1;
      });
      if (g) matchedKeys.add(key);
    }

    const out = keywords.map((k) => {
      const spendEUR = toEUR(k.cost, gadsCurrency);
      const revEUR = toEUR(k.ga4Revenue || 0, ga4Currency);
      return {
        campaignId: k.campaignId, campaignName: k.campaignName, adGroupName: k.adGroupName,
        text: k.text, matchType: k.matchType, status: k.status,
        spendEUR, spend: k.cost, clicks: k.clicks, impressions: k.impressions,
        cpcEUR: k.clicks > 0 ? spendEUR / k.clicks : null,
        ctr: k.impressions > 0 ? k.clicks / k.impressions : null,
        adsConversions: k.adsConversions, adsConvValueEUR: toEUR(k.adsConvValue, gadsCurrency),
        ga4RevenueEUR: revEUR, ga4Purchases: k.ga4Purchases || 0,
        roas: spendEUR > 0 && ga4 ? revEUR / spendEUR : null,
        shared: !!k.shared,
      };
    }).sort((a, b) => b.spendEUR - a.spendEUR);

    const kwSpend = out.reduce((s, k) => s + k.spendEUR, 0);
    const kwRev = out.reduce((s, k) => s + k.ga4RevenueEUR, 0);
    return res.status(200).json({
      period: { from: startStr, to: endStr },
      gadsCurrency, ga4Currency, ga4, ga4Error, fxMissing,
      totals: {
        accountSpendEUR: toEUR(totalCost, gadsCurrency),
        searchSpendEUR: toEUR(searchCost, gadsCurrency),
        keywordSpendEUR: kwSpend,
        keywordRevenueEUR: kwRev,
        keywordRoas: kwSpend > 0 && ga4 ? kwRev / kwSpend : null,
        keywordPurchases: out.reduce((s, k) => s + k.ga4Purchases, 0),
        adsConversions: out.reduce((s, k) => s + k.adsConversions, 0),
        spendByType: Object.fromEntries(Object.entries(costByType).map(([t, c]) => [t, toEUR(c, gadsCurrency)])),
      },
      keywords: out,
    });
  } catch (err) {
    if (String(err.message).includes("invalid_grant")) return res.status(401).json({ error: "expired" });
    return res.status(500).json({ error: err.message });
  }
}
