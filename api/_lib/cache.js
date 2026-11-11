// api/_lib/cache.js — zajednički keš rezultata u bazi (tabela api_cache).
// - Ključ = otisak (SHA-256) svega što utiče na rezultat: vrsta, klijent, GA4/Ads nalog, TAČNI datumi, filteri, verzija koda.
// - Keš je zajednički za tim, ali vezan za klijenta. Provera pristupa (guard/clientInWorkspace) se radi PRE keša.
// - Uključuje se promenljivom CACHE_ENABLED=1 u Vercelu. Bez nje se ništa ne čita ni ne upisuje (rad kao ranije).
// - Rezultat se čuva kompresovan (gzip), da baza ne raste brzo. Istekli zapisi se povremeno brišu.
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { dbHeaders, SUPABASE_URL } from "./auth.js";

export const cacheEnabled = () => process.env.CACHE_ENABLED === "1";

export function cacheKey(parts) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

// Vraća { data, ageSec } ili null. Greška keša NIKAD ne ruši zahtev – samo se ide bez keša.
export async function cacheGet(key) {
  if (!cacheEnabled()) return null;
  try {
    const now = new Date().toISOString();
    const r = await fetch(`${SUPABASE_URL}/rest/v1/api_cache?key=eq.${key}&expires_at=gt.${now}&select=payload,created_at`, { headers: dbHeaders });
    if (!r.ok) return null;
    const rows = await r.json();
    if (!rows.length) return null;
    const json = gunzipSync(Buffer.from(rows[0].payload, "base64")).toString("utf8");
    return { data: JSON.parse(json), ageSec: Math.max(0, Math.round((Date.now() - new Date(rows[0].created_at).getTime()) / 1000)) };
  } catch (e) {
    console.error("cacheGet:", e.message);
    return null;
  }
}

// Upis (ili zamena) rezultata. Greška keša ne ruši zahtev.
export async function cacheSet(key, { clientId, kind, json, ttlSec }) {
  if (!cacheEnabled()) return;
  try {
    const payload = gzipSync(Buffer.from(json, "utf8")).toString("base64");
    const r = await fetch(`${SUPABASE_URL}/rest/v1/api_cache?on_conflict=key`, {
      method: "POST",
      headers: { ...dbHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        key, client_id: Number(clientId), kind, payload, bytes: json.length,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + ttlSec * 1000).toISOString()
      })
    });
    if (!r.ok) console.error("cacheSet:", r.status, (await r.text()).slice(0, 300));
    // Povremeno čišćenje isteklih zapisa (otprilike svaki 20. upis)
    if (Math.random() < 0.05) {
      await fetch(`${SUPABASE_URL}/rest/v1/api_cache?expires_at=lt.${new Date().toISOString()}`, { method: "DELETE", headers: dbHeaders }).catch(() => {});
    }
  } catch (e) {
    console.error("cacheSet:", e.message);
  }
}

// Ako dva zahteva za ISTI ključ stignu u isto vreme na isti server, drugi čeka rezultat prvog
// umesto da ponovo ide ka Google-u.
const inFlight = new Map();
export function singleFlight(key, fn) {
  if (inFlight.has(key)) return inFlight.get(key);
  const p = Promise.resolve().then(fn).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}
