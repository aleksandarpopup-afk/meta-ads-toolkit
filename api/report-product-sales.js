// api/report-product-sales.js — Report Studio: "Prodaja po kampanjama"
// Uzivo iz GA4: svaki prodat proizvod × kampanja sesije (svi izvori: Meta, Google, organski, direktno...),
// sa brojem kupljenih komada i prihodom. Isto kao GA4 "Free form" izvestaj koji kolege koriste za sastanke.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const supaHeaders = () => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` });

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

// Vrsta izvora iz izvora/medijuma sesije i naziva kampanje
function sourceType(campaign, sourceMedium) {
  const c = String(campaign || "").toLowerCase();
  const sm = String(sourceMedium || "").toLowerCase();
  const [src = "", med = ""] = sm.split(" / ").map((x) => x.trim());
  if (c === "(organic)" || med === "organic") return "organic";
  if (c === "(direct)" || src === "(direct)") return "direct";
  if (/facebook|instagram|\bfb\b|\big\b|meta/.test(src)) return "meta";
  if (src === "google" && /cpc|ppc|paid/.test(med)) return "google";
  if (/cpc|ppc|paid|display|cpm|retarget|affiliate/.test(med) || /rtbhouse|criteo|tiktok|bing/.test(src)) return "paid_other";
  if (c === "(referral)" || med === "referral") return "referral";
  return "other";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { client_id, user_id, from, to } = req.query;
  const cid = Number(client_id);
  if (!Number.isInteger(cid) || cid <= 0) return res.status(400).json({ error: "Invalid client_id" });
  if (!user_id || !UUID_RE.test(user_id)) return res.status(400).json({ error: "Invalid user_id" });
  if (!DATE_RE.test(from || "") || !DATE_RE.test(to || "") || to < from) return res.status(400).json({ error: "Invalid period" });

  try {
    const h = supaHeaders();
    const cr = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${cid}&user_id=eq.${user_id}&select=id,name`, { headers: h });
    const client = (await cr.json())[0];
    if (!client) return res.status(404).json({ error: "client_not_found" });

    const gr = await fetch(`${SUPABASE_URL}/rest/v1/ga4_connections?client_id=eq.${cid}&select=property_id,refresh_token,currency_code`, { headers: h });
    const conn = (await gr.json())[0];
    if (!conn) return res.status(404).json({ error: "no_ga4" });
    const currency = conn.currency_code || "EUR";
    const token = await refreshAccessToken(conn.refresh_token);

    // Stranicenje: GA4 vraca najvise 10.000 redova po pozivu
    const rows = [];
    const PAGE = 10000, MAX = 60000;
    let offset = 0, total = null;
    while (offset < MAX) {
      const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${conn.property_id}:runReport`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          dateRanges: [{ startDate: from, endDate: to }],
          dimensions: [{ name: "itemId" }, { name: "itemName" }, { name: "itemCategory" }, { name: "sessionCampaignName" }, { name: "sessionSourceMedium" }],
          metrics: [{ name: "itemsPurchased" }, { name: "itemRevenue" }],
          metricFilter: { filter: { fieldName: "itemsPurchased", numericFilter: { operation: "GREATER_THAN", value: { int64Value: "0" } } } },
          orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }],
          limit: PAGE,
          offset,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || JSON.stringify(d));
      total = d.rowCount || 0;
      for (const row of d.rows || []) {
        const v = row.dimensionValues.map((x) => x.value);
        rows.push({
          itemId: v[0], itemName: v[1], category: v[2], campaign: v[3], sourceMedium: v[4],
          type: sourceType(v[3], v[4]),
          qty: parseInt(row.metricValues[0].value) || 0,
          revenue: parseFloat(row.metricValues[1].value) || 0,
        });
      }
      offset += PAGE;
      if (!d.rows || d.rows.length < PAGE || offset >= total) break;
    }

    // Kurs za prikaz u EUR (opciono u aplikaciji)
    let eurRate = currency === "EUR" ? 1 : null;
    let rateDate = null;
    if (currency !== "EUR") {
      const fx = await fetch(`${SUPABASE_URL}/rest/v1/exchange_rates?id=eq.1&select=rates,updated_at`, { headers: h });
      const fxd = await fx.json();
      if (fxd && fxd[0] && fxd[0].rates && fxd[0].rates[currency]) { eurRate = 1 / fxd[0].rates[currency]; rateDate = fxd[0].updated_at; }
    }

    return res.status(200).json({
      client: { id: client.id, name: client.name },
      period: { from, to },
      currency, eurRate, rateDate,
      truncated: total != null && total > rows.length,
      rows,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
