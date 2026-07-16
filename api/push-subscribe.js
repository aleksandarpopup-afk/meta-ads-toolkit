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

    // Check if this exact endpoint already exists
    const endpoint = subscription.endpoint || "";
    const encodedEndpoint = encodeURIComponent(endpoint);
    
    const check = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${user_id}&select=id,subscription`,
      { headers }
    );
    const existing = await check.json();
    
    // Check if same endpoint already saved
    const sameEndpoint = existing.find(s => s.subscription?.endpoint === endpoint);
    
    if (sameEndpoint) {
      // Update existing
      await fetch(
        `${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${sameEndpoint.id}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ subscription, updated_at: new Date().toISOString() })
        }
      );
    } else {
      // Add new subscription for this device
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
