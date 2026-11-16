// api/beyond-roas.js — Beyond ROAS (korak 1): podešavanje po klijentu i učitavanje nabavnih cena / zarade.
// Fajl se čita i prepoznaje u PREGLEDAČU (CSV, Excel, XML feed); ovde stižu samo već očišćeni redovi
// u delovima (najviše 5.000 redova po pozivu), pa nema problema sa Vercel-ovim limitom od 4,5 MB.
// Novi fajl se upisuje kao nova "serija" (batch); tek kad stignu SVI delovi ("commit") postaje važeći,
// a stara serija se briše. Ako učitavanje pukne na pola, stari podaci ostaju netaknuti.
import { guard, clientInWorkspace, dbHeaders, SUPABASE_URL, UUID_RE } from "./_lib/auth.js";

const MAX_CHUNK = 5000;
const CUR_RE = /^[A-Z]{3}$/;

const db = (path, init = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...dbHeaders, ...(init.headers || {}) } });

async function dbJson(path, init) {
  const r = await db(path, init);
  const txt = await r.text();
  let d = null;
  try { d = txt ? JSON.parse(txt) : null; } catch { d = txt; }
  if (!r.ok) {
    const msg = typeof d === "object" && d ? (d.message || JSON.stringify(d)) : String(d);
    // Tabela ne postoji = SQL (br.sql) još nije pokrenut
    if (/br_settings|br_costs/.test(msg) && /does not exist|Could not find/i.test(msg)) throw new Error("setup_missing");
    throw new Error(`Baza ${r.status}: ${String(msg).slice(0, 200)}`);
  }
  return d;
}

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
const str = (v, max) => (v === null || v === undefined ? null : String(v).slice(0, max));

// Samo dozvoljena polja podešavanja, sa proverom vrednosti
function cleanSettings(s) {
  const out = {};
  if (!s || typeof s !== "object") return out;
  if (typeof s.prices_include_vat === "boolean") out.prices_include_vat = s.prices_include_vat;
  if (s.vat_rate !== undefined) { const v = Number(s.vat_rate); if (isFinite(v) && v >= 0 && v <= 50) out.vat_rate = v; }
  if (s.value_type === "cost" || s.value_type === "margin") out.value_type = s.value_type;
  if (typeof s.value_includes_vat === "boolean") out.value_includes_vat = s.value_includes_vat;
  if (s.value_currency === null || (typeof s.value_currency === "string" && CUR_RE.test(s.value_currency))) out.value_currency = s.value_currency;
  if (s.category_margins && typeof s.category_margins === "object" && !Array.isArray(s.category_margins)) {
    const cm = {};
    for (const [k, v] of Object.entries(s.category_margins).slice(0, 500)) { const n = Number(v); if (isFinite(n) && n >= 0 && n <= 100) cm[String(k).slice(0, 200)] = n; }
    out.category_margins = cm;
  }
  return out;
}

async function getSettings(clientId) {
  const rows = await dbJson(`br_settings?client_id=eq.${clientId}&select=*`);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function saveSettings(clientId, fields) {
  await dbJson(`br_settings?on_conflict=client_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ client_id: clientId, ...fields, updated_at: new Date().toISOString() })
  });
}

async function countBatch(clientId, batch) {
  const r = await db(`br_costs?client_id=eq.${clientId}&batch=eq.${batch}&select=sku&limit=1`, { headers: { Prefer: "count=exact" } });
  if (!r.ok) throw new Error(`Baza ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const cr = r.headers.get("content-range") || "";
  const n = parseInt(cr.split("/")[1], 10);
  return isFinite(n) ? n : 0;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  const ctx = await guard(req, res);
  if (!ctx) return;

  const body = req.method === "POST" ? (typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {})) : {};
  const clientIdRaw = req.method === "POST" ? body.client_id : req.query.client_id;
  const clientId = Number(clientIdRaw);
  if (!(await clientInWorkspace(clientId, ctx.membership.workspace_id))) return res.status(404).json({ error: "client_not_found" });

  try {
    // ── Stanje: podešavanje + šta je učitano ──
    if (req.method === "GET") {
      const s = await getSettings(clientId);
      let sample = [];
      if (s && s.active_batch && req.query.sample === "1") {
        sample = await dbJson(`br_costs?client_id=eq.${clientId}&batch=eq.${s.active_batch}&select=sku,value,price,title,category,currency&limit=20`);
      }
      return res.status(200).json({ settings: s, sample });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "method" });

    const action = body.action;

    if (action === "settings") {
      const fields = cleanSettings(body.settings);
      if (!Object.keys(fields).length) return res.status(400).json({ error: "no_fields" });
      await saveSettings(clientId, fields);
      return res.status(200).json({ ok: true, settings: await getSettings(clientId) });
    }

    if (action === "upload_chunk") {
      const batch = String(body.batch || "");
      if (!UUID_RE.test(batch)) return res.status(400).json({ error: "bad_batch" });
      const rows = Array.isArray(body.rows) ? body.rows : null;
      if (!rows || !rows.length || rows.length > MAX_CHUNK) return res.status(400).json({ error: "bad_rows" });
      const out = [];
      const seen = new Set();
      for (const r of rows) {
        const sku = str(r && r.s, 200);
        const value = num(r && r.v);
        if (!sku || !sku.trim() || value === null || !isFinite(value) || Math.abs(value) >= 1e10) continue;
        const k = sku.trim();
        if (seen.has(k)) continue;
        seen.add(k);
        const price = num(r.p);
        const cur = typeof r.cur === "string" && CUR_RE.test(r.cur) ? r.cur : null;
        out.push({ client_id: clientId, batch, sku: k, value, price: price !== null && isFinite(price) && Math.abs(price) < 1e10 ? price : null, title: str(r.t, 300), category: str(r.c, 200), currency: cur });
      }
      if (out.length) {
        await dbJson(`br_costs?on_conflict=client_id,batch,sku`, {
          method: "POST",
          headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
          body: JSON.stringify(out)
        });
      }
      return res.status(200).json({ ok: true, saved: out.length });
    }

    if (action === "upload_commit") {
      const batch = String(body.batch || "");
      if (!UUID_RE.test(batch)) return res.status(400).json({ error: "bad_batch" });
      const expected = Number(body.row_count);
      const have = await countBatch(clientId, batch);
      // Svi delovi moraju biti tu – inače se novi fajl NE uključuje (stari ostaje važeći)
      if (!have || (isFinite(expected) && have !== expected)) {
        await db(`br_costs?client_id=eq.${clientId}&batch=eq.${batch}`, { method: "DELETE" }).catch(() => {});
        return res.status(409).json({ error: "incomplete", have, expected });
      }
      const fields = cleanSettings(body.settings);
      const cm = body.column_map && typeof body.column_map === "object" ? body.column_map : null;
      await saveSettings(clientId, {
        ...fields,
        column_map: cm && JSON.stringify(cm).length < 20000 ? cm : null,
        source_name: str(body.source_name, 200),
        row_count: have,
        active_batch: batch,
        uploaded_at: new Date().toISOString()
      });
      // Stara serija (i eventualno nedovršena učitavanja) se brišu tek kad je nova uključena
      await db(`br_costs?client_id=eq.${clientId}&batch=neq.${batch}`, { method: "DELETE" });
      return res.status(200).json({ ok: true, row_count: have, settings: await getSettings(clientId) });
    }

    if (action === "upload_abort") {
      const batch = String(body.batch || "");
      if (!UUID_RE.test(batch)) return res.status(400).json({ error: "bad_batch" });
      const s = await getSettings(clientId);
      if (s && s.active_batch === batch) return res.status(400).json({ error: "active_batch" });
      await db(`br_costs?client_id=eq.${clientId}&batch=eq.${batch}`, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "unknown_action" });
  } catch (err) {
    console.error("[beyond-roas]", err.message);
    return res.status(err.message === "setup_missing" ? 503 : 500).json({ error: err.message });
  }
}
