// api/search-terms.js — Campaign Intelligence: "Pojmovi pretrage" (korak B)
// Uzivo iz Google Ads (search_term_view: Search i Shopping kampanje) + GA4 prihod po pojmu pretrage.
// Sluzi za kandidate za negativne reci i za prilike (pojmovi koji prodaju, a nisu dodati kao kljucne reci).
// Nista se ne cuva u bazi.

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
  } while (pageToken && all.length < 100000);
  return all;
}

function convert(amount, from, to, rates) {
  if (from === to) return amount;
  const rf = from === "EUR" ? 1 : rates && rates[from];
  const rt = to === "EUR" ? 1 : rates && rates[to];
  if (!rf || !rt) return null;
  return amount * (rt / rf);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { client_id, user_id, days, from, to } = req.query;
  const cid = Number(client_id);
  if (!Number.isInteger(cid) || cid <= 0) return res.status(400).json({ error: "Invalid client_id" });
  if (!user_id || !UUID_RE.test(user_id)) return res.status(400).json({ error: "Invalid user_id" });

  let startStr, endStr;
  if (from && to && DATE_RE.test(from) && DATE_RE.test(to)) { startStr = from; endStr = to; }
  else {
    const n = parseInt(days) || 7;
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

    // Potrosnja po tipu kampanje (koliki deo budzeta pokrivaju pojmovi pretrage)
    const byType = await gadsSearch(gconn.customer_id, gToken,
      `SELECT campaign.advertising_channel_type, metrics.cost_micros FROM campaign WHERE segments.date BETWEEN '${startStr}' AND '${endStr}' AND metrics.cost_micros > 0`, login);
    let totalCost = 0, coveredCost = 0;
    for (const r of byType) {
      const c = (parseInt(r.metrics?.costMicros) || 0) / 1e6;
      const t = r.campaign?.advertisingChannelType;
      totalCost += c;
      if (t === "SEARCH" || t === "SHOPPING") coveredCost += c;
    }

    // Pojmovi pretrage (Search + Shopping). status: ADDED = vec kljucna rec, EXCLUDED = vec negativna
    const rows = await gadsSearch(gconn.customer_id, gToken,
      `SELECT search_term_view.search_term, search_term_view.status, campaign.id, campaign.name, campaign.advertising_channel_type, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value FROM search_term_view WHERE segments.date BETWEEN '${startStr}' AND '${endStr}' AND metrics.impressions > 0`, login);
    const terms = {};
    for (const r of rows) {
      const text = String(r.searchTermView?.searchTerm || "").trim();
      if (!text) continue;
      const key = text.toLowerCase();
      const t = terms[key] || (terms[key] = { text, cost: 0, clicks: 0, impressions: 0, adsConversions: 0, adsConvValue: 0, statuses: new Set(), campaigns: {}, types: new Set() });
      const c = (parseInt(r.metrics?.costMicros) || 0) / 1e6;
      t.cost += c;
      t.clicks += parseInt(r.metrics?.clicks) || 0;
      t.impressions += parseInt(r.metrics?.impressions) || 0;
      t.adsConversions += parseFloat(r.metrics?.conversions) || 0;
      t.adsConvValue += parseFloat(r.metrics?.conversionsValue) || 0;
      if (r.searchTermView?.status) t.statuses.add(r.searchTermView.status);
      const cn = r.campaign?.name || "";
      t.campaigns[cn] = (t.campaigns[cn] || 0) + c;
      if (r.campaign?.advertisingChannelType) t.types.add(r.campaign.advertisingChannelType);
    }

    // GA4 prihod po pojmu pretrage (ako je GA4 povezan)
    let ga4 = false, ga4Currency = "EUR", ga4Error = null;
    const revByTerm = {};
    const ar = await fetch(`${SUPABASE_URL}/rest/v1/ga4_connections?client_id=eq.${cid}&select=property_id,refresh_token,currency_code`, { headers: h });
    const aconn = (await ar.json())[0];
    if (aconn) {
      try {
        ga4Currency = aconn.currency_code || "EUR";
        const aToken = await refreshAccessToken(aconn.refresh_token);
        let offset = 0;
        while (offset < 100000) {
          const rr = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${aconn.property_id}:runReport`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${aToken}` },
            body: JSON.stringify({
              dateRanges: [{ startDate: startStr, endDate: endStr }],
              dimensions: [{ name: "sessionGoogleAdsQuery" }],
              metrics: [{ name: "totalRevenue" }, { name: "transactions" }],
              dimensionFilter: { filter: { fieldName: "sessionDefaultChannelGroup", inListFilter: { values: ["Paid Search", "Cross-network", "Paid Shopping", "Paid Video"] } } },
              limit: 10000, offset,
            }),
          });
          const d = await rr.json();
          if (!rr.ok) throw new Error(d.error?.message || JSON.stringify(d));
          for (const row of d.rows || []) {
            const key = String(row.dimensionValues[0].value).toLowerCase().trim();
            const cur = revByTerm[key] || (revByTerm[key] = { revenue: 0, purchases: 0 });
            cur.revenue += parseFloat(row.metricValues[0].value) || 0;
            cur.purchases += parseFloat(row.metricValues[1].value) || 0;
          }
          offset += 10000;
          if (!d.rows || d.rows.length < 10000 || offset >= (d.rowCount || 0)) break;
        }
        ga4 = true;
      } catch (e) {
        ga4Error = String(e.message).includes("invalid_grant") ? "expired" : "failed";
      }
    }

    let rates = null;
    if (gadsCurrency !== "EUR" || ga4Currency !== "EUR") {
      const fx = await fetch(`${SUPABASE_URL}/rest/v1/exchange_rates?id=eq.1&select=rates`, { headers: h });
      const fxd = await fx.json();
      rates = fxd && fxd[0] ? fxd[0].rates : null;
    }
    let fxMissing = false;
    const toEUR = (amt, cur) => { if (cur === "EUR") return amt; const v = convert(amt, cur, "EUR", rates); if (v == null) { fxMissing = true; return amt; } return v; };

    let out = Object.entries(terms).map(([key, t]) => {
      const g = revByTerm[key];
      const spendEUR = toEUR(t.cost, gadsCurrency);
      const revEUR = g ? toEUR(g.revenue, ga4Currency) : 0;
      const st = t.statuses;
      const camps = Object.entries(t.campaigns).sort((a, b) => b[1] - a[1]).map(([n]) => n);
      return {
        text: t.text,
        isKeyword: st.has("ADDED") || st.has("ADDED_EXCLUDED"),
        isExcluded: st.has("EXCLUDED") || st.has("ADDED_EXCLUDED"),
        campaigns: camps.slice(0, 5), campaignCount: camps.length,
        shopping: t.types.has("SHOPPING"),
        spendEUR, clicks: t.clicks, impressions: t.impressions,
        adsConversions: t.adsConversions, adsConvValueEUR: toEUR(t.adsConvValue, gadsCurrency),
        ga4RevenueEUR: revEUR, ga4Purchases: g ? g.purchases : 0,
        roas: spendEUR > 0 && ga4 ? revEUR / spendEUR : null,
      };
    });
    // Odgovor ne sme biti prevelik: svi pojmovi sa kupovinom + do 8.000 najskupljih
    const withSales = out.filter((t) => t.ga4Purchases > 0 || t.adsConversions > 0);
    const rest = out.filter((t) => !(t.ga4Purchases > 0 || t.adsConversions > 0)).sort((a, b) => b.spendEUR - a.spendEUR);
    const truncated = rest.length > 8000;
    out = withSales.concat(rest.slice(0, 8000)).sort((a, b) => b.spendEUR - a.spendEUR);

    return res.status(200).json({
      period: { from: startStr, to: endStr },
      ga4, ga4Error, fxMissing, truncated,
      totals: {
        accountSpendEUR: toEUR(totalCost, gadsCurrency),
        coveredSpendEUR: toEUR(coveredCost, gadsCurrency),
        termSpendEUR: Object.values(terms).reduce((s, t) => s + toEUR(t.cost, gadsCurrency), 0),
        termCount: Object.keys(terms).length,
      },
      terms: out,
    });
  } catch (err) {
    if (String(err.message).includes("invalid_grant")) return res.status(401).json({ error: "expired" });
    return res.status(500).json({ error: err.message });
  }
}
