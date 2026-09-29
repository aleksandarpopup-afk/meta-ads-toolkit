// api/notification-prefs.js — koja obavestenja korisnik zeli (podrazumevano oba ukljucena)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  const h = { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
  try {
    const userId = req.method === "POST" ? (req.body || {}).user_id : req.query.user_id;
    if (!userId || !UUID_RE.test(userId)) return res.status(400).json({ error: "Missing or invalid user_id" });
    if (req.method === "GET") {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/notification_prefs?user_id=eq.${userId}&select=budget_digest,gads_alerts`, { headers: h });
      const d = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(d));
      return res.status(200).json(d[0] || { budget_digest: true, gads_alerts: true });
    }
    if (req.method === "POST") {
      const { budget_digest, gads_alerts } = req.body || {};
      const r = await fetch(`${SUPABASE_URL}/rest/v1/notification_prefs?on_conflict=user_id`, {
        method: "POST",
        headers: { ...h, Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ user_id: userId, budget_digest: budget_digest !== false, gads_alerts: gads_alerts !== false, updated_at: new Date().toISOString() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(d));
      return res.status(200).json(d[0]);
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
