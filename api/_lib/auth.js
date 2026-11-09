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
