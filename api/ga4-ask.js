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
    limit: Math.min(p.limit || 10, 50)
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
  return Object.values(byItem).map((it) => ({
    id: it.id,
    name: it.name,
    ...(it.current || { viewed: 0, addedToCart: 0, purchased: 0, revenue: 0 }),
    ...(hasComparison ? { previousPeriod: it.previous || { viewed: 0, addedToCart: 0, purchased: 0, revenue: 0 } } : {})
  }));
}

// ── Alat 2: podaci na nivou kampanje/saobraćaja ──
async function execQueryCampaigns(propertyId, accessToken, p) {
  const dateRanges = [{ startDate: p.startDate, endDate: p.endDate }];
  const hasComparison = !!(p.previousStartDate && p.previousEndDate);
  if (hasComparison) dateRanges.push({ startDate: p.previousStartDate, endDate: p.previousEndDate });

  const orderMetricMap = { sessions: "sessions", conversions: "conversions", revenue: "totalRevenue" };
  const orderMetric = orderMetricMap[p.orderBy] || "totalRevenue";

  const body = {
    dateRanges,
    dimensions: [{ name: "sessionCampaignName" }, { name: "sessionSource" }],
    metrics: [{ name: "sessions" }, { name: "conversions" }, { name: "totalRevenue" }],
    orderBys: [{ metric: { metricName: orderMetric }, desc: true }],
    limit: Math.min(p.limit || 10, 50)
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
      conversions: parseFloat(row.metricValues[1].value) || 0,
      revenue: parseFloat(row.metricValues[2].value) || 0
    };
    if (!byCampaign[key]) byCampaign[key] = { name, source, current: null, previous: null };
    if (rangeIdx === "date_range_0") byCampaign[key].current = m;
    else byCampaign[key].previous = m;
  }
  return Object.values(byCampaign).map((c) => ({
    name: c.name,
    source: c.source,
    ...(c.current || { sessions: 0, conversions: 0, revenue: 0 }),
    ...(hasComparison ? { previousPeriod: c.previous || { sessions: 0, conversions: 0, revenue: 0 } } : {})
  }));
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
    description: "Vraća GA4 metrike na nivou kampanje/saobraćaja (sesije, konverzije, prihod) za dati period. Opciono filtrira po nazivu kampanje (sadrži tekst) ili izvoru saobraćaja, opciono poredi sa prethodnim periodom.",
    input_schema: {
      type: "object",
      properties: {
        startDate: { type: "string" },
        endDate: { type: "string" },
        previousStartDate: { type: "string" },
        previousEndDate: { type: "string" },
        campaignNameContains: { type: "string", description: "Opciono - vraća samo kampanje čiji naziv sadrži ovaj tekst." },
        sourceContains: { type: "string", description: "Opciono - filtrira po izvoru, npr 'facebook', 'google', 'tiktok'." },
        orderBy: { type: "string", enum: ["sessions", "conversions", "revenue"] },
        limit: { type: "integer" }
      },
      required: ["startDate", "endDate"]
    }
  }
];

function buildSystemPrompt(sr, todayStr, clientName) {
  if (sr) {
    return `Ti si AI asistent koji odgovara na pitanja o GA4 (Google Analytics 4) podacima za e-commerce sajt klijenta "${clientName}". Današnji datum je ${todayStr}.

Imaš dva alata za dobijanje stvarnih podataka: query_products (nivo proizvoda) i query_campaigns (nivo kampanje/saobraćaja). NIKAD ne izmišljaj brojeve - uvek pozovi odgovarajući alat da dobiješ prave podatke pre nego što odgovoriš.

Pravila:
- Piši isključivo na srpskom jeziku, ekavski (ne "prosječan" već "prosečan", ne "također" već "takođe", ne "riječi" već "reči", ne "tjedan" već "nedelja").
- Ne koristi markdown formatiranje (bez **, #, tabela) - piši običnim, kratkim tekstom.
- Budi koncizan - obično je 2-4 rečenice dovoljno, osim ako pitanje eksplicitno traži listu/nabrajanje.
- Ako je pitanje nejasno (npr. "najbolji proizvod" bez definisanog merila), izaberi razumnu pretpostavku (npr. po prihodu) i to kratko napomeni ("Gledao sam po prihodu - javi ako si mislio nešto drugo").
- Ako pitanje traži nešto što GA4 ne prati (profit, marža, troškovi, plate, zalihe i slično), jasno reci da GA4 to ne prati, i predloži šta GA4 STVARNO zna da pokaže umesto toga.
- Ako za traženi period/proizvod/kampanju nema podataka, jasno to reci - nikad ne izmišljaj brojeve.
- Ako pitanje pominje "kampanju" ili "izvor/kanal saobraćaja", koristi query_campaigns. Ako pominje "proizvod" ili konkretan artikal, koristi query_products.
- Za pitanja o rastu/padu/promeni u odnosu na prethodni period, uvek prosledi i previousStartDate/previousEndDate alatu da dobiješ oba perioda u jednom pozivu.
- Ako alat vrati više redova sa sličnim/istim osnovnim nazivom proizvoda (varijante - npr. različite boje ili veličine, svaka sa svojim ID-om), NIKAD ih sam ne sabiraj u odgovoru. Navedi tačan broj za tačno onaj red (ID) koji odgovara pitanju, i ako postoji više sličnih varijanti, to pomeni ("postoji i nekoliko drugih varijanti ovog proizvoda sa sličnim imenom").
- Za period NIKAD sam ne računaj apsolutne datume - uvek koristi GA4-ove ugrađene relativne izraze (npr. "poslednjih 30 dana" = startDate:"30daysAgo", endDate:"yesterday"; "poslednjih 7 dana" = startDate:"7daysAgo", endDate:"yesterday"). Ovo garantuje da se tvoj odgovor tačno poklapa sa onim što app inače prikazuje. Apsolutne datume (YYYY-MM-DD) koristi SAMO ako korisnik eksplicitno navede tačan datum ili mesec.
- Uvek navodi brojeve TAČNO onako kako ih alat vrati, red po red - nikad ne računaj svoje sabiranja/prosek preko više redova.`;
  }
  return `You are an AI assistant answering questions about GA4 (Google Analytics 4) data for client "${clientName}"'s e-commerce site. Today's date is ${todayStr}.

You have two tools to get real data: query_products (product-level) and query_campaigns (campaign/traffic-level). NEVER make up numbers - always call the relevant tool to get real data before answering.

Rules:
- Write in English, no markdown formatting (no **, #, tables) - plain, concise text.
- Be concise - 2-4 sentences is usually enough, unless the question explicitly asks for a list.
- If the question is ambiguous (e.g. "best product" with no defined metric), pick a reasonable assumption (e.g. by revenue) and briefly note it ("I looked at this by revenue - let me know if you meant something else").
- If the question asks for something GA4 doesn't track (profit, margin, costs, payroll, inventory, etc.), clearly say GA4 doesn't track that, and suggest what GA4 actually can show instead.
- If there's no data for the requested period/product/campaign, clearly say so - never make up numbers.
- If the question mentions a "campaign" or "traffic source/channel", use query_campaigns. If it mentions a "product" or specific item, use query_products.
- For growth/drop/change questions, always pass previousStartDate/previousEndDate to the tool to get both periods in one call.
- If the tool returns multiple rows with similar/identical base product names (variants - e.g. different colors or sizes, each with its own ID), NEVER sum them yourself in your answer. State the exact number for the specific row (ID) that matches the question, and if several similar variants exist, mention that ("there are also a few other variants of this product with a similar name").
- Never compute absolute dates yourself for periods - always use GA4's built-in relative expressions (e.g. "last 30 days" = startDate:"30daysAgo", endDate:"yesterday"; "last 7 days" = startDate:"7daysAgo", endDate:"yesterday"). This guarantees your answer exactly matches what the app otherwise displays. Only use absolute dates (YYYY-MM-DD) if the user explicitly names a specific date or month.
- Always state numbers EXACTLY as returned by the tool, row by row - never compute your own sums/averages across multiple rows.`;
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
      `${SUPABASE_URL}/rest/v1/ga4_connections?client_id=eq.${client_id}&select=property_id,refresh_token`,
      { headers: supaHeaders }
    );
    const connData = await connR.json();
    if (!connData.length) return res.status(404).json({ error: "GA4 nije povezan za ovog klijenta" });
    const { property_id, refresh_token } = connData[0];
    const accessToken = await refreshAccessToken(refresh_token);

    const clientR = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${client_id}&select=name`, { headers: supaHeaders });
    const clientData = await clientR.json();
    const clientName = clientData[0]?.name || "N/A";

    const today = new Date().toISOString().split("T")[0];
    const systemPrompt = buildSystemPrompt(sr, today, clientName);

    let messages = [
      ...(Array.isArray(history) ? history.map((h) => ({ role: h.role, content: h.text })) : []),
      { role: "user", content: question }
    ];

    let finalText = "";
    for (let step = 0; step < 5; step++) {
      const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
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
            else result = { error: "Unknown tool" };
          } catch (e) {
            result = { error: e.message };
          }
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
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
    return res.status(500).json({ error: err.message });
  }
}
