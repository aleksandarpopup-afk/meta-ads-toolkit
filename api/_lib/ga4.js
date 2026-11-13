// api/_lib/ga4.js — zajednički, "pristojan" pristup GA4 Data API-ju.
// - Ograničen broj istovremenih upita po jednom otvaranju (limiter), da ne opteretimo GA4 nalog klijenta
//   (GA4 dozvoljava 10 istovremenih po nalogu; mi trošimo najviše 4, ostatak ostaje za kolege).
// - Ponovni pokušaj kad Google kaže "previše/zauzeto" (429, RESOURCE_EXHAUSTED, 500/503): do 5 puta,
//   sa sve dužim čekanjem (oko 1, 2, 4, 8, 10 s) i malo nasumičnim, da se zahtevi ne bi ponovo sudarili u istoj sekundi.
// - Merenje: potrošena kvota i trajanje (samo beleži, ne menja rezultat).
// - Paralelno vučenje u delovima daje ISTE redove istim redosledom kao vučenje deo po deo.

export function createLimiter(max) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= max || !queue.length) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve().then(fn).then(resolve, reject).finally(() => { active--; next(); });
  };
  return (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RETRYABLE = /RESOURCE_EXHAUSTED|rateLimitExceeded|concurrent|UNAVAILABLE|INTERNAL|BACKEND_ERROR/i;

// ── Merenje ──
export function newMeter(name) {
  return { name, t0: Date.now(), steps: [], ga4Calls: 0, ga4Tokens: 0, retries: 0, quotaLeft: null };
}
export function meterStep(meter, label, t) {
  if (meter) meter.steps.push(`${label}:${Date.now() - t}ms`);
}
function meterQuota(meter, data) {
  if (!meter) return;
  meter.ga4Calls++;
  const q = data && data.propertyQuota;
  if (q) {
    meter.ga4Tokens += (q.tokensPerHour && q.tokensPerHour.consumed) || 0;
    meter.quotaLeft = {
      projectHour: q.tokensPerProjectPerHour ? q.tokensPerProjectPerHour.remaining : null,
      propertyHour: q.tokensPerHour ? q.tokensPerHour.remaining : null,
      propertyDay: q.tokensPerDay ? q.tokensPerDay.remaining : null
    };
  }
}
export function meterDone(meter, extra) {
  const out = { ms: Date.now() - meter.t0, ga4Calls: meter.ga4Calls, ga4Tokens: meter.ga4Tokens, retries: meter.retries, quotaLeft: meter.quotaLeft, steps: meter.steps, ...extra };
  console.log(`[perf] ${meter.name} ${JSON.stringify(out)}`);
  return out;
}

// Jedan GA4 runReport, kroz limiter, sa ponovnim pokušajem
export async function ga4Fetch(propertyId, accessToken, body, { meter, limit } = {}) {
  const run = async () => {
    for (let attempt = 0; ; attempt++) {
      const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(meter ? { ...body, returnPropertyQuota: true } : body)
      });
      const raw = await r.text().catch(() => "");
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch (e) { data = null; }
      if (r.ok && data) { meterQuota(meter, data); return data; }
      // Poruka greške sada uvek sadrži HTTP status i početak odgovora (ranije je znalo da ostane samo "{}")
      const msg = `GA4 HTTP ${r.status}: ${(data ? JSON.stringify(data) : raw).slice(0, 300)}`;
      // Potrošena kvota (tokeni po satu/danu) – ponovni pokušaj ne pomaže, prekida se odmah
      if (/tokens per (hour|day)|Exhausted property tokens|Exhausted.*tokens/i.test(msg) && !/concurrent/i.test(msg)) throw new Error(msg);
      const retryable = r.status === 429 || r.status === 500 || r.status === 502 || r.status === 503 || r.status === 504 || RETRYABLE.test(msg);
      console.warn(`[ga4] property=${propertyId} pokušaj ${attempt + 1}: ${msg.slice(0, 200)}`);
      if (!retryable || attempt >= 5) throw new Error(msg);
      if (meter) meter.retries++;
      await sleep(Math.min(10000, 1000 * 2 ** attempt) * (0.5 + Math.random())); // ~1, 2, 4, 8, 10 s ± 50%
    }
  };
  return limit ? limit(run) : run();
}

// Ceo izveštaj u delovima od 10.000 redova. Prvi deo kaže koliko ukupno ima redova,
// ostali delovi se vuku istovremeno (koliko limiter dozvoli) i slažu NA ISTO MESTO kao da su vučeni redom.
export async function ga4FetchAll(propertyId, accessToken, body, { maxRows = 100000, meter, limit } = {}) {
  const PAGE = 10000;
  const first = await ga4Fetch(propertyId, accessToken, { ...body, limit: PAGE, offset: 0 }, { meter, limit });
  const total = first.rowCount || 0;
  const firstRows = first.rows || [];
  if (firstRows.length < PAGE || total <= PAGE) return { rows: firstRows, rowCount: total };
  const offsets = [];
  for (let o = PAGE; o < Math.min(total, maxRows); o += PAGE) offsets.push(o);
  const pages = await Promise.all(offsets.map((offset) =>
    ga4Fetch(propertyId, accessToken, { ...body, limit: PAGE, offset }, { meter, limit }).then((d) => d.rows || [])
  ));
  return { rows: firstRows.concat(...pages), rowCount: total };
}
