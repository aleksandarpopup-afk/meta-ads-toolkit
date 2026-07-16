const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { user_id, subscription } = req.body;
    if (!user_id || !subscription) return res.status(400).json({ error: "Missing fields" });

    const headers = {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": "return=representation"
    };

    // Check if subscription already exists
    const check = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${user_id}&select=id`,
      { headers }
    );
    const existing = await check.json();

    if (existing.length > 0) {
      // Update existing
      await fetch(
        `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${user_id}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ subscription, updated_at: new Date().toISOString() })
        }
      );
    } else {
      // Create new
      await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ user_id, subscription })
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
