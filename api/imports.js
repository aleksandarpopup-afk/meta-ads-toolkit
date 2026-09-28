// api/imports.js — Report Studio: uvozi iz screenshota ili fajla
// Cuvaju se u postojecoj tabeli "analyses" sa tool = "import".
// metrics = { source } (Meta, Google Ads, GA4, Looker, Ostalo). Svaki uvoz ima obavezan period od–do.
// Sve operacije su ogranicene na user_id.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOURCES = ["meta", "google_ads", "ga4", "looker", "other"];

async function sb(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, ...(opts.headers || {}) },
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!r.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return data;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const userId = req.method === "POST" ? (req.body || {}).user_id : req.query.user_id;
    if (!userId || !UUID_RE.test(userId)) return res.status(400).json({ error: "Missing or invalid user_id" });

    // GET: uvozi klijenta ciji se period preklapa sa from–to
    if (req.method === "GET") {
      const cid = Number(req.query.client_id);
      const { from, to } = req.query;
      if (!Number.isInteger(cid) || cid <= 0) return res.status(400).json({ error: "Invalid client_id" });
      if (!DATE_RE.test(from || "") || !DATE_RE.test(to || "")) return res.status(400).json({ error: "Missing from/to" });
      const rows = await sb(
        `analyses?client_id=eq.${cid}&user_id=eq.${userId}&tool=eq.import` +
        `&period_from=lte.${to}&period_to=gte.${from}` +
        `&select=id,period_from,period_to,analysis_text,metrics,created_at&order=period_from.asc,created_at.asc&limit=200`
      );
      return res.status(200).json(Array.isArray(rows) ? rows : []);
    }

    // POST: novi uvoz (klijent mora pripadati korisniku)
    if (req.method === "POST") {
      const { client_id, period_from, period_to, source, analysis_text } = req.body || {};
      const cid = Number(client_id);
      if (!Number.isInteger(cid) || cid <= 0) return res.status(400).json({ error: "Invalid client_id" });
      if (!DATE_RE.test(period_from || "") || !DATE_RE.test(period_to || "") || period_to < period_from) {
        return res.status(400).json({ error: "Invalid period" });
      }
      if (!SOURCES.includes(source)) return res.status(400).json({ error: "Invalid source" });
      if (!analysis_text || typeof analysis_text !== "string") return res.status(400).json({ error: "Missing analysis" });
      const owned = await sb(`clients?id=eq.${cid}&user_id=eq.${userId}&select=id`);
      if (!owned || !owned.length) return res.status(403).json({ error: "Client not found" });
      const rows = await sb("analyses", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          client_id: cid, user_id: userId, tool: "import",
          period_from, period_to,
          analysis_text: analysis_text.slice(0, 60000),
          metrics: { source },
        }),
      });
      return res.status(200).json(rows[0]);
    }

    // DELETE: brisanje uvoza
    if (req.method === "DELETE") {
      const id = req.query.id;
      if (!id || !/^[0-9a-zA-Z-]+$/.test(String(id))) return res.status(400).json({ error: "Invalid id" });
      const rows = await sb(`analyses?id=eq.${id}&user_id=eq.${userId}&tool=eq.import`, {
        method: "DELETE",
        headers: { Prefer: "return=representation" },
      });
      if (!rows || !rows.length) return res.status(404).json({ error: "Import not found" });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
