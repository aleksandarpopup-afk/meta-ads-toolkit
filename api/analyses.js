const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const headers = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`
  };

  try {
    if (req.method === "POST") {
      const { client_id, user_id, tool, period_from, period_to, analysis_text, metrics } = req.body;
      if (!client_id || !user_id || !analysis_text) return res.status(400).json({ error: "Missing fields" });
      const r = await fetch(`${SUPABASE_URL}/rest/v1/analyses`, {
        method: "POST",
        headers: { ...headers, "Prefer": "return=representation" },
        body: JSON.stringify({ client_id, user_id, tool, period_from, period_to, analysis_text, metrics })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(data));
      return res.status(200).json(data[0]);
    }

    if (req.method === "GET") {
      const { client_id, from, to, limit } = req.query;
      if (!client_id) return res.status(400).json({ error: "No client_id" });
      let url = `${SUPABASE_URL}/rest/v1/analyses?client_id=eq.${client_id}&order=created_at.desc`;
      if (from) url += `&period_from=gte.${from}`;
      if (to) url += `&period_to=lte.${to}`;
      if (limit) url += `&limit=${limit}`;
      const r = await fetch(url, { headers });
      const data = await r.json();
      return res.status(200).json(data);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
