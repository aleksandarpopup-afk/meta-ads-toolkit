// api/report-google-ads.js — Report Studio: Google Ads izvestaj za klijenta
// Brojevi po kampanjama se uzimaju direktno iz postojeceg /api/campaigns (ista logika kao Campaign Intelligence),
// pa su izvestaj i Campaign Intelligence uvek uskladjeni. Ovde se dodaju: prethodni period i kretanje po danima.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const supaHeaders = () => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` });

const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayDiff = (a, b) => Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);

function convert(amount, from, to, rates) {
  if (from === to) return amount;
  const rf = from === "EUR" ? 1 : rates && rates[from];
  const rt = to === "EUR" ? 1 : rates && rates[to];
  if (!rf || !rt) return null;
  return amount * (rt / rf);
}

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

// Poziv postojeceg /api/campaigns za jedan period
async function campaignsFor(baseUrl, clientId, from, to) {
  const r = await fetch(`${baseUrl}/api/campaigns?client_id=${clientId}&from=${from}&to=${to}`);
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

// Kretanje po danima: potrosnja iz baze (Google Ads) + prihod iz GA4 (isti kanali kao u Campaign Intelligence)
async function dailySeries(clientId, from, to, gadsCurrency, ga4Currency) {
  const h = supaHeaders();
  const spendR = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_budget_gads_daily`, {
    method: "POST",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({ p_client_id: Number(clientId), p_start: from, p_end: to, p_filter: null }),
  });
  const spendRows = await spendR.json();
  if (!spendR.ok) throw new Error(JSON.stringify(spendRows));

  const connR = await fetch(`${SUPABASE_URL}/rest/v1/ga4_connections?client_id=eq.${clientId}&select=property_id,refresh_token`, { headers: h });
  const conn = (await connR.json())[0];
  const token = await refreshAccessToken(conn.refresh_token);
  const gr = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${conn.property_id}:runReport`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      dateRanges: [{ startDate: from, endDate: to }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "totalRevenue" }, { name: "transactions" }],
      dimensionFilter: { filter: { fieldName: "sessionDefaultChannelGroup", inListFilter: { values: ["Paid Search", "Cross-network", "Paid Shopping", "Paid Video"] } } },
      limit: 1000,
    }),
  });
  const ga = await gr.json();
  if (!gr.ok) throw new Error(ga.error?.message || JSON.stringify(ga));

  let rates = null;
  if (gadsCurrency !== "EUR" || ga4Currency !== "EUR") {
    const fx = await fetch(`${SUPABASE_URL}/rest/v1/exchange_rates?id=eq.1&select=rates`, { headers: h });
    const fxd = await fx.json();
    rates = fxd && fxd[0] ? fxd[0].rates : null;
  }
  const spendBy = {};
  (spendRows || []).forEach((r) => { spendBy[String(r.day).slice(0, 10)] = Number(r.spend) || 0; });
  const revBy = {};
  (ga.rows || []).forEach((r) => {
    const d = r.dimensionValues[0].value; // YYYYMMDD
    revBy[`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`] = {
      revenue: parseFloat(r.metricValues[0].value) || 0,
      purchases: parseFloat(r.metricValues[1].value) || 0,
    };
  });
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const s = spendBy[d] || 0;
    const rv = revBy[d] || { revenue: 0, purchases: 0 };
    out.push({
      date: d,
      spendEUR: gadsCurrency === "EUR" ? s : convert(s, gadsCurrency, "EUR", rates),
      revenueEUR: ga4Currency === "EUR" ? rv.revenue : convert(rv.revenue, ga4Currency, "EUR", rates),
      purchases: rv.purchases,
    });
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { client_id, user_id, from, to, compare } = req.query;
  const cid = Number(client_id);
  if (!Number.isInteger(cid) || cid <= 0) return res.status(400).json({ error: "Invalid client_id" });
  if (!user_id || !UUID_RE.test(user_id)) return res.status(400).json({ error: "Invalid user_id" });
  if (!DATE_RE.test(from || "") || !DATE_RE.test(to || "") || to < from) return res.status(400).json({ error: "Invalid period" });
  if (dayDiff(from, to) > 400) return res.status(400).json({ error: "Period too long" });

  try {
    // Klijent mora pripadati korisniku
    const cr = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${cid}&user_id=eq.${user_id}&select=id,name`, { headers: supaHeaders() });
    const client = (await cr.json())[0];
    if (!client) return res.status(404).json({ error: "client_not_found" });

    const proto = req.headers["x-forwarded-proto"] || "https";
    const baseUrl = `${proto}://${req.headers.host}`;
    const len = dayDiff(from, to) + 1;
    const prevTo = addDays(from, -1);
    const prevFrom = addDays(prevTo, -(len - 1));
    const wantCompare = compare !== "0";

    const [cur, prev] = await Promise.all([
      campaignsFor(baseUrl, cid, from, to),
      wantCompare ? campaignsFor(baseUrl, cid, prevFrom, prevTo) : Promise.resolve(null),
    ]);
    if (!cur.ok) {
      const code = cur.data && cur.data.error;
      if (code === "no_gads" || code === "no_ga4") return res.status(404).json({ error: code });
      throw new Error(code || `campaigns ${cur.status}`);
    }

    let daily = null;
    let dailyError = false;
    try {
      daily = await dailySeries(cid, from, to, cur.data.gadsCurrency || "EUR", cur.data.currency || "EUR");
    } catch (e) {
      dailyError = true; // izvestaj radi i bez grafikona
    }

    return res.status(200).json({
      client: { id: client.id, name: client.name },
      period: { from, to, days: len },
      prevPeriod: wantCompare ? { from: prevFrom, to: prevTo } : null,
      current: cur.data,
      previous: prev && prev.ok ? prev.data : null,
      daily,
      dailyError,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
