// api/temp-fetch.js — preuzimanje privremenih podataka posle povezivanja GA4 / Google Ads naloga
// (ga4_setup / gads_setup). Ti podaci sadrze pristupne kljuceve, zato:
//  - samo prijavljen korisnik,
//  - samo ako podaci pripadaju klijentu iz NJEGOVOG radnog prostora,
//  - podaci se brisu odmah posle citanja.
import { guard, clientInWorkspace, dbHeaders, SUPABASE_URL } from "./_lib/auth.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const ctx = await guard(req, res);
  if (!ctx) return;

  const id = String(req.query.id || "");
  if (!/^[0-9a-zA-Z-]{1,64}$/.test(id)) return res.status(400).json({ error: "No id provided" });

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/temp_imports?id=eq.${id}&select=*`, { headers: dbHeaders });
    const result = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(result));
    if (!result.length) return res.status(404).json({ error: "Not found" });

    let data;
    try { data = JSON.parse(result[0].data); } catch { data = null; }

    // Istekli podaci se ne vracaju
    if (result[0].expires_at && new Date(result[0].expires_at) < new Date()) {
      await fetch(`${SUPABASE_URL}/rest/v1/temp_imports?id=eq.${id}`, { method: "DELETE", headers: dbHeaders });
      return res.status(404).json({ error: "Expired" });
    }

    // Ako podaci pripadaju klijentu, klijent mora biti iz radnog prostora prijavljenog korisnika
    if (data && data.client_id != null && !(await clientInWorkspace(data.client_id, ctx.membership.workspace_id))) {
      return res.status(404).json({ error: "Not found" });
    }

    // Brisanje posle citanja
    await fetch(`${SUPABASE_URL}/rest/v1/temp_imports?id=eq.${id}`, { method: "DELETE", headers: dbHeaders });
    return res.status(200).json({ data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
