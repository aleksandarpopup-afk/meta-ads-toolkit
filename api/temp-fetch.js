const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "No id provided" });

  try {
    if (req.method === "GET") {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/temp_imports?id=eq.${id}&select=*`, {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`
        }
      });
      const result = await response.json();
      if (!result.length) return res.status(404).json({ error: "Not found" });

      // Delete after reading
      await fetch(`${SUPABASE_URL}/rest/v1/temp_imports?id=eq.${id}`, {
        method: "DELETE",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`
        }
      });

      return res.status(200).json({ data: JSON.parse(result[0].data) });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
