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

async function bulkUpsertSpend(rows, headers) {
  if (!rows.length) return;
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await fetch(`${SUPABASE_URL}/rest/v1/google_ads_daily_spend?on_conflict=client_id,campaign_id,date`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(chunk)
    });
  }
}

function dateStr(d) {
  return d.toISOString().split("T")[0];
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`
  };

  try {
    const connR = await fetch(`${SUPABASE_URL}/rest/v1/google_ads_connections?select=*`, { headers });
    const connections = await connR.json();
    if (!connR.ok) throw new Error(JSON.stringify(connections));

    // Poslednja 3 dana - hvata i eventualne dopune/korekcije podataka koje Google Ads kasnije unese
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() - 1);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 3);
    const startStr = dateStr(startDate);
    const endStr = dateStr(endDate);

    let synced = 0;
    const errors = [];

    for (const conn of connections) {
      try {
        const accessToken = await refreshAccessToken(conn.refresh_token);
        const query = `SELECT campaign.id, campaign.name, segments.date, metrics.cost_micros, metrics.clicks, metrics.impressions FROM campaign WHERE segments.date BETWEEN '${startStr}' AND '${endStr}'`;
        const data = await gadsSearch(conn.customer_id, accessToken, query, conn.manager_id || undefined);

        const rows = (data.results || [])
          .filter((row) => row.campaign?.id && row.segments?.date)
          .map((row) => ({
            client_id: conn.client_id,
            date: row.segments.date,
            campaign_id: row.campaign.id,
            campaign_name: row.campaign.name || "",
            spend: (parseInt(row.metrics?.costMicros) || 0) / 1000000,
            clicks: parseInt(row.metrics?.clicks) || 0,
            impressions: parseInt(row.metrics?.impressions) || 0,
            updated_at: new Date().toISOString()
          }));

        await bulkUpsertSpend(rows, headers);
        synced++;
      } catch (e) {
        errors.push({ client_id: conn.client_id, error: e.message });
      }
    }

    return res.status(200).json({ success: true, synced, failed: errors.length, total: connections.length, errors });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
