// api/google-ads-sync.js — jutarnja sinhronizacija Google Ads potrošnje (poslednja 3 dana) za SVE povezane klijente.
// Pokreće ga Vercel cron (vercel.json), zaštićen tajnim ključem CRON_SECRET.
// Stabilnost za mnogo klijenata:
// - Klijenti se obrađuju po 5 istovremeno (ranije jedan po jedan) – 100 klijenata za ~30-60 s umesto nekoliko minuta.
// - Ako više klijenata koristi isti Google nalog, pristupni ključ se osvežava samo jednom.
// - Svaki poziv ka Google-u/bazi ima rok od 30 s, da jedan "zaglavljen" klijent ne zaustavi ostale.
// - Ako se približi vremensko ograničenje servera, novi klijenti se ne započinju, a u logu piše koliko je ostalo.
// - Rezultat se upisuje i u log ([sync] red), da se greške (npr. istekla veza) vide u Vercel logovima.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GADS_VERSION = "v25";

const CONCURRENCY = 5;          // koliko klijenata istovremeno
const TIME_BUDGET_MS = 240000;  // posle 4 min ne započinji nove klijente (server dozvoljava 5 min)
const REQ_TIMEOUT_MS = 30000;   // rok za jedan poziv

const tfetch = (url, opts = {}) => fetch(url, { ...opts, signal: AbortSignal.timeout(REQ_TIMEOUT_MS) });

async function refreshAccessToken(refresh_token) {
  const r = await tfetch("https://oauth2.googleapis.com/token", {
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
    const r = await tfetch(`https://googleads.googleapis.com/${GADS_VERSION}/customers/${customerId}/googleAds:search`, {
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
    const r = await tfetch(`${SUPABASE_URL}/rest/v1/google_ads_daily_spend?on_conflict=client_id,campaign_id,date`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(chunk)
    });
    if (!r.ok) throw new Error(`Upsert failed: ${r.status} ${await r.text()}`);
  }
}

function dateStr(d) {
  return d.toISOString().split("T")[0];
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const t0 = Date.now();

  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`
  };

  try {
    const connR = await tfetch(`${SUPABASE_URL}/rest/v1/google_ads_connections?select=*`, { headers });
    const connections = await connR.json();
    if (!connR.ok || !Array.isArray(connections)) throw new Error(JSON.stringify(connections));

    // Poslednja 3 dana - hvata i eventualne dopune/korekcije podataka koje Google Ads kasnije unese
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() - 1);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 3);
    const startStr = dateStr(startDate);
    const endStr = dateStr(endDate);
    const query = `SELECT campaign.id, campaign.name, segments.date, metrics.cost_micros, metrics.clicks, metrics.impressions FROM campaign WHERE segments.date BETWEEN '${startStr}' AND '${endStr}'`;

    // Isti Google nalog -> jedno osvežavanje ključa za sve njegove klijente
    const tokenCache = new Map();
    const getToken = (rt) => {
      if (!tokenCache.has(rt)) tokenCache.set(rt, refreshAccessToken(rt));
      return tokenCache.get(rt);
    };

    let synced = 0;
    let skipped = 0;
    const errors = [];

    const syncOne = async (conn) => {
      try {
        const accessToken = await getToken(conn.refresh_token);
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
        // Oznaka uspešnog sync-a (koristi Budget Pacing i jutarnja upozorenja da znaju da su podaci sveži)
        await tfetch(`${SUPABASE_URL}/rest/v1/google_ads_connections?id=eq.${conn.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ last_synced_at: new Date().toISOString() })
        }).catch(() => {});
        synced++;
      } catch (e) {
        errors.push({ client_id: conn.client_id, error: String(e.message || e).slice(0, 300) });
      }
    };

    // Red čekanja: 5 "radnika" uzimaju sledećeg klijenta dok ih ima (i dok ima vremena)
    const queue = [...connections];
    const worker = async () => {
      while (queue.length) {
        if (Date.now() - t0 > TIME_BUDGET_MS) { skipped = queue.length; queue.length = 0; break; }
        await syncOne(queue.shift());
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, connections.length) }, worker));

    const out = { success: true, synced, failed: errors.length, skipped, total: connections.length, ms: Date.now() - t0, errors };
    console.log(`[sync] google-ads ${JSON.stringify(out)}`);
    return res.status(200).json(out);
  } catch (err) {
    console.error(`[sync] google-ads FAILED ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}
