const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: "No data provided" });

    const expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const response = await fetch(`${SUPABASE_URL}/rest/v1/temp_imports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify({ data: JSON.stringify(data), expires_at })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(result));

    return res.status(200).json({ id: result[0].id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
