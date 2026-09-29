// api/cron-morning.js — jutarnja obavestenja (radnim danima, posle jutarnje Google Ads sinhronizacije)
// 1) Jutarnji pregled budzeta (Budget Pacing) - salje se svako jutro ako korisnik ima budzete u tekucem mesecu.
//    "Svi na tempu" se javlja SAMO ako su svi budzeti sveze uneti; budzet bez svezeg unosa se posebno broji.
// 2) Upozorenja za Google Ads kampanje - SAMO kad postoji problem (kampanja stala ili naglo skocila).
// Korisnik bira sta zeli u app-u (tabela notification_prefs; podrazumevano oba ukljucena).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const APP_URL = process.env.APP_URL;

// Pragovi za Google Ads upozorenja (EUR)
const STOP_MIN_AVG = 10;   // "stala": juce 0, a prosek prethodnih 7 dana bar 10 €/dan
const SPIKE_X = 3;         // "skok": juce bar 3x vise od proseka...
const SPIKE_MIN_DIFF = 50; // ...i bar 50 € vise od proseka
const BP_UNDER = -0.2;

const h = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const day = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return day(d); };
const dayDiff = (a, b) => Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);
const fmt = (v) => new Intl.NumberFormat("sr-RS", { maximumFractionDigits: 0 }).format(v);

async function sbAll(path) {
  let all = [], offset = 0;
  while (true) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { ...h, Range: `${offset}-${offset + 999}` } });
    const rows = await r.json();
    if (!Array.isArray(rows)) break;
    all = all.concat(rows);
    if (rows.length < 1000) break;
    offset += 1000;
  }
  return all;
}

// Ista racunica kao Budget Pacing u app-u
function bpStatus(b, today) {
  const entries = b.budget_spend_entries || [];
  const last = entries.length ? entries[entries.length - 1] : null;
  const total = Number(b.total_budget) || 0;
  const totalDays = dayDiff(b.start_date, b.end_date) + 1;
  if (today < b.start_date) return { status: "not_started" };
  if (today > b.end_date) return { status: "finished" };
  if (!last) return { status: "no_entry", stale: true };
  let ref = last.through_today ? last.entry_date : addDays(last.entry_date, -1);
  if (ref > b.end_date) ref = b.end_date;
  const elapsed = Math.max(0, Math.min(totalDays, dayDiff(b.start_date, ref) + 1));
  const spent = Number(last.spent) || 0;
  const expected = total * elapsed / totalDays;
  // Svez unos: automatski (Google Ads) po oznaci servera; rucni ako je unet juce ili danas
  const stale = b.auto ? !!b.auto.stale : last.entry_date < addDays(today, -1);
  if (spent === 0 && elapsed > 0) return { status: "no_spend", stale };
  if (expected <= 0) return { status: "early", stale };
  const diffPct = (spent - expected) / expected;
  if (diffPct > 0) return { status: "over", stale };
  if (diffPct < BP_UNDER) return { status: "under", stale };
  return { status: "ok", stale };
}

async function budgetDigest(userId, today) {
  const d = new Date(today + "T00:00:00Z");
  const from = day(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  const to = day(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
  const r = await fetch(`${APP_URL}/api/budgets?user_id=${userId}&from=${from}&to=${to}`);
  const list = await r.json();
  if (!r.ok || !Array.isArray(list)) return null;
  const active = list.map((b) => bpStatus(b, today)).filter((s) => s.status !== "not_started" && s.status !== "finished");
  if (!active.length) return null;
  const c = {};
  let stale = 0;
  active.forEach((s) => { c[s.status] = (c[s.status] || 0) + 1; if (s.stale) stale++; });
  const problems = (c.under || 0) + (c.over || 0) + (c.no_spend || 0);
  let body;
  if (!problems && !stale) body = `Svi budžeti su na tempu ✓ (${active.length})`;
  else if (!problems) body = `Nema problema u unetim budžetima, ali ${stale} ${stale === 1 ? "budžet nema" : "budžeta nema"} svež unos potrošnje – stanje možda nije tačno.`;
  else {
    const parts = [];
    if (c.under) parts.push(`${c.under} underspend`);
    if (c.over) parts.push(`${c.over} overspend`);
    if (c.no_spend) parts.push(`${c.no_spend} bez potrošnje`);
    if (c.ok) parts.push(`${c.ok} na tempu`);
    body = parts.join(" · ") + (stale ? ` · ${stale} bez svežeg unosa` : "");
  }
  return { title: "💰 Budget Pacing – jutarnji pregled", body, url: `${APP_URL}?mod=2` };
}

async function gadsAlerts(userId, today, isMonday, rates) {
  const clients = await sbAll(`clients?user_id=eq.${userId}&select=id,name`);
  if (!clients.length) return null;
  const conns = await sbAll(`google_ads_connections?client_id=in.(${clients.map((c) => c.id).join(",")})&select=client_id,currency_code,last_synced_at`);
  if (!conns.length) return null;
  const nameOf = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  // Ponedeljkom se proverava i vikend (subota i nedelja), inace samo jucerasnji dan
  const checkDays = isMonday ? [addDays(today, -2), addDays(today, -1)] : [addDays(today, -1)];
  const lines = [];
  for (const conn of conns) {
    // Ako danasnja sinhronizacija nije uspela (npr. istekla veza), podaci su zastareli - ne salje se lazna uzbuna
    if (!conn.last_synced_at || day(new Date(conn.last_synced_at)) !== today) continue;
    const cur = conn.currency_code || "EUR";
    const toEUR = (v) => cur === "EUR" ? v : (rates && rates[cur] ? v / rates[cur] : null);
    if (cur !== "EUR" && !(rates && rates[cur])) continue;
    const start = addDays(checkDays[0], -8);
    const rows = await sbAll(`google_ads_daily_spend?client_id=eq.${conn.client_id}&date=gte.${start}&date=lte.${addDays(today, -1)}&select=campaign_id,campaign_name,date,spend`);
    const byCamp = {};
    rows.forEach((r) => {
      const k = r.campaign_id;
      const o = byCamp[k] || (byCamp[k] = { name: r.campaign_name, days: {} });
      o.days[r.date] = (o.days[r.date] || 0) + (parseFloat(r.spend) || 0);
      if (r.campaign_name) o.name = r.campaign_name;
    });
    const found = {};
    for (const D of checkDays) {
      for (const [id, o] of Object.entries(byCamp)) {
        const spendD = toEUR(o.days[D] || 0);
        let sum = 0;
        for (let i = 1; i <= 7; i++) sum += toEUR(o.days[addDays(D, -i)] || 0);
        const avg = sum / 7;
        const prev = toEUR(o.days[addDays(D, -1)] || 0);
        if (spendD === 0 && avg >= STOP_MIN_AVG && prev > 0) {
          found[id] = `„${o.name}“ stala (0 € umesto ~${fmt(avg)} €/dan)`;
        } else if (avg > 0 && spendD >= SPIKE_X * avg && spendD - avg >= SPIKE_MIN_DIFF) {
          found[id] = `„${o.name}“ ${(spendD / avg).toFixed(1).replace(".", ",")}× veća potrošnja (${fmt(spendD)} € umesto ~${fmt(avg)} €)`;
        }
      }
    }
    const items = Object.values(found);
    if (items.length) lines.push(`${nameOf[conn.client_id] || "Klijent"}: ${items.join("; ")}`);
  }
  if (!lines.length) return null;
  let body = lines.join(" | ");
  if (body.length > 300) body = body.slice(0, 297) + "...";
  return { title: "⚠️ Google Ads upozorenje", body, url: `${APP_URL}?mod=14` };
}

async function send(userId, msg) {
  const r = await fetch(`${APP_URL}/api/push-send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CRON_SECRET}` },
    body: JSON.stringify({ user_id: userId, ...msg }),
  });
  return r.ok;
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const now = new Date();
  const dow = now.getUTCDay();
  if (dow === 0 || dow === 6) return res.status(200).json({ success: true, sent: 0, reason: "Weekend - skipped" });
  const today = day(now);
  const isMonday = dow === 1;

  try {
    const subs = await sbAll("push_subscriptions?select=user_id");
    const userIds = [...new Set(subs.map((s) => s.user_id).filter(Boolean))];
    const prefsRows = userIds.length ? await sbAll(`notification_prefs?user_id=in.(${userIds.join(",")})&select=user_id,budget_digest,gads_alerts`) : [];
    const prefs = Object.fromEntries(prefsRows.map((p) => [p.user_id, p]));
    let rates = null;
    try { const fx = await sbAll("exchange_rates?id=eq.1&select=rates"); rates = fx[0] ? fx[0].rates : null; } catch (e) {}

    let sent = 0;
    const errors = [];
    for (const userId of userIds) {
      const p = prefs[userId] || { budget_digest: true, gads_alerts: true };
      try {
        if (p.budget_digest) {
          const m = await budgetDigest(userId, today);
          if (m && await send(userId, m)) sent++;
        }
        if (p.gads_alerts) {
          const m = await gadsAlerts(userId, today, isMonday, rates);
          if (m && await send(userId, m)) sent++;
        }
      } catch (e) {
        errors.push({ user_id: userId, error: e.message });
      }
    }
    return res.status(200).json({ success: true, sent, users: userIds.length, errors });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
