// api/temp-upload.js — privremeno cuvanje podataka (5 minuta). Ostatak ukinute Chrome ekstenzije.
// Sada dostupno samo prijavljenim korisnicima.
import { guard, dbHeaders, SUPABASE_URL } from "./_lib/auth.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ctx = await guard(req, res);
  if (!ctx) return;

  try {
    const { data } = req.body || {};
    if (!data) return res.status(400).json({ error: "No data provided" });

    const expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const response = await fetch(`${SUPABASE_URL}/rest/v1/temp_imports`, {
      method: "POST",
      headers: { ...dbHeaders, Prefer: "return=representation" },
      body: JSON.stringify({ data: JSON.stringify(data), expires_at })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(result));
    return res.status(200).json({ id: result[0].id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
