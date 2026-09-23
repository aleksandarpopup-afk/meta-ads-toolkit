const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`
  };

  try {
    if (req.method === "POST") {
      const { user_id, client_id, customer_id, manager_id, account_name, currency_code, refresh_token } = req.body;
      if (!user_id || !client_id || !customer_id || !refresh_token) {
        return res.status(400).json({ error: "Missing fields" });
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
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
