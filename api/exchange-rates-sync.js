// api/exchange-rates-sync.js — dnevno osvežavanje kurseva (EUR -> ostale valute). Pokreće ga samo Vercel cron.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
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
    if (data.result !== "success" || !data.rates || !Object.keys(data.rates).length) {
      throw new Error("Exchange rate API error");
    }

    // Jedan red (id=1) koji se prepisuje u JEDNOM koraku. Ranije se stari red prvo brisao, pa upisivao novi:
    // ako upis ne uspe, aplikacija je ostajala bez ikakvih kurseva.
    const w = await fetch(`${SUPABASE_URL}/rest/v1/exchange_rates?on_conflict=id`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ id: 1, base_currency: "EUR", rates: data.rates, updated_at: new Date().toISOString() })
    });
    if (!w.ok) throw new Error(`exchange_rates: ${await w.text()}`);

    return res.status(200).json({ success: true, currencies: Object.keys(data.rates).length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
