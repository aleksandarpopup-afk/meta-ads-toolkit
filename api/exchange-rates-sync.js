const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

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
    const r = await fetch("https://open.er-api.com/v6/latest/EUR");
    const data = await r.json();
    if (data.result !== "success") throw new Error("Exchange rate API error");

    // Čuvamo kao jedan red, uvek prepisujemo (upsert preko id=1)
    await fetch(`${SUPABASE_URL}/rest/v1/exchange_rates?id=eq.1`, {
      method: "DELETE",
      headers
    });
    await fetch(`${SUPABASE_URL}/rest/v1/exchange_rates`, {
      method: "POST",
      headers,
      body: JSON.stringify({ id: 1, base_currency: "EUR", rates: data.rates, updated_at: new Date().toISOString() })
    });

    return res.status(200).json({ success: true, currencies: Object.keys(data.rates).length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
