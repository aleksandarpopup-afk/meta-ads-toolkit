// api/budgets.js — Budget Pacing
// Tabele: budgets (budzet po klijentu, platformi i periodu) i budget_spend_entries
// (ukupno potroseno do datuma unosa, najvise jedan unos po budzetu po danu).
// Svaka operacija je ogranicena na user_id, pa niko ne moze da menja tudje budzete.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const PLATFORMS = ["meta", "google_ads", "tiktok", "other"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const headers = () => ({
  "Content-Type": "application/json",
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
});

async function sb(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { ...headers(), ...(opts.headers || {}) },
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!r.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return data;
}

const isNum = (v) => typeof v === "number" && isFinite(v) && v >= 0;

// Proverava i cisti podatke jednog budzeta. Vraca {ok, value} ili {ok:false, error}.
function cleanBudget(b, partial = false) {
  const out = {};
  if (!partial || b.client_id !== undefined) {
    const cid = Number(b.client_id);
    if (!Number.isInteger(cid) || cid <= 0) return { ok: false, error: "Invalid client_id" };
    out.client_id = cid;
  }
  if (!partial || b.platform !== undefined) {
    if (!PLATFORMS.includes(b.platform)) return { ok: false, error: "Invalid platform" };
    out.platform = b.platform;
  }
  if (!partial || b.start_date !== undefined) {
    if (!DATE_RE.test(b.start_date || "")) return { ok: false, error: "Invalid start_date" };
    out.start_date = b.start_date;
  }
  if (!partial || b.end_date !== undefined) {
    if (!DATE_RE.test(b.end_date || "")) return { ok: false, error: "Invalid end_date" };
    out.end_date = b.end_date;
  }
  if (out.start_date && out.end_date && out.end_date < out.start_date) {
    return { ok: false, error: "end_date before start_date" };
  }
  if (!partial || b.total_budget !== undefined) {
    const tb = Number(b.total_budget);
    if (!isNum(tb)) return { ok: false, error: "Invalid total_budget" };
    out.total_budget = tb;
  }
  if (!partial || b.currency !== undefined) {
    const cur = String(b.currency || "EUR").toUpperCase();
    if (!/^[A-Z]{3}$/.test(cur)) return { ok: false, error: "Invalid currency" };
    out.currency = cur;
  }
  if (b.note !== undefined) out.note = b.note ? String(b.note).slice(0, 200) : null;
  return { ok: true, value: out };
}

// Vraca skup client_id-jeva koji pripadaju korisniku (zastita od tudjih klijenata).
async function ownedClientIds(userId, ids) {
  if (!ids.length) return new Set();
  const rows = await sb(`clients?user_id=eq.${userId}&id=in.(${ids.join(",")})&select=id`);
  return new Set((rows || []).map((r) => Number(r.id)));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const userId = req.method === "GET" || req.method === "DELETE" || req.method === "PATCH"
      ? req.query.user_id
      : (req.body || {}).user_id;
    if (!userId || !UUID_RE.test(userId)) return res.status(400).json({ error: "Missing or invalid user_id" });

    // ── GET: budzeti koji se preklapaju sa periodom from–to, sa klijentom i unosima
    if (req.method === "GET") {
      const { from, to } = req.query;
      if (!DATE_RE.test(from || "") || !DATE_RE.test(to || "")) {
        return res.status(400).json({ error: "Missing from/to" });
      }
      const rows = await sb(
        `budgets?user_id=eq.${userId}&start_date=lte.${to}&end_date=gte.${from}` +
        `&select=*,clients(id,name),budget_spend_entries(id,entry_date,spent,through_today)` +
        `&order=start_date.asc&budget_spend_entries.order=entry_date.asc`
      );
      return res.status(200).json(Array.isArray(rows) ? rows : []);
    }

    // ── POST: novi budzeti (action "create") ili dnevni unos potrosnje (action "entries")
    if (req.method === "POST") {
      const { action } = req.body || {};

      if (action === "create") {
        const list = Array.isArray(req.body.budgets) ? req.body.budgets : [];
        if (!list.length || list.length > 200) return res.status(400).json({ error: "No budgets" });
        const clean = [];
        for (const b of list) {
          const c = cleanBudget(b);
          if (!c.ok) return res.status(400).json({ error: c.error });
          clean.push({ ...c.value, user_id: userId });
        }
        const owned = await ownedClientIds(userId, [...new Set(clean.map((b) => b.client_id))]);
        if (clean.some((b) => !owned.has(b.client_id))) return res.status(403).json({ error: "Client not found" });
        const rows = await sb("budgets", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(clean),
        });
        return res.status(200).json(rows);
      }

      if (action === "entries") {
        const list = Array.isArray(req.body.entries) ? req.body.entries : [];
        if (!list.length || list.length > 500) return res.status(400).json({ error: "No entries" });
        const clean = [];
        for (const e of list) {
          const bid = Number(e.budget_id);
          const spent = Number(e.spent);
          if (!Number.isInteger(bid) || bid <= 0) return res.status(400).json({ error: "Invalid budget_id" });
          if (!isNum(spent)) return res.status(400).json({ error: "Invalid spent" });
          if (!DATE_RE.test(e.entry_date || "")) return res.status(400).json({ error: "Invalid entry_date" });
          clean.push({ budget_id: bid, spent, entry_date: e.entry_date, through_today: !!e.through_today });
        }
        // Samo budzeti ovog korisnika
        const ids = [...new Set(clean.map((e) => e.budget_id))];
        const owned = await sb(`budgets?user_id=eq.${userId}&id=in.(${ids.join(",")})&select=id`);
        const ownedSet = new Set((owned || []).map((r) => Number(r.id)));
        if (clean.some((e) => !ownedSet.has(e.budget_id))) return res.status(403).json({ error: "Budget not found" });
        // Jedan unos po budzetu po danu: novi unos istog dana zamenjuje stari
        const rows = await sb("budget_spend_entries?on_conflict=budget_id,entry_date", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=representation" },
          body: JSON.stringify(clean),
        });
        return res.status(200).json(rows);
      }

      return res.status(400).json({ error: "Unknown action" });
    }

    // ── PATCH: izmena budzeta (iznos, datumi, platforma, valuta, napomena)
    if (req.method === "PATCH") {
      const id = Number(req.query.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
      const c = cleanBudget(req.body || {}, true);
      if (!c.ok) return res.status(400).json({ error: c.error });
      const patch = c.value;
      delete patch.client_id; // klijent budzeta se ne menja
      if (!Object.keys(patch).length) return res.status(400).json({ error: "Nothing to update" });
      // Ako se menja samo jedan datum, proveri ga u odnosu na postojeci drugi datum
      if ((patch.start_date && !patch.end_date) || (!patch.start_date && patch.end_date)) {
        const cur = await sb(`budgets?id=eq.${id}&user_id=eq.${userId}&select=start_date,end_date`);
        if (!cur || !cur.length) return res.status(404).json({ error: "Budget not found" });
        const s = patch.start_date || cur[0].start_date;
        const e = patch.end_date || cur[0].end_date;
        if (e < s) return res.status(400).json({ error: "end_date before start_date" });
      }
      patch.updated_at = new Date().toISOString();
      const rows = await sb(`budgets?id=eq.${id}&user_id=eq.${userId}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(patch),
      });
      if (!rows || !rows.length) return res.status(404).json({ error: "Budget not found" });
      return res.status(200).json(rows[0]);
    }

    // ── DELETE: brisanje budzeta (unosi se brisu automatski, cascade)
    if (req.method === "DELETE") {
      const id = Number(req.query.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
      const rows = await sb(`budgets?id=eq.${id}&user_id=eq.${userId}`, {
        method: "DELETE",
        headers: { Prefer: "return=representation" },
      });
      if (!rows || !rows.length) return res.status(404).json({ error: "Budget not found" });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
