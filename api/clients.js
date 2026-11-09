// api/clients.js — klijenti radnog prostora prijavljenog korisnika.
// Radni prostor se uzima iz prijave (ne iz adrese), pa niko ne moze da vidi ili menja tudje klijente.
// Parametar user_id koji aplikacija i dalje salje se zanemaruje.
import { guard, dbHeaders as headers, SUPABASE_URL } from "./_lib/auth.js";

// Tabele sa podacima klijenta koje se brisu pre samog klijenta
const CLIENT_TABLES = ["analyses", "budgets", "ga4_daily_metrics", "google_ads_daily_spend", "ga4_connections", "google_ads_connections"];

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const ctx = await guard(req, res);
  if (!ctx) return;
  const ws = ctx.membership.workspace_id;

  try {
    if (req.method === "PATCH") {
      const id = Number(req.query.id);
      const name = (req.body || {}).name;
      if (!Number.isInteger(id) || id <= 0 || !name || !String(name).trim()) return res.status(400).json({ error: "Missing id or name" });
      const r = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${id}&user_id=eq.${ws}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ name: String(name).trim() })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(data));
      if (!data.length) return res.status(404).json({ error: "Client not found" });
      return res.status(200).json(data[0]);
    }

    if (req.method === "DELETE") {
      const id = Number(req.query.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "No id" });
      const own = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${id}&user_id=eq.${ws}&select=id`, { headers });
      const ownD = await own.json();
      if (!own.ok || !Array.isArray(ownD) || !ownD.length) return res.status(404).json({ error: "Client not found" });
      // Prvo podaci klijenta u ostalim tabelama (tabela koja ne postoji se preskace)
      for (const t of CLIENT_TABLES) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/${t}?client_id=eq.${id}`, { method: "DELETE", headers });
        if (!r.ok && r.status !== 404) {
          const txt = await r.text();
          if (!/does not exist|PGRST205|42P01/.test(txt)) throw new Error(`${t}: ${txt}`);
        }
      }
      const r = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${id}&user_id=eq.${ws}`, {
        method: "DELETE",
        headers: { ...headers, Prefer: "return=representation" }
      });
      const data = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(data));
      if (!data.length) return res.status(404).json({ error: "Client not found" });
      return res.status(200).json({ success: true });
    }

    if (req.method === "GET") {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/clients?user_id=eq.${ws}&select=*,analyses(count)&order=created_at.desc`, { headers });
      const data = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(data));
      return res.status(200).json(data);
    }

    if (req.method === "POST") {
      const name = String((req.body || {}).name || "").trim().slice(0, 120);
      if (!name) return res.status(400).json({ error: "Missing fields" });
      // Ako klijent sa istim imenom vec postoji, vraca se postojeci
      const check = await fetch(`${SUPABASE_URL}/rest/v1/clients?user_id=eq.${ws}&name=eq.${encodeURIComponent(name)}&select=*`, { headers });
      const existing = await check.json();
      if (Array.isArray(existing) && existing.length > 0) return res.status(200).json(existing[0]);
      const r = await fetch(`${SUPABASE_URL}/rest/v1/clients`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ user_id: ws, name })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(data));
      return res.status(200).json(data[0]);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
