import { guard, clientInWorkspace } from "./_lib/auth.js";

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

async function bulkUpsertSpend(rows, headers) {
  if (!rows.length) return;
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/google_ads_daily_spend?on_conflict=client_id,campaign_id,date`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(chunk)
    });
    // Greska pri upisu se vise ne prikriva (ranije je "Gotovo" stizalo i kad upis nije uspeo)
    if (!r.ok) throw new Error(`google_ads_daily_spend: ${await r.text()}`);
  }
}

function dateStr(d) {
  return d.toISOString().split("T")[0];
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  // Samo prijavljen korisnik, i samo za klijenta iz svog radnog prostora
  const ctx = await guard(req, res);
  if (!ctx) return;
  const ws = ctx.membership.workspace_id;
  const clientIdIn = req.method === "POST" ? (req.body || {}).client_id : req.query.client_id;
  if (!(await clientInWorkspace(clientIdIn, ws))) return res.status(404).json({ error: "client_not_found" });

  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`
  };

  try {
    if (req.method === "POST") {
      const { client_id, customer_id, manager_id, account_name, currency_code, refresh_token } = req.body || {};
      const user_id = ws; // vlasnik veze je radni prostor iz prijave, ne vrednost koju posalje pregledac
      if (!client_id || !customer_id || !refresh_token) {
        return res.status(400).json({ error: "Missing fields" });
      }
      // ID-jevi idu u Google Ads adresu - dozvoljeni su samo brojevi
      if (!/^\d{1,20}$/.test(String(customer_id)) || (manager_id && !/^\d{1,20}$/.test(String(manager_id)))) {
        return res.status(400).json({ error: "Invalid customer_id" });
      }

      await fetch(
        `${SUPABASE_URL}/rest/v1/google_ads_connections?client_id=eq.${client_id}`,
        { method: "DELETE", headers }
      );

      const r = await fetch(`${SUPABASE_URL}/rest/v1/google_ads_connections`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ user_id, client_id, customer_id, manager_id, account_name, currency_code, refresh_token })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(data));

      // Jednokratno punjenje poslednjih 90 dana - da klijent odmah ima istoriju, ne čeka da se dnevni sync polako nakupi
      try {
        const accessToken = await refreshAccessToken(refresh_token);
        const endDate = new Date();
        endDate.setDate(endDate.getDate() - 1);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);
        const query = `SELECT campaign.id, campaign.name, segments.date, metrics.cost_micros, metrics.clicks, metrics.impressions FROM campaign WHERE segments.date BETWEEN '${dateStr(startDate)}' AND '${dateStr(endDate)}'`;
        const gadsData = await gadsSearch(customer_id, accessToken, query, manager_id || undefined);

        const rows = (gadsData.results || [])
          .filter((row) => row.campaign?.id && row.segments?.date)
          .map((row) => ({
            client_id,
            date: row.segments.date,
            campaign_id: row.campaign.id,
            campaign_name: row.campaign.name || "",
            spend: (parseInt(row.metrics?.costMicros) || 0) / 1000000,
            clicks: parseInt(row.metrics?.clicks) || 0,
            impressions: parseInt(row.metrics?.impressions) || 0,
            updated_at: new Date().toISOString()
          }));

        await bulkUpsertSpend(rows, headers);
      } catch (e) {
        // Ne blokiramo samo povezivanje ako jednokratno punjenje ne uspe - dnevni sync će ionako nastaviti odatle
      }

      return res.status(200).json(data[0]);
    }

    if (req.method === "GET") {
      const { client_id } = req.query;
      if (!client_id) return res.status(400).json({ error: "No client_id" });
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/google_ads_connections?client_id=eq.${client_id}&select=id,customer_id,manager_id,account_name,currency_code,created_at`,
        { headers }
      );
      const data = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(data));
      return res.status(200).json(data);
    }

    if (req.method === "DELETE") {
      const { client_id } = req.query;
      if (!client_id) return res.status(400).json({ error: "No client_id" });
      await fetch(`${SUPABASE_URL}/rest/v1/google_ads_connections?client_id=eq.${client_id}`, {
        method: "DELETE",
        headers
      });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
