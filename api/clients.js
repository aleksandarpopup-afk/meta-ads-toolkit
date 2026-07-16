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
    if (req.method === "GET") {
      const { user_id } = req.query;
      if (!user_id) return res.status(400).json({ error: "No user_id" });
      const r = await fetch(`${SUPABASE_URL}/rest/v1/clients?user_id=eq.${user_id}&select=*,analyses(count)&order=created_at.desc`, { headers });
      const data = await r.json();
      return res.status(200).json(data);
    }

    if (req.method === "POST") {
      const { user_id, name } = req.body;
      if (!user_id || !name) return res.status(400).json({ error: "Missing fields" });
      // Check if client already exists
      const check = await fetch(`${SUPABASE_URL}/rest/v1/clients?user_id=eq.${user_id}&name=eq.${encodeURIComponent(name)}&select=*`, { headers });
      const existing = await check.json();
      if (existing.length > 0) return res.status(200).json(existing[0]);
      // Create new
      const r = await fetch(`${SUPABASE_URL}/rest/v1/clients`, {
        method: "POST",
        headers: { ...headers, "Prefer": "return=representation" },
        body: JSON.stringify({ user_id, name })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(data));
      return res.status(200).json(data[0]);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
