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

function formatGA4Date(raw) {
  // GA4 vraća datum kao YYYYMMDD, mi ga pretvaramo u YYYY-MM-DD
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

async function fetchGA4Report(propertyId, accessToken) {
  const r = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        // Poslednja 3 dana - hvata i eventualne dopune GA4 podataka koje kasne
        dateRanges: [{ startDate: "3daysAgo", endDate: "yesterday" }],
        dimensions: [{ name: "date" }],
        metrics: [
          { name: "totalRevenue" },
          { name: "conversions" },
          { name: "sessions" }
        ],
        // Sloj 1: default filter - Paid Social kanal (hvata Meta/FB/IG automatski)
        dimensionFilter: {
          filter: {
            fieldName: "sessionDefaultChannelGroup",
            stringFilter: { matchType: "EXACT", value: "Paid Social" }
          }
        }
      })
    }
  );
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data));

  return (data.rows || []).map((row) => ({
    date: formatGA4Date(row.dimensionValues[0].value),
    revenue: parseFloat(row.metricValues[0].value) || 0,
    conversions: parseFloat(row.metricValues[1].value) || 0,
    sessions: parseInt(row.metricValues[2].value) || 0
  }));
}

async function upsertMetric(client_id, row, headers) {
  await fetch(
    `${SUPABASE_URL}/rest/v1/ga4_daily_metrics?on_conflict=client_id,date`,
    {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        client_id,
        date: row.date,
        revenue: row.revenue,
        conversions: row.conversions,
        sessions: row.sessions,
        updated_at: new Date().toISOString()
      })
    }
  );
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
    const connR = await fetch(`${SUPABASE_URL}/rest/v1/ga4_connections?select=*`, { headers });
    const connections = await connR.json();
    if (!connR.ok) throw new Error(JSON.stringify(connections));

    let synced = 0;
    const errors = [];

    for (const conn of connections) {
      try {
        const accessToken = await refreshAccessToken(conn.refresh_token);
        const rows = await fetchGA4Report(conn.property_id, accessToken);
        for (const row of rows) {
          await upsertMetric(conn.client_id, row, headers);
        }
        synced++;
      } catch (e) {
        errors.push({ client_id: conn.client_id, error: e.message });
      }
    }

    return res.status(200).json({
      success: true,
      synced,
      failed: errors.length,
      total: connections.length,
      errors
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
