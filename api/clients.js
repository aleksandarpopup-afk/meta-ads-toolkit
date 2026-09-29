// api/clients.js — klijenti korisnika
// Izmena i brisanje su dozvoljeni samo vlasniku klijenta (user_id). Greske se vise ne prikrivaju.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Tabele sa podacima klijenta koje se brisu pre samog klijenta
const CLIENT_TABLES = ["analyses", "budgets", "ga4_daily_metrics", "google_ads_daily_spend", "ga4_connections", "google_ads_connections"];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const headers = { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  // Da li klijent pripada korisniku
  const owns = async (id, userId) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${id}&user_id=eq.${userId}&select=id`, { headers });
    const d = await r.json();
    return r.ok && Array.isArray(d) && d.length > 0;
  };

  try {
    if (req.method === "PATCH") {
      const id = Number(req.query.id);
      const userId = req.query.user_id;
      const name = (req.body || {}).name;
      if (!Number.isInteger(id) || id <= 0 || !name || !String(name).trim()) return res.status(400).json({ error: "Missing id or name" });
      if (!userId || !UUID_RE.test(userId)) return res.status(400).json({ error: "Missing or invalid user_id" });
      const r = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${id}&user_id=eq.${userId}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ name: String(name).trim() })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(data));
      if (!data.length) return res.status(404).json({ error: "Client not found" });
      return res.status(200).json(data[0]);
    }

    if (req.method === "DELETE") {
      const id = Number(req.query.id);
      const userId = req.query.user_id;
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "No id" });
      if (!userId || !UUID_RE.test(userId)) return res.status(400).json({ error: "Missing or invalid user_id" });
      if (!(await owns(id, userId))) return res.status(404).json({ error: "Client not found" });
      // Prvo podaci klijenta u ostalim tabelama (tabela koja ne postoji se preskace)
      for (const t of CLIENT_TABLES) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/${t}?client_id=eq.${id}`, { method: "DELETE", headers });
        if (!r.ok && r.status !== 404) {
          const txt = await r.text();
          if (!/does not exist|PGRST205|42P01/.test(txt)) throw new Error(`${t}: ${txt}`);
        }
      }
      const r = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${id}&user_id=eq.${userId}`, {
        method: "DELETE",
        headers: { ...headers, Prefer: "return=representation" }
      });
      const data = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(data));
      if (!data.length) return res.status(404).json({ error: "Client not found" });
      return res.status(200).json({ success: true });
    }

    if (req.method === "GET") {
      const { user_id } = req.query;
      if (!user_id) return res.status(400).json({ error: "No user_id" });
      const r = await fetch(`${SUPABASE_URL}/rest/v1/clients?user_id=eq.${user_id}&select=*,analyses(count)&order=created_at.desc`, { headers });
      const data = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(data));
      return res.status(200).json(data);
    }

    if (req.method === "POST") {
      const { user_id } = req.body || {};
      const name = String((req.body || {}).name || "").trim();
      if (!user_id || !name) return res.status(400).json({ error: "Missing fields" });
      // Ako klijent sa istim imenom vec postoji, vraca se postojeci
      const check = await fetch(`${SUPABASE_URL}/rest/v1/clients?user_id=eq.${user_id}&name=eq.${encodeURIComponent(name)}&select=*`, { headers });
      const existing = await check.json();
      if (Array.isArray(existing) && existing.length > 0) return res.status(200).json(existing[0]);
      const r = await fetch(`${SUPABASE_URL}/rest/v1/clients`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ user_id, name })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(data));
      return res.status(200).json(data[0]);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
