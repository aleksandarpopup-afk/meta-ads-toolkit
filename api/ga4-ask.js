const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;

async function refreshAccessToken(refresh_token) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token"
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data));
  return data.access_token;
}

async function ga4Fetch(propertyId, accessToken, body) {
  const r = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body)
    }
  );
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || JSON.stringify(data));
  return data;
}

// ── Alat 1: podaci na nivou proizvoda ──
async function execQueryProducts(propertyId, accessToken, p) {
  const dateRanges = [{ startDate: p.startDate, endDate: p.endDate }];
  const hasComparison = !!(p.previousStartDate && p.previousEndDate);
  if (hasComparison) dateRanges.push({ startDate: p.previousStartDate, endDate: p.previousEndDate });

  const orderMetricMap = { viewed: "itemsViewed", addedToCart: "itemsAddedToCart", purchased: "itemsPurchased", revenue: "itemRevenue" };
  const orderMetric = orderMetricMap[p.orderBy] || "itemRevenue";

  const body = {
    dateRanges,
    dimensions: [{ name: "itemId" }, { name: "itemName" }],
    metrics: [{ name: "itemsViewed" }, { name: "itemsAddedToCart" }, { name: "itemsPurchased" }, { name: "itemRevenue" }],
    orderBys: [{ metric: { metricName: orderMetric }, desc: true }],
    limit: Math.min(Math.max(p.limit || 25, 1), 250)
  };
  if (p.nameContains) {
    body.dimensionFilter = { filter: { fieldName: "itemName", stringFilter: { matchType: "CONTAINS", value: p.nameContains, caseSensitive: false } } };
  }

  const data = await ga4Fetch(propertyId, accessToken, body);
  const byItem = {};
  for (const row of data.rows || []) {
    const id = row.dimensionValues[0].value;
    const name = row.dimensionValues[1].value;
    const rangeIdx = hasComparison ? row.dimensionValues[2].value : "date_range_0";
    const m = {
      viewed: parseInt(row.metricValues[0].value) || 0,
      addedToCart: parseInt(row.metricValues[1].value) || 0,
      purchased: parseInt(row.metricValues[2].value) || 0,
      revenue: parseFloat(row.metricValues[3].value) || 0
    };
    if (!byItem[id]) byItem[id] = { id, name, current: null, previous: null };
    if (rangeIdx === "date_range_0") byItem[id].current = m;
    else byItem[id].previous = m;
  }
  const list = Object.values(byItem).map((it) => ({
    id: it.id,
    name: it.name,
    ...(it.current || { viewed: 0, addedToCart: 0, purchased: 0, revenue: 0 }),
    ...(hasComparison ? { previousPeriod: it.previous || { viewed: 0, addedToCart: 0, purchased: 0, revenue: 0 } } : {})
  }));
  const total = data.rowCount || 0;
  return { rows: list, totalRowsInGA4: total, moreRowsExist: total > (data.rows || []).length };
}

// ── Alat 2: podaci na nivou kampanje/saobraćaja ──
async function execQueryCampaigns(propertyId, accessToken, p) {
  const dateRanges = [{ startDate: p.startDate, endDate: p.endDate }];
  const hasComparison = !!(p.previousStartDate && p.previousEndDate);
  if (hasComparison) dateRanges.push({ startDate: p.previousStartDate, endDate: p.previousEndDate });

  const orderMetricMap = { sessions: "sessions", purchases: "transactions", conversions: "transactions", revenue: "totalRevenue" };
  const orderMetric = orderMetricMap[p.orderBy] || "totalRevenue";

  const body = {
    dateRanges,
    dimensions: [{ name: "sessionCampaignName" }, { name: "sessionSource" }],
    metrics: [{ name: "sessions" }, { name: "transactions" }, { name: "totalRevenue" }],
    orderBys: [{ metric: { metricName: orderMetric }, desc: true }],
    limit: Math.min(Math.max(p.limit || 25, 1), 250)
  };
  const filters = [];
  if (p.campaignNameContains) filters.push({ filter: { fieldName: "sessionCampaignName", stringFilter: { matchType: "CONTAINS", value: p.campaignNameContains, caseSensitive: false } } });
  if (p.sourceContains) filters.push({ filter: { fieldName: "sessionSource", stringFilter: { matchType: "CONTAINS", value: p.sourceContains, caseSensitive: false } } });
  if (filters.length === 1) body.dimensionFilter = filters[0];
  else if (filters.length === 2) body.dimensionFilter = { andGroup: { expressions: filters } };

  const data = await ga4Fetch(propertyId, accessToken, body);
  const byCampaign = {};
  for (const row of data.rows || []) {
    const name = row.dimensionValues[0].value;
    const source = row.dimensionValues[1].value;
    const rangeIdx = hasComparison ? row.dimensionValues[2].value : "date_range_0";
    const key = name + "||" + source;
    const m = {
      sessions: parseInt(row.metricValues[0].value) || 0,
      purchases: parseFloat(row.metricValues[1].value) || 0,
      revenue: parseFloat(row.metricValues[2].value) || 0
    };
    if (!byCampaign[key]) byCampaign[key] = { name, source, current: null, previous: null };
    if (rangeIdx === "date_range_0") byCampaign[key].current = m;
    else byCampaign[key].previous = m;
  }
  const list = Object.values(byCampaign).map((c) => ({
    name: c.name,
    source: c.source,
    ...(c.current || { sessions: 0, purchases: 0, revenue: 0 }),
    ...(hasComparison ? { previousPeriod: c.previous || { sessions: 0, purchases: 0, revenue: 0 } } : {})
  }));
  const total = data.rowCount || 0;
  return { rows: list, totalRowsInGA4: total, moreRowsExist: total > (data.rows || []).length };
}

// ── Alat 3: proizvodi FILTRIRANI po izvoru saobraćaja (npr. samo Meta, samo Google) ──
async function execQueryProductsBySource(propertyId, accessToken, p) {
  const dateRanges = [{ startDate: p.startDate, endDate: p.endDate }];
  const hasComparison = !!(p.previousStartDate && p.previousEndDate);
  if (hasComparison) dateRanges.push({ startDate: p.previousStartDate, endDate: p.previousEndDate });

  const orderMetricMap = { viewed: "itemsViewed", addedToCart: "itemsAddedToCart", purchased: "itemsPurchased", revenue: "itemRevenue" };
  const orderMetric = orderMetricMap[p.orderBy] || "itemRevenue";

  const body = {
    dateRanges,
    dimensions: [{ name: "itemId" }, { name: "itemName" }],
    metrics: [{ name: "itemsViewed" }, { name: "itemsAddedToCart" }, { name: "itemsPurchased" }, { name: "itemRevenue" }],
    orderBys: [{ metric: { metricName: orderMetric }, desc: true }],
    limit: Math.min(Math.max(p.limit || 25, 1), 250)
  };
  const filters = [{ filter: { fieldName: "sessionSource", stringFilter: { matchType: "CONTAINS", value: p.sourceContains, caseSensitive: false } } }];
  if (p.nameContains) filters.push({ filter: { fieldName: "itemName", stringFilter: { matchType: "CONTAINS", value: p.nameContains, caseSensitive: false } } });
  body.dimensionFilter = filters.length === 1 ? filters[0] : { andGroup: { expressions: filters } };

  const data = await ga4Fetch(propertyId, accessToken, body);
  const byItem = {};
  for (const row of data.rows || []) {
    const id = row.dimensionValues[0].value;
    const name = row.dimensionValues[1].value;
    const rangeIdx = hasComparison ? row.dimensionValues[2].value : "date_range_0";
    const m = {
      viewed: parseInt(row.metricValues[0].value) || 0,
      addedToCart: parseInt(row.metricValues[1].value) || 0,
      purchased: parseInt(row.metricValues[2].value) || 0,
      revenue: parseFloat(row.metricValues[3].value) || 0
    };
    if (!byItem[id]) byItem[id] = { id, name, current: null, previous: null };
    if (rangeIdx === "date_range_0") byItem[id].current = m;
    else byItem[id].previous = m;
  }
  const list = Object.values(byItem).map((it) => ({
    id: it.id,
    name: it.name,
    ...(it.current || { viewed: 0, addedToCart: 0, purchased: 0, revenue: 0 }),
    ...(hasComparison ? { previousPeriod: it.previous || { viewed: 0, addedToCart: 0, purchased: 0, revenue: 0 } } : {})
  }));
  const total = data.rowCount || 0;
  return { rows: list, totalRowsInGA4: total, moreRowsExist: total > (data.rows || []).length };
}


// ── Alat 4: spisak svih dostupnih GA4 metrika i dimenzija za ovaj nalog (ukljucujuci custom polja) ──
async function execListFields(propertyId, accessToken, p) {
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}/metadata`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || JSON.stringify(data));
  const q = String(p.search || "").toLowerCase().trim();
  const pick = (arr) => (arr || [])
    .filter((f) => !q || String(f.apiName).toLowerCase().includes(q) || String(f.uiName || "").toLowerCase().includes(q) || String(f.category || "").toLowerCase().includes(q))
    .map((f) => ({ apiName: f.apiName, name: f.uiName, category: f.category, ...(f.customDefinition ? { custom: true } : {}) }));
  const dims = pick(data.dimensions), mets = pick(data.metrics);
  const cap = 120;
  return {
    dimensions: dims.slice(0, cap), metrics: mets.slice(0, cap),
    note: (dims.length > cap || mets.length > cap) ? "Lista je skracena - suzi pretragu parametrom search." : undefined
  };
}

// ── Alat 5: opsti GA4 izvestaj (bilo koje dimenzije i metrike koje nalog ima) ──
async function execRunReport(propertyId, accessToken, p) {
  const dims = (Array.isArray(p.dimensions) ? p.dimensions : []).slice(0, 5);
  const mets = (Array.isArray(p.metrics) ? p.metrics : []).slice(0, 8);
  if (!mets.length) return { error: "Potrebna je bar jedna metrika." };
  const dateRanges = [{ startDate: p.startDate, endDate: p.endDate }];
  const hasComparison = !!(p.previousStartDate && p.previousEndDate);
  if (hasComparison) dateRanges.push({ startDate: p.previousStartDate, endDate: p.previousEndDate });
  const body = {
    dateRanges,
    dimensions: dims.map((name) => ({ name })),
    metrics: mets.map((name) => ({ name })),
    limit: Math.min(Math.max(p.limit || 25, 1), 250)
  };
  if (p.orderBy) {
    body.orderBys = [mets.includes(p.orderBy)
      ? { metric: { metricName: p.orderBy }, desc: p.orderDesc !== false }
      : { dimension: { dimensionName: p.orderBy }, desc: p.orderDesc === true }];
  }
  const matchMap = { contains: "CONTAINS", exact: "EXACT", begins_with: "BEGINS_WITH", ends_with: "ENDS_WITH" };
  const filters = (Array.isArray(p.filters) ? p.filters : []).slice(0, 5).filter((f) => f && f.field && f.value != null).map((f) => ({
    filter: { fieldName: f.field, stringFilter: { matchType: matchMap[f.match] || "CONTAINS", value: String(f.value), caseSensitive: false } }
  }));
  if (filters.length === 1) body.dimensionFilter = filters[0];
  else if (filters.length > 1) body.dimensionFilter = { andGroup: { expressions: filters } };

  const data = await ga4Fetch(propertyId, accessToken, body);
  const dimHeaders = (data.dimensionHeaders || []).map((h) => h.name);
  const metHeaders = (data.metricHeaders || []).map((h) => h.name);
  const rows = (data.rows || []).map((row) => {
    const o = {};
    row.dimensionValues.forEach((v, i) => { o[dimHeaders[i] || `dim${i}`] = v.value; });
    row.metricValues.forEach((v, i) => { const n = parseFloat(v.value); o[metHeaders[i] || `met${i}`] = isNaN(n) ? v.value : n; });
    return o;
  });
  const total = data.rowCount || 0;
  return {
    rows,
    ...(hasComparison ? { note: "Kolona dateRange: date_range_0 = trenutni period, date_range_1 = prethodni period." } : {}),
    totalRowsInGA4: total,
    moreRowsExist: total > rows.length
  };
}

const tools = [
  {
    name: "query_products",
    description: "Vraća GA4 e-commerce metrike na nivou proizvoda (pregledi, dodavanja u korpu, kupovine, prihod) za dati period. Opciono filtrira po nazivu proizvoda i opciono poredi sa prethodnim periodom.",
    input_schema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Početak perioda. Format 'YYYY-MM-DD' ili GA4 relativni izraz kao '30daysAgo', '7daysAgo', 'yesterday', 'today'." },
        endDate: { type: "string", description: "Kraj perioda, isti format kao startDate." },
        previousStartDate: { type: "string", description: "Opciono - početak perioda za poređenje (za pitanja o rastu/padu)." },
        previousEndDate: { type: "string", description: "Opciono - kraj perioda za poređenje." },
        nameContains: { type: "string", description: "Opciono - vraća samo proizvode čiji naziv sadrži ovaj tekst." },
        orderBy: { type: "string", enum: ["viewed", "addedToCart", "purchased", "revenue"], description: "Metrika po kojoj se sortira, opadajuće." },
        limit: { type: "integer", description: "Maksimalan broj proizvoda, podrazumevano 10, maksimalno 50." }
      },
      required: ["startDate", "endDate"]
    }
  },
  {
    name: "query_campaigns",
    description: "Vraća GA4 metrike na nivou kampanje/saobraćaja (sesije, kupovine = broj transakcija, prihod) za dati period. Opciono filtrira po nazivu kampanje (sadrži tekst) ili izvoru saobraćaja, opciono poredi sa prethodnim periodom.",
    input_schema: {
      type: "object",
      properties: {
        startDate: { type: "string" },
        endDate: { type: "string" },
        previousStartDate: { type: "string" },
        previousEndDate: { type: "string" },
        campaignNameContains: { type: "string", description: "Opciono - vraća samo kampanje čiji naziv sadrži ovaj tekst." },
        sourceContains: { type: "string", description: "Opciono - filtrira po izvoru, npr 'facebook', 'google', 'tiktok'." },
        orderBy: { type: "string", enum: ["sessions", "purchases", "revenue"] },
        limit: { type: "integer" }
      },
      required: ["startDate", "endDate"]
    }
  },
  {
    name: "query_products_by_source",
    description: "Vraća GA4 e-commerce metrike na nivou proizvoda, FILTRIRANO po izvoru saobraćaja (npr. samo Meta/Facebook, samo Google, samo TikTok). Koristi OVAJ alat (ne query_products) kad pitanje kombinuje proizvod I izvor/platformu istovremeno (npr. 'koji proizvod je najprodavaniji preko Meta oglasa', 'prihod od X proizvoda sa Google-a').",
    input_schema: {
      type: "object",
      properties: {
        startDate: { type: "string" },
        endDate: { type: "string" },
        previousStartDate: { type: "string" },
        previousEndDate: { type: "string" },
        sourceContains: { type: "string", description: "OBAVEZNO - filtrira po izvoru saobraćaja, npr 'facebook' ili 'instagram' za Meta, 'google' za Google, 'tiktok' za TikTok." },
        nameContains: { type: "string", description: "Opciono - dodatno filtrira proizvode čiji naziv sadrži ovaj tekst." },
        orderBy: { type: "string", enum: ["viewed", "addedToCart", "purchased", "revenue"] },
        limit: { type: "integer" }
      },
      required: ["startDate", "endDate", "sourceContains"]
    }
  },
  {
    name: "list_available_fields",
    description: "Vraća spisak GA4 dimenzija i metrika dostupnih za ovaj nalog (apiName, naziv, kategorija; custom polja klijenta su oznacena). Koristi ga kad nisi siguran kako se tacno zove polje za run_report, ili kad pitanje trazi nesto neuobicajeno/custom. Parametar search suzava listu (npr. 'advertiser', 'device', 'country', 'landing', 'event').",
    input_schema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Opciono - deo naziva ili kategorije polja, npr. 'advertiser' (Google Ads trosak), 'device', 'country', 'page', 'event', 'user'." }
      }
    }
  },
  {
    name: "run_report",
    description: "Opsti GA4 izvestaj sa bilo kojim dimenzijama i metrikama koje nalog ima. Koristi ga za sve sto tri specijalizovana alata ne pokrivaju: kanali (sessionDefaultChannelGroup), izvor/medijum (sessionSourceMedium), uredjaji (deviceCategory), zemlje/gradovi (country, city), landing stranice (landingPage), kretanje po danima (date), dogadjaji (eventName), korisnici (totalUsers, newUsers), angazovanost (engagementRate, bounceRate), Google Ads trosak i ROAS iz GA4 (advertiserAdCost, advertiserAdClicks, advertiserAdImpressions, returnOnAdSpend, sa dimenzijom sessionGoogleAdsCampaignName), kategorije proizvoda (itemCategory). Nazive polja uvek pisi kao GA4 apiName. Ako GA4 vrati gresku o nekompatibilnim poljima, promeni kombinaciju i pokusaj ponovo.",
    input_schema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Pocetak perioda (YYYY-MM-DD ili '30daysAgo', '7daysAgo', 'yesterday', 'today')." },
        endDate: { type: "string" },
        previousStartDate: { type: "string", description: "Opciono - pocetak perioda za poredjenje." },
        previousEndDate: { type: "string" },
        dimensions: { type: "array", items: { type: "string" }, description: "Do 5 GA4 dimenzija (apiName), npr. ['sessionDefaultChannelGroup'] ili ['date']. Moze i prazno za ukupan zbir." },
        metrics: { type: "array", items: { type: "string" }, description: "1 do 8 GA4 metrika (apiName), npr. ['sessions','totalRevenue','transactions']." },
        filters: {
          type: "array",
          description: "Opciono - do 5 filtera po dimenzijama (svi moraju da vaze).",
          items: {
            type: "object",
            properties: {
              field: { type: "string", description: "GA4 dimenzija (apiName)." },
              match: { type: "string", enum: ["contains", "exact", "begins_with", "ends_with"] },
              value: { type: "string" }
            },
            required: ["field", "value"]
          }
        },
        orderBy: { type: "string", description: "Opciono - metrika ili dimenzija po kojoj se sortira." },
        orderDesc: { type: "boolean", description: "Opciono - opadajuce (podrazumevano za metrike)." },
        limit: { type: "integer", description: "Broj redova, podrazumevano 25, najvise 250." }
      },
      required: ["startDate", "endDate", "metrics"]
    }
  }
];

function buildSystemPrompt(sr, todayStr, clientName, currency) {
  if (sr) {
    return `Ti si AI asistent koji odgovara na pitanja o GA4 (Google Analytics 4) podacima za e-commerce sajt klijenta "${clientName}". Današnji datum je ${todayStr}. VAŽNO: svi novčani iznosi koje dobiješ od alata su u valuti ${currency} - kad navodiš iznose u odgovoru, uvek koristi ovu valutu (npr. "${currency} 123" ili odgovarajući simbol ako postoji), NIKAD ne pretpostavljaj drugu valutu poput EUR ako klijent koristi nešto drugo.

Imaš pet alata za dobijanje stvarnih podataka (detalji u pravilima ispod). NIKAD ne izmišljaj brojeve - uvek pozovi odgovarajući alat da dobiješ prave podatke pre nego što odgovoriš.

Pravila:
- Piši isključivo na srpskom jeziku, ekavski (ne "prosječan" već "prosečan", ne "također" već "takođe", ne "riječi" već "reči", ne "tjedan" već "nedelja").
- Ne koristi markdown formatiranje (bez **, #, tabela) - piši običnim, kratkim tekstom.
- Budi koncizan - obično je 2-4 rečenice dovoljno, osim ako pitanje eksplicitno traži listu/nabrajanje.
- Ako je pitanje nejasno (npr. "najbolji proizvod" bez definisanog merila), izaberi razumnu pretpostavku (npr. po prihodu) i to kratko napomeni ("Gledao sam po prihodu - javi ako si mislio nešto drugo").
- Ako pitanje traži nešto što GA4 ne prati (profit, marža, plate, zalihe i slično), jasno reci da GA4 to ne prati, i predloži šta GA4 STVARNO zna da pokaže umesto toga.
- Troškove oglašavanja GA4 ima SAMO kad je nalog povezan sa Google Ads: tada preko run_report postoje metrike advertiserAdCost (trošak), advertiserAdClicks, advertiserAdImpressions i returnOnAdSpend (ROAS), uz dimenziju sessionGoogleAdsCampaignName za raščlanjavanje po kampanji. Ako te metrike vrate 0 ili grešku, reci da podaci o trošku nisu dostupni u GA4 za ovaj nalog. Trošak Meta i drugih platformi obično NIJE u GA4 - to jasno reci, ne izmišljaj.
- Ako za traženi period/proizvod/kampanju nema podataka, jasno to reci - nikad ne izmišljaj brojeve.
- Imaš TRI alata: query_products (proizvod-nivo, bez filtera po izvoru), query_campaigns (kampanja/saobraćaj-nivo), i query_products_by_source (proizvod-nivo, ALI filtrirano po konkretnom izvoru/platformi). Ako pitanje pominje SAMO "kampanju" ili izvor/kanal (bez konkretnog proizvoda), koristi query_campaigns. Ako pitanje pominje SAMO "proizvod" (bez izvora/platforme), koristi query_products. Ako pitanje KOMBINUJE proizvod I izvor/platformu istovremeno (npr. "koji proizvod je najprodavaniji preko Meta oglasa"), koristi query_products_by_source.
- Pored ta tri, imaš i run_report (opšti GA4 izveštaj sa bilo kojim dimenzijama i metrikama) i list_available_fields (spisak polja koja nalog ima). Za pitanja o proizvodima i kampanjama prvo koristi tri specijalizovana alata. Za SVE ostalo (kanali, izvor/medijum, uređaji, zemlje, gradovi, landing stranice, kretanje po danima, događaji, korisnici, angažovanost, Google Ads trošak i ROAS iz GA4, kategorije proizvoda) koristi run_report. Ako nisi siguran kako se polje tačno zove, ili pitanje traži nešto neuobičajeno (custom polja klijenta), prvo pozovi list_available_fields sa kratkim search pojmom.
- Svaki alat vraća moreRowsExist i totalRowsInGA4. Ako je moreRowsExist=true a pitanje traži ukupno ili "sve", pozovi alat ponovo sa većim limitom (do 250) ili preciznijim filterom umesto da korisniku pričaš o ograničenjima. Tek ako ni 250 redova nije dovoljno, kratko napomeni da je prikazan deo.
- Metrika "kupovine" (purchases/transactions) je broj stvarnih kupovina, ne svih konverzija/ciljeva.
- Za pitanja o rastu/padu/promeni u odnosu na prethodni period, uvek prosledi i previousStartDate/previousEndDate alatu da dobiješ oba perioda u jednom pozivu.
- Ako alat vrati više redova sa sličnim/istim osnovnim nazivom proizvoda (varijante - npr. različite boje ili veličine, svaka sa svojim ID-om), NIKAD ih sam ne sabiraj u odgovoru. Navedi tačan broj za tačno onaj red (ID) koji odgovara pitanju, i ako postoji više sličnih varijanti, to pomeni ("postoji i nekoliko drugih varijanti ovog proizvoda sa sličnim imenom").
- Za period NIKAD sam ne računaj apsolutne datume - uvek koristi GA4-ove ugrađene relativne izraze (npr. "poslednjih 30 dana" = startDate:"30daysAgo", endDate:"yesterday"; "poslednjih 7 dana" = startDate:"7daysAgo", endDate:"yesterday"). Ovo garantuje da se tvoj odgovor tačno poklapa sa onim što app inače prikazuje. Apsolutne datume (YYYY-MM-DD) koristi SAMO ako korisnik eksplicitno navede tačan datum ili mesec.
- Kad nabrajaš LISTU proizvoda (ne samo kad pričaš o jednom), UVEK pored svakog naziva navedi i njegov ID u zagradi (npr. "Crocs Bayaband (207019-001)"), tačno onako kako ga alat vrati - ovo omogućava korisniku da proveri tačan proizvod u ostatku app-a.
- Kad pitanje traži UKUPAN zbir ili "sve" stavke koje ispunjavaju neki uslov (ne "top N"), pozovi alat sa velikim limit (npr. 50), da ne propustiš manje stavke koje se ne vide u "top 10" podrazumevanom pozivu.
- NIKAD ne tvrdi da "ostale stavke nemaju podatke/prihod" osim ako to nisi STVARNO proverio pozivom sa dovoljno velikim limitom da pokrije sve. Ako alat vrati tačno onoliko redova koliko si tražio kao limit, to je znak da MOŽDA ima još - ne pretpostavljaj da nema, ili to jasno napomeni kao pretpostavku.
- Uvek navodi POJEDINAČNE brojeve TAČNO onako kako ih alat vrati za svaki red. ALI ako korisnik eksplicitno traži UKUPAN zbir/sumu preko grupe stavki (npr. "koliko su te kampanje ukupno donele", "saberi mi to"), slobodno saberi TAČNE vrednosti koje je alat vratio i daj ukupan broj - to je osnovna aritmetika, ne izmišljanje. Ono što NIKAD ne radiš je da TIHO spojiš različite proizvod-varijante u jedan broj kad pitanje traži JEDAN konkretan proizvod (npr. "najbolji proizvod") - tu svaki red ostaje poseban, osim ako korisnik eksplicitno ne traži zbir svih varijanti.`;
  }
  return `You are an AI assistant answering questions about GA4 (Google Analytics 4) data for client "${clientName}"'s e-commerce site. Today's date is ${todayStr}. IMPORTANT: all monetary amounts you get from the tools are in ${currency} currency - when stating amounts in your answer, always use this currency (e.g. "${currency} 123" or the appropriate symbol if one exists), NEVER assume a different currency like EUR if the client uses something else.

You have five tools to get real data (details in the rules below). NEVER make up numbers - always call the relevant tool to get real data before answering.

Rules:
- Write in English, no markdown formatting (no **, #, tables) - plain, concise text.
- Be concise - 2-4 sentences is usually enough, unless the question explicitly asks for a list.
- If the question is ambiguous (e.g. "best product" with no defined metric), pick a reasonable assumption (e.g. by revenue) and briefly note it ("I looked at this by revenue - let me know if you meant something else").
- If the question asks for something GA4 doesn't track (profit, margin, payroll, inventory, etc.), clearly say GA4 doesn't track that, and suggest what GA4 actually can show instead.
- GA4 has ad COSTS only when the property is linked to Google Ads: then run_report offers the metrics advertiserAdCost (cost), advertiserAdClicks, advertiserAdImpressions and returnOnAdSpend (ROAS), with the dimension sessionGoogleAdsCampaignName for a per-campaign breakdown. If those return 0 or an error, say cost data isn't available in GA4 for this property. Meta and other platforms' costs are usually NOT in GA4 - say so clearly, don't make anything up.
- If there's no data for the requested period/product/campaign, clearly say so - never make up numbers.
- You have THREE tools: query_products (product-level, no source filter), query_campaigns (campaign/traffic-level), and query_products_by_source (product-level, BUT filtered by a specific source/platform). If the question mentions ONLY a "campaign" or traffic source/channel (no specific product), use query_campaigns. If it mentions ONLY a "product" (no source/platform), use query_products. If the question COMBINES a product AND a source/platform (e.g. "which product sells best via Meta ads"), use query_products_by_source.
- Besides those three, you also have run_report (a general GA4 report with any dimensions and metrics) and list_available_fields (the list of fields the property has). For product and campaign questions use the three specialized tools first. For EVERYTHING else (channels, source/medium, devices, countries, cities, landing pages, daily trends, events, users, engagement, Google Ads cost and ROAS from GA4, product categories) use run_report. If you're not sure of a field's exact name, or the question asks for something unusual (client custom fields), call list_available_fields with a short search term first.
- Every tool returns moreRowsExist and totalRowsInGA4. If moreRowsExist=true and the question asks for a total or "all", call the tool again with a larger limit (up to 250) or a narrower filter instead of telling the user about limits. Only if even 250 rows aren't enough, briefly note that a subset is shown.
- The "purchases" metric (transactions) is the number of actual purchases, not all conversions/goals.
- For growth/drop/change questions, always pass previousStartDate/previousEndDate to the tool to get both periods in one call.
- If the tool returns multiple rows with similar/identical base product names (variants - e.g. different colors or sizes, each with its own ID), NEVER sum them yourself in your answer. State the exact number for the specific row (ID) that matches the question, and if several similar variants exist, mention that ("there are also a few other variants of this product with a similar name").
- Never compute absolute dates yourself for periods - always use GA4's built-in relative expressions (e.g. "last 30 days" = startDate:"30daysAgo", endDate:"yesterday"; "last 7 days" = startDate:"7daysAgo", endDate:"yesterday"). This guarantees your answer exactly matches what the app otherwise displays. Only use absolute dates (YYYY-MM-DD) if the user explicitly names a specific date or month.
- When listing MULTIPLE products (not just discussing one), ALWAYS include each product's ID in parentheses next to its name (e.g. "Crocs Bayaband (207019-001)"), exactly as returned by the tool - this lets the user verify the exact product elsewhere in the app.
- When the question asks for a TOTAL sum or "all" items matching a condition (not "top N"), call the tool with a large limit (e.g. 50), so you don't miss smaller items that wouldn't show up in a default "top 10" call.
- NEVER claim "other items have no data/revenue" unless you actually verified it by calling with a large enough limit to cover everything. If the tool returns exactly as many rows as your limit, that's a sign there MIGHT be more - don't assume there isn't, or clearly flag it as an assumption.
- Always state INDIVIDUAL numbers EXACTLY as returned by the tool for each row. BUT if the user explicitly asks for a TOTAL sum across a group of items (e.g. "how much did these campaigns earn in total", "add that up for me"), feel free to sum the exact values the tool returned and give the total - that's basic arithmetic, not making things up. What you NEVER do is silently merge different product variants into one figure when the question asks about ONE specific product (e.g. "best product") - each row stays separate there, unless the user explicitly asks for the sum across all variants.`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "API key not configured" });

  const { client_id, question, history, lang } = req.body || {};
  if (!client_id || !question) return res.status(400).json({ error: "Missing client_id or question" });
  const sr = lang !== "en";

  const supaHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  try {
    const connR = await fetch(
      `${SUPABASE_URL}/rest/v1/ga4_connections?client_id=eq.${client_id}&select=property_id,refresh_token,currency_code`,
      { headers: supaHeaders }
    );
    const connData = await connR.json();
    if (!connData.length) return res.status(404).json({ error: "GA4 nije povezan za ovog klijenta" });
    const { property_id, refresh_token, currency_code } = connData[0];
    const currency = currency_code || "EUR";
    const accessToken = await refreshAccessToken(refresh_token);

    const clientR = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${client_id}&select=name`, { headers: supaHeaders });
    const clientData = await clientR.json();
    const clientName = clientData[0]?.name || "N/A";

    const today = new Date().toISOString().split("T")[0];
    const systemPrompt = buildSystemPrompt(sr, today, clientName, currency);

    let messages = [
      ...(Array.isArray(history) ? history.map((h) => ({ role: h.role, content: h.text })) : []),
      { role: "user", content: question }
    ];

    let finalText = "";
    for (let step = 0; step < 8; step++) {
      const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          system: systemPrompt,
          tools,
          messages
        })
      });
      const data = await apiRes.json();
      if (!apiRes.ok) throw new Error(data.error?.message || "Anthropic API error");

      if (data.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: data.content });
        const toolResults = [];
        for (const block of data.content) {
          if (block.type !== "tool_use") continue;
          let result;
          try {
            if (block.name === "query_products") result = await execQueryProducts(property_id, accessToken, block.input);
            else if (block.name === "query_campaigns") result = await execQueryCampaigns(property_id, accessToken, block.input);
            else if (block.name === "query_products_by_source") result = await execQueryProductsBySource(property_id, accessToken, block.input);
            else if (block.name === "list_available_fields") result = await execListFields(property_id, accessToken, block.input || {});
            else if (block.name === "run_report") result = await execRunReport(property_id, accessToken, block.input || {});
            else result = { error: "Unknown tool" };
          } catch (e) {
            result = { error: e.message };
          }
          let content = JSON.stringify(result);
          if (content.length > 60000) content = content.slice(0, 60000) + ' ... [skraceno - koristi manji limit ili precizniji filter]';
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content });
        }
        messages.push({ role: "user", content: toolResults });
        continue;
      } else {
        finalText = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
        break;
      }
    }

    if (!finalText) {
      finalText = sr
        ? "Nisam uspeo da sastavim odgovor u razumnom broju koraka. Pokušaj da preformulišeš pitanje jednostavnije."
        : "I couldn't complete the answer in a reasonable number of steps. Try rephrasing your question more simply.";
    }

    return res.status(200).json({ answer: finalText });
  } catch (err) {
    if (String(err.message || "").includes("invalid_grant")) {
      return res.status(200).json({ answer: sr
        ? "Veza sa GA4 nalogom ovog klijenta je istekla. U Clients otkači GA4 za ovog klijenta i ponovo ga poveži, pa postavi pitanje ponovo."
        : "The GA4 connection for this client has expired. In Clients, disconnect GA4 for this client and connect it again, then ask your question again." });
    }
    return res.status(500).json({ error: err.message });
  }
}
