// api/analyses.js — istorija analiza klijenta (prikaz u Clients)
// Citanje i brisanje samo za vlasnika (user_id). Filter perioda radi preko preklapanja.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const headers = { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  try {
    const userId = req.method === "POST" ? (req.body || {}).user_id : req.query.user_id;
    if (!userId || !UUID_RE.test(userId)) return res.status(400).json({ error: "Missing or invalid user_id" });

    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id || !/^[0-9a-zA-Z-]+$/.test(String(id))) return res.status(400).json({ error: "No id" });
      const r = await fetch(`${SUPABASE_URL}/rest/v1/analyses?id=eq.${id}&user_id=eq.${userId}`, {
        method: "DELETE",
        headers: { ...headers, Prefer: "return=representation" }
      });
      const data = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(data));
      if (!data.length) return res.status(404).json({ error: "Analysis not found" });
      return res.status(200).json({ success: true });
    }

    if (req.method === "POST") {
      const { client_id, tool, period_from, period_to, analysis_text, metrics } = req.body || {};
      if (!client_id || !analysis_text) return res.status(400).json({ error: "Missing fields" });
      const own = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${client_id}&user_id=eq.${userId}&select=id`, { headers });
      const ownD = await own.json();
      if (!Array.isArray(ownD) || !ownD.length) return res.status(403).json({ error: "Client not found" });
      const r = await fetch(`${SUPABASE_URL}/rest/v1/analyses`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ client_id, user_id: userId, tool, period_from, period_to, analysis_text, metrics })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(data));
      return res.status(200).json(data[0]);
    }

    if (req.method === "GET") {
      const { client_id, from, to, limit } = req.query;
      const cid = Number(client_id);
      if (!Number.isInteger(cid) || cid <= 0) return res.status(400).json({ error: "No client_id" });
      let url = `${SUPABASE_URL}/rest/v1/analyses?client_id=eq.${cid}&user_id=eq.${userId}&order=created_at.desc`;
      // Preklapanje perioda; analiza bez datuma "do" se racuna kao jednodnevna
      if (from && DATE_RE.test(from)) url += `&or=(period_to.gte.${from},and(period_to.is.null,period_from.gte.${from}))`;
      if (to && DATE_RE.test(to)) url += `&period_from=lte.${to}`;
      const lim = parseInt(limit);
      if (lim > 0) url += `&limit=${Math.min(lim, 500)}`;
      const r = await fetch(url, { headers });
      const data = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(data));
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
