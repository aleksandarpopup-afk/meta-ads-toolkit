// api/push-subscribe.js — cuvanje pretplate na obavestenja za uredjaj prijavljenog korisnika.
// Pretplata se vezuje za radni prostor iz prijave (ne za ID koji posalje pregledac).
import { guard, dbHeaders, SUPABASE_URL } from "./_lib/auth.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const ctx = await guard(req, res);
  if (!ctx) return;
  const user_id = ctx.membership.workspace_id;

  try {
    const { subscription } = req.body || {};
    const endpoint = subscription && typeof subscription.endpoint === "string" ? subscription.endpoint : "";
    if (!/^https:\/\//.test(endpoint)) return res.status(400).json({ error: "Missing fields" });

    const headers = { ...dbHeaders, Prefer: "return=representation" };

    // Da li je ovaj uredjaj (endpoint) vec sacuvan
    const check = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${user_id}&select=id,subscription`, { headers });
    const existing = await check.json();
    if (!check.ok) throw new Error(JSON.stringify(existing));
    const same = (existing || []).find((s) => s.subscription?.endpoint === endpoint);

    const r = same
      ? await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${same.id}`, {
          method: "PATCH", headers,
          body: JSON.stringify({ subscription, updated_at: new Date().toISOString() })
        })
      : await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
          method: "POST", headers,
          body: JSON.stringify({ user_id, subscription })
        });
    // Greska pri upisu se vise ne prikriva
    if (!r.ok) throw new Error(await r.text());

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
