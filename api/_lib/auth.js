// api/_lib/auth.js — zajednička provera prijave za sve API fajlove.
// Fajlovi u folderu koji počinje donjom crtom (_lib) NISU javne adrese na Vercelu,
// već samo pomoćni kod koji drugi API fajlovi uvoze.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dbHeaders = {
  "Content-Type": "application/json",
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`
};

// Ko je prijavljen? Čita "Authorization: Bearer <token>" i pita Supabase da li je token važeći.
// Vraća { id, email } ili null.
export async function getAuthUser(req) {
  const h = req.headers.authorization || req.headers.Authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${m[1]}` }
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? { id: u.id, email: u.email || null } : null;
  } catch {
    return null;
  }
}

// U kom radnom prostoru je korisnik? Vraća { workspace_id, role, name } ili null.
export async function getMembership(authUserId) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/workspace_members?auth_user_id=eq.${authUserId}&select=workspace_id,role,users(name)&limit=1`,
    { headers: dbHeaders }
  );
  const d = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(d));
  if (!Array.isArray(d) || !d.length) return null;
  return { workspace_id: d[0].workspace_id, role: d[0].role, name: d[0].users ? d[0].users.name : null };
}

// Skraćenica: prijavljen korisnik + njegov radni prostor. Vraća { user, membership } ili null.
export async function requireWorkspace(req) {
  const user = await getAuthUser(req);
  if (!user) return null;
  const membership = await getMembership(user.id);
  if (!membership) return null;
  return { user, membership };
}

export { SUPABASE_URL };

// Da li klijent pripada radnom prostoru? (true/false)
export async function clientInWorkspace(clientId, workspaceId) {
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) return false;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${id}&user_id=eq.${workspaceId}&select=id`, { headers: dbHeaders });
  const d = await r.json();
  return r.ok && Array.isArray(d) && d.length > 0;
}

// Za sve API fajlove: vrati 401 ako niko nije prijavljen. Vraća { user, membership } ili null (odgovor je već poslat).
export async function guard(req, res) {
  const ctx = await requireWorkspace(req);
  if (!ctx) { res.status(401).json({ error: "Niste prijavljeni" }); return null; }
  return ctx;
}

// Potpisan "state" za Google povezivanje: Google ga vraća nepromenjen, a potpis
// sprečava da neko ručno podmetne drugi client_id u povratnu adresu.
import { createHmac, timingSafeEqual } from "node:crypto";
const STATE_KEY = process.env.GOOGLE_CLIENT_SECRET || process.env.SUPABASE_SERVICE_KEY || "";
export function signState(obj) {
  const payload = Buffer.from(JSON.stringify({ ...obj, t: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", STATE_KEY).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
export function verifyState(state, maxAgeMs = 60 * 60 * 1000) {
  const [payload, sig] = String(state || "").split(".");
  if (!payload || !sig) return null;
  const good = createHmac("sha256", STATE_KEY).update(payload).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(good);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!obj.t || Date.now() - obj.t > maxAgeMs) return null;
    return obj;
  } catch { return null; }
}

// Da li poziv dolazi od naseg automatskog posla (Vercel cron / cron-morning)?
export function isCron(req) {
  const secret = process.env.CRON_SECRET;
  return !!secret && (req.headers.authorization || "") === `Bearer ${secret}`;
}
