// api/team.js — tim radnog prostora: članovi i pozivnice.
// GET                              → { me, workspace, members, invites }   (svaki član)
// POST { action:"invite", email }  → nova pozivnica + mejl (samo vlasnik)
// POST { action:"rename", name }   → naziv radnog prostora (samo vlasnik)
// DELETE ?member_id=…  / ?invite_id=…  → uklanjanje člana / otkazivanje pozivnice (samo vlasnik)
import { guard, dbHeaders, SUPABASE_URL } from "./_lib/auth.js";

const APP_URL = process.env.APP_URL || "https://www.perfmind.tech";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function sb(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...opts, headers: { ...dbHeaders, ...(opts.headers || {}) } });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return data;
}

const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function sendInviteEmail(to, link, inviter, workspaceName) {
  if (!RESEND_API_KEY) return false;
  const team = workspaceName ? `tim „${esc(workspaceName)}“` : "svoj tim";
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
    <h2 style="margin:0 0 12px">Poziv u PerfMind</h2>
    <p style="font-size:15px;line-height:1.5">${esc(inviter || "Kolega")} vas poziva u ${team} na PerfMind-u – analitici oglasa i prodaje na jednom mestu.</p>
    <p style="margin:24px 0"><a href="${link}" style="background:#6D5DFC;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold;display:inline-block">Prihvati poziv</a></p>
    <p style="font-size:13px;color:#555;line-height:1.5">Prijavite se adresom <b>${esc(to)}</b> – pozivnica važi samo za nju, 14 dana.<br>Ako dugme ne radi, otvorite: <br><a href="${link}">${link}</a></p>
  </div>`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: "PerfMind <no-reply@perfmind.tech>", to: [to], subject: "Poziv u PerfMind tim", html })
    });
    return r.ok;
  } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const ctx = await guard(req, res);
  if (!ctx) return;
  const ws = ctx.membership.workspace_id;
  const isOwner = ctx.membership.role === "owner";

  try {
    if (req.method === "GET") {
      const now = new Date().toISOString();
      const [members, invites] = await Promise.all([
        sb(`workspace_members?workspace_id=eq.${ws}&select=id,email,role,auth_user_id,created_at&order=created_at.asc`),
        sb(`workspace_invites?workspace_id=eq.${ws}&accepted_at=is.null&expires_at=gt.${now}&select=id,email,created_at,expires_at&order=created_at.desc`)
      ]);
      return res.status(200).json({
        me: { email: ctx.user.email, role: ctx.membership.role },
        workspace: { name: ctx.membership.name || null },
        members: (members || []).map((m) => ({ id: m.id, email: m.email, role: m.role, isMe: m.auth_user_id === ctx.user.id, created_at: m.created_at })),
        invites: isOwner ? (invites || []) : []
      });
    }

    if (req.method === "POST") {
      if (!isOwner) return res.status(403).json({ error: "Samo vlasnik radnog prostora može ovo da menja." });
      const body = req.body || {};

      if (body.action === "rename") {
        const name = String(body.name || "").trim().slice(0, 80) || null;
        await sb(`users?id=eq.${ws}`, { method: "PATCH", body: JSON.stringify({ name }) });
        return res.status(200).json({ success: true, name });
      }

      if (body.action === "invite") {
        const email = String(body.email || "").trim().toLowerCase();
        if (!EMAIL_RE.test(email) || email.length > 200) return res.status(400).json({ error: "Neispravna mejl adresa." });
        const members = await sb(`workspace_members?workspace_id=eq.${ws}&select=email`);
        if ((members || []).some((m) => String(m.email || "").toLowerCase() === email)) {
          return res.status(409).json({ error: "Ova osoba je već član tima." });
        }
        // Nova pozivnica zamenjuje staru otvorenu za istu adresu
        await sb(`workspace_invites?workspace_id=eq.${ws}&email=eq.${encodeURIComponent(email)}&accepted_at=is.null`, { method: "DELETE" });
        const rows = await sb("workspace_invites", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ workspace_id: ws, email, invited_by: ctx.user.id })
        });
        const invite = rows[0];
        const link = `${APP_URL}/?invite=${invite.token}`;
        const emailSent = await sendInviteEmail(email, link, ctx.user.email, ctx.membership.name);
        return res.status(200).json({ invite: { id: invite.id, email: invite.email, created_at: invite.created_at, expires_at: invite.expires_at }, link, emailSent });
      }

      return res.status(400).json({ error: "Nepoznata akcija" });
    }

    if (req.method === "DELETE") {
      if (!isOwner) return res.status(403).json({ error: "Samo vlasnik radnog prostora može ovo da menja." });
      const memberId = Number(req.query.member_id);
      const inviteId = Number(req.query.invite_id);
      if (Number.isInteger(memberId) && memberId > 0) {
        const m = await sb(`workspace_members?id=eq.${memberId}&workspace_id=eq.${ws}&select=auth_user_id,role`);
        if (!m || !m.length) return res.status(404).json({ error: "Član nije pronađen." });
        if (m[0].auth_user_id === ctx.user.id) return res.status(400).json({ error: "Ne možete ukloniti sebe." });
        await sb(`workspace_members?id=eq.${memberId}&workspace_id=eq.${ws}`, { method: "DELETE" });
        return res.status(200).json({ success: true });
      }
      if (Number.isInteger(inviteId) && inviteId > 0) {
        await sb(`workspace_invites?id=eq.${inviteId}&workspace_id=eq.${ws}`, { method: "DELETE" });
        return res.status(200).json({ success: true });
      }
      return res.status(400).json({ error: "Nedostaje member_id ili invite_id" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
