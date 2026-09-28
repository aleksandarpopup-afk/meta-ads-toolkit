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

// Datum "YYYY-MM-DD" u UTC (Vercel radi u UTC; jutarnji sync u 05:05 UTC je isti dan i u Srbiji)
const utcDay = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return utcDay(d); };

// Konverzija preko EUR kao pivot valute (isti princip kao u ostatku app-a)
function convert(amount, from, to, rates) {
  if (!from || !to || from === to) return { value: amount, ok: true };
  const rf = from === "EUR" ? 1 : rates && rates[from];
  const rt = to === "EUR" ? 1 : rates && rates[to];
  if (!rf || !rt) return { value: amount, ok: false };
  return { value: (amount / rf) * rt, ok: true };
}

// Google Ads budzeti povezanih klijenata: potrosnja se racuna automatski iz google_ads_daily_spend.
// Za svaki dan se pravi kumulativni "unos", pa grafikon i racunica rade isto kao kod rucnog unosa.
async function attachGoogleAdsSpend(budgets) {
  const gBudgets = budgets.filter((b) => b.platform === "google_ads");
  if (!gBudgets.length) return budgets;
  const clientIds = [...new Set(gBudgets.map((b) => Number(b.client_id)))];
  const conns = await sb(
    `google_ads_connections?client_id=in.(${clientIds.join(",")})&select=client_id,currency_code,last_synced_at,updated_at&order=updated_at.desc`
  );
  const connByClient = {};
  (conns || []).forEach((c) => { if (!connByClient[c.client_id]) connByClient[c.client_id] = c; });
  if (!Object.keys(connByClient).length) return budgets;

  let rates = null;
  try {
    const fx = await sb("exchange_rates?id=eq.1&select=rates");
    rates = fx && fx[0] ? fx[0].rates : null;
  } catch (e) { rates = null; }

  const todayUtc = utcDay(new Date());
  const yesterday = addDays(todayUtc, -1);

  for (const b of gBudgets) {
    const conn = connByClient[b.client_id];
    if (!conn) continue; // klijent nije povezan sa Google Ads -> rucni unos kao do sada
    // Sync koji se desio dana D ima podatke zakljucno sa D-1
    const syncedDay = conn.last_synced_at ? utcDay(new Date(conn.last_synced_at)) : null;
    const dataThrough = syncedDay ? addDays(syncedDay, -1) : yesterday;
    const stale = dataThrough < yesterday && todayUtc <= b.end_date;
    const end = dataThrough < b.end_date ? dataThrough : b.end_date;
    const auto = { source: "google_ads", data_through: dataThrough, stale, fx_ok: true, overlap: false };
    b.budget_spend_entries = [];
    if (end >= b.start_date) {
      const daily = await sb("rpc/get_budget_gads_daily", {
        method: "POST",
        body: JSON.stringify({
          p_client_id: Number(b.client_id), p_start: b.start_date, p_end: end,
          p_filter: b.campaign_filter ? String(b.campaign_filter) : null,
        }),
      });
      const byDay = {};
      (daily || []).forEach((r) => { byDay[String(r.day).slice(0, 10)] = Number(r.spend) || 0; });
      let cum = 0;
      for (let d = b.start_date; d <= end; d = addDays(d, 1)) {
        const c = convert(byDay[d] || 0, conn.currency_code || "EUR", b.currency || "EUR", rates);
        if (!c.ok) auto.fx_ok = false;
        cum += c.value;
        b.budget_spend_entries.push({ entry_date: d, spent: Math.round(cum * 100) / 100, through_today: true, auto: true });
      }
    }
    b.auto = auto;
  }

  // Upozorenje ako se dva Google Ads budzeta istog klijenta preklapaju (ista potrosnja bi se brojala dvaput)
  const autoB = gBudgets.filter((b) => b.auto);
  for (let i = 0; i < autoB.length; i++) {
    for (let j = i + 1; j < autoB.length; j++) {
      const a = autoB[i], c = autoB[j];
      if (a.client_id !== c.client_id) continue;
      if (a.end_date < c.start_date || c.end_date < a.start_date) continue;
      const fa = (a.campaign_filter || "").toLowerCase(), fc = (c.campaign_filter || "").toLowerCase();
      if (!fa || !fc || fa.includes(fc) || fc.includes(fa)) { a.auto.overlap = true; c.auto.overlap = true; }
    }
  }
  return budgets;
}

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
  if (b.campaign_filter !== undefined) {
    const f = b.campaign_filter ? String(b.campaign_filter).trim().slice(0, 100) : "";
    out.campaign_filter = f || null;
  }
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
      const list = Array.isArray(rows) ? rows : [];
      try {
        await attachGoogleAdsSpend(list);
      } catch (e) {
        // Ako automatika ne uspe, budzeti se i dalje prikazuju sa rucnim unosima
        list.forEach((b) => { if (b.platform === "google_ads" && !b.auto) b.auto_error = true; });
      }
      return res.status(200).json(list);
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
        // Samo budzeti ovog korisnika (automatski Google Ads budzeti se ne unose rucno, ali ni ne smetaju)
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
