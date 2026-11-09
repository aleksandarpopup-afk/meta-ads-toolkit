// api/me.js — ko sam ja i u kom sam radnom prostoru.
// GET  → { email, workspace: { id, name, role } | null }
// POST { action: "claim", legacy_id }  → poveži postojeće podatke (stari link/ID) sa nalogom
// POST { action: "create", name }      → napravi novi, prazan radni prostor
// POST { action: "accept", token }     → prihvati pozivnicu u tim (mejl prijave mora da se poklapa)
import { getAuthUser, getMembership, dbHeaders, UUID_RE, SUPABASE_URL } from "./_lib/auth.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: "Niste prijavljeni" });

  const out = (m) => ({ email: user.email, workspace: m ? { id: m.workspace_id, name: m.name, role: m.role } : null });

  try {
    const current = await getMembership(user.id);

    if (req.method === "GET") return res.status(200).json(out(current));

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const body = req.body || {};

    // Nalog je već u nekom prostoru – ništa se ne menja (pozivnica se ne može prihvatiti, jedan nalog = jedan prostor)
    if (current) {
      if (body.action === "accept") return res.status(409).json({ error: "Vaš nalog je već u radnom prostoru. Za drugi tim prijavite se drugom mejl adresom.", ...out(current) });
      return res.status(200).json(out(current));
    }

    let workspaceId = null;
    let role = "owner";

    if (body.action === "claim") {
      const legacy = String(body.legacy_id || "");
      if (!UUID_RE.test(legacy)) return res.status(400).json({ error: "Neispravan ID" });
      // Postoji li taj prostor?
      const ur = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${legacy}&select=id`, { headers: dbHeaders });
      const ud = await ur.json();
      if (!ur.ok) throw new Error(JSON.stringify(ud));
      if (!ud.length) return res.status(404).json({ error: "Ovi podaci nisu pronađeni" });
      // Stari podaci se mogu povezati samo ako ih još niko nije preuzeo (tada postajete vlasnik).
      // Kolege se od sada dodaju isključivo pozivnicom.
      const mr = await fetch(`${SUPABASE_URL}/rest/v1/workspace_members?workspace_id=eq.${legacy}&select=id&limit=1`, { headers: dbHeaders });
      const md = await mr.json();
      if (!mr.ok) throw new Error(JSON.stringify(md));
      if (md.length) return res.status(409).json({ error: "Ove podatke je već preuzeo drugi nalog. Zatražite pozivnicu od vlasnika tima." });
      role = "owner";
      workspaceId = legacy;
    } else if (body.action === "create") {
      const name = String(body.name || "").trim().slice(0, 80) || null;
      const cr = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: "POST",
        headers: { ...dbHeaders, Prefer: "return=representation" },
        body: JSON.stringify(name ? { name } : {})
      });
      const cd = await cr.json();
      if (!cr.ok) throw new Error(JSON.stringify(cd));
      workspaceId = cd[0].id;
    } else if (body.action === "accept") {
      const token = String(body.token || "");
      if (!UUID_RE.test(token)) return res.status(400).json({ error: "Neispravna pozivnica" });
      const vr = await fetch(`${SUPABASE_URL}/rest/v1/workspace_invites?token=eq.${token}&select=id,workspace_id,email,expires_at,accepted_at`, { headers: dbHeaders });
      const vd = await vr.json();
      if (!vr.ok) throw new Error(JSON.stringify(vd));
      const inv = vd[0];
      if (!inv || inv.accepted_at) return res.status(404).json({ error: "Pozivnica nije pronađena ili je već iskorišćena." });
      if (new Date(inv.expires_at) < new Date()) return res.status(410).json({ error: "Pozivnica je istekla. Zatražite novu." });
      if (String(inv.email).toLowerCase() !== String(user.email || "").toLowerCase()) {
        return res.status(403).json({ error: `Pozivnica je poslata na ${inv.email}. Prijavite se tom adresom.` });
      }
      role = "member";
      workspaceId = inv.workspace_id;
      await fetch(`${SUPABASE_URL}/rest/v1/workspace_invites?id=eq.${inv.id}`, {
        method: "PATCH", headers: dbHeaders, body: JSON.stringify({ accepted_at: new Date().toISOString() })
      });
    } else {
      return res.status(400).json({ error: "Nepoznata akcija" });
    }

    const ir = await fetch(`${SUPABASE_URL}/rest/v1/workspace_members`, {
      method: "POST",
      headers: { ...dbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ workspace_id: workspaceId, auth_user_id: user.id, email: user.email, role })
    });
    if (!ir.ok) {
      const t = await ir.text();
      // Dupli klik / dva taba: nalog je u međuvremenu već upisan
      if (!/duplicate|23505/.test(t)) throw new Error(t);
    }
    return res.status(200).json(out(await getMembership(user.id)));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
