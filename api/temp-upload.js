const SUPABASE_URL = "https://zlscpdejnkjgcsbohkxy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsc2NwZGVqbmtqZ2NzYm9oa3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMjIwOTUsImV4cCI6MjA5OTY5ODA5NX0.42ccU4Mly6mTVE-sSG1j7-tO5hZaxS5LMxclkv8Oy78";

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
