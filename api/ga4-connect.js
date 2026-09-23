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

async function fetchPropertyCurrency(propertyId, accessToken) {
  try {
    const r = await fetch(`https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await r.json();
    return data.currencyCode || "EUR";
  } catch (e) {
    return "EUR";
  }
}

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
      const { user_id, client_id, property_id, property_name, refresh_token } = req.body;
      if (!user_id || !client_id || !property_id || !refresh_token) {
        return res.status(400).json({ error: "Missing fields" });
      }

      // Ako klijent već ima GA4 vezu, obriši staru pre nego što sačuvaš novu
      await fetch(
        `${SUPABASE_URL}/rest/v1/ga4_connections?client_id=eq.${client_id}`,
        { method: "DELETE", headers }
      );

      let currency_code = "EUR";
      try {
        const accessToken = await refreshAccessToken(refresh_token);
        currency_code = await fetchPropertyCurrency(property_id, accessToken);
      } catch (e) {
        // Ako povlačenje valute ne uspe, nastavljamo sa podrazumevanim EUR - ne blokiramo povezivanje zbog ovoga
      }

      const r = await fetch(`${SUPABASE_URL}/rest/v1/ga4_connections`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ user_id, client_id, property_id, property_name, refresh_token, currency_code })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(data));
      return res.status(200).json(data[0]);
    }

    if (req.method === "GET") {
      const { client_id } = req.query;
      if (!client_id) return res.status(400).json({ error: "No client_id" });
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/ga4_connections?client_id=eq.${client_id}&select=id,property_id,property_name,currency_code,created_at`,
        { headers }
      );
      const data = await r.json();
      return res.status(200).json(data);
    }

    if (req.method === "DELETE") {
      const { client_id } = req.query;
      if (!client_id) return res.status(400).json({ error: "No client_id" });
      await fetch(`${SUPABASE_URL}/rest/v1/ga4_connections?client_id=eq.${client_id}`, {
        method: "DELETE",
        headers
      });
      return res.status(200).json({ success: true });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
