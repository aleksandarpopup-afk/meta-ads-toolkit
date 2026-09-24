const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { client_id, campaign_id, days, from, to } = req.query;
  if (!client_id || !campaign_id) return res.status(400).json({ error: "Missing client_id or campaign_id" });

  let startStr, endStr;
  if (from && to) {
    startStr = from;
    endStr = to;
  } else {
    const periodDays = parseInt(days) || 30;
    const endDateTmp = new Date();
    endDateTmp.setDate(endDateTmp.getDate() - 1);
    const startDateTmp = new Date();
    startDateTmp.setDate(startDateTmp.getDate() - periodDays);
    startStr = startDateTmp.toISOString().split("T")[0];
    endStr = endDateTmp.toISOString().split("T")[0];
  }

  const supaHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  try {
    const ga4ConnR = await fetch(
      `${SUPABASE_URL}/rest/v1/ga4_connections?client_id=eq.${client_id}&select=property_id,refresh_token,currency_code`,
      { headers: supaHeaders }
    );
    const ga4ConnData = await ga4ConnR.json();
    if (!ga4ConnData.length) return res.status(404).json({ error: "no_ga4" });
    const { property_id, refresh_token, currency_code } = ga4ConnData[0];
    const currency = currency_code || "EUR";

    const accessToken = await refreshAccessToken(refresh_token);

    const report = await ga4Fetch(property_id, accessToken, {
      dateRanges: [{ startDate: startStr, endDate: endStr }],
      dimensions: [{ name: "itemId" }, { name: "itemName" }],
      metrics: [
        { name: "itemsViewed" },
        { name: "itemsAddedToCart" },
        { name: "itemsPurchased" },
        { name: "itemRevenue" }
      ],
      dimensionFilter: {
        filter: { fieldName: "sessionGoogleAdsCampaignId", stringFilter: { matchType: "EXACT", value: String(campaign_id) } }
      },
      orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }],
      limit: 500
    });

    const products = (report.rows || []).map((row) => {
      const viewed = parseInt(row.metricValues[0].value) || 0;
      const addedToCart = parseInt(row.metricValues[1].value) || 0;
      const purchased = parseInt(row.metricValues[2].value) || 0;
      const revenue = parseFloat(row.metricValues[3].value) || 0;
      return {
        id: row.dimensionValues[0].value,
        name: row.dimensionValues[1].value,
        viewed,
        addedToCart,
        purchased,
        revenue,
        viewToCartRate: viewed > 0 ? (addedToCart / viewed) * 100 : 0,
        cartToPurchaseRate: addedToCart > 0 ? (purchased / addedToCart) * 100 : 0,
        conversionRate: viewed > 0 ? (purchased / viewed) * 100 : 0
      };
    });

    return res.status(200).json({ currency, products });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
