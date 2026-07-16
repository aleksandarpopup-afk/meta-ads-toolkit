import webpush from "web-push";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:test@test.com";

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { user_id, title, body, url } = req.body;
    if (!user_id || !title || !body) return res.status(400).json({ error: "Missing fields" });

    const headers = {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`
    };

    // Get ALL subscriptions for this user (all devices)
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${user_id}&select=id,subscription`,
      { headers }
    );
    const subs = await r.json();
    if (!subs.length) return res.status(404).json({ error: "No subscription found" });

    const payload = JSON.stringify({ title, body, url: url || "/" });
    
    // Send to ALL devices
    const results = await Promise.allSettled(
      subs.map(s => webpush.sendNotification(s.subscription, payload).catch(async err => {
        // If subscription expired, delete it
        if (err.statusCode === 410) {
          await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${s.id}`, {
            method: "DELETE", headers
          });
        }
        throw err;
      }))
    );

    const sent = results.filter(r => r.status === "fulfilled").length;
    return res.status(200).json({ success: true, sent, total: subs.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
