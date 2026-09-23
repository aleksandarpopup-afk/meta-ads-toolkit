const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const APP_URL = process.env.APP_URL;
const REDIRECT_URI = `${APP_URL}/api/google-ads-callback`;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GADS_VERSION = "v25";

async function gadsSearch(customerId, accessToken, query, loginCustomerId) {
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;
  const r = await fetch(`https://googleads.googleapis.com/${GADS_VERSION}/customers/${customerId}/googleAds:search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data));
  return data;
}

export default async function handler(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${APP_URL}?gads_error=${encodeURIComponent(error)}&mod=10`);
  }
  if (!code || !state) {
    return res.redirect(`${APP_URL}?gads_error=missing_code&mod=10`);
  }

  let client_id, uid;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64").toString());
    client_id = decoded.client_id;
    uid = decoded.uid;
  } catch (e) {
    return res.redirect(`${APP_URL}?gads_error=bad_state&mod=10`);
  }

  try {
    // 1. Razmena koda za tokene
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code"
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(JSON.stringify(tokenData));

    const { access_token, refresh_token } = tokenData;
    if (!refresh_token) {
      return res.redirect(`${APP_URL}?gads_error=no_refresh_token&mod=10`);
    }

    // 2. Lista naloga koje ovaj Google nalog direktno vidi (pojedinačni ili Manager)
    const listRes = await fetch(`https://googleads.googleapis.com/${GADS_VERSION}/customers:listAccessibleCustomers`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const listData = await listRes.json();
    if (!listRes.ok) throw new Error(JSON.stringify(listData));
    const topLevelIds = (listData.resourceNames || []).map((rn) => rn.replace("customers/", ""));

    // 3. Za svaki - proveri da li je pojedinačan nalog ili Manager (MCC), i ako je MCC, izlistaj njegove klijente
    const properties = [];
    for (const topId of topLevelIds) {
      try {
        const selfData = await gadsSearch(
          topId,
          access_token,
          "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager FROM customer LIMIT 1"
        );
        const row = selfData.results?.[0]?.customer;
        if (!row) continue;

        if (!row.manager) {
          properties.push({
            customer_id: topId,
            manager_id: null,
            account_name: row.descriptiveName || `Nalog ${topId}`,
            currency_code: row.currencyCode || "EUR"
          });
        } else {
          const childData = await gadsSearch(
            topId,
            access_token,
            "SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.manager, customer_client.level FROM customer_client WHERE customer_client.level <= 1",
            topId
          );
          for (const r2 of childData.results || []) {
            const cc = r2.customerClient;
            if (!cc || cc.manager) continue; // preskačemo samog menadžera i ugnježdene pod-menadžere (za sad)
            properties.push({
              customer_id: cc.id,
              manager_id: topId,
              account_name: cc.descriptiveName || `Nalog ${cc.id}`,
              currency_code: cc.currencyCode || "EUR"
            });
          }
        }
      } catch (e) {
        // Preskačemo naloge do kojih ne možemo da dođemo, ne rušimo ceo proces
      }
    }

    // 4. Parkiramo refresh_token + listu naloga privremeno (isti mehanizam kao GA4)
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const tempPayload = { client_id, uid, refresh_token, properties };

    const headers = {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "return=representation"
    };

    const tempRes = await fetch(`${SUPABASE_URL}/rest/v1/temp_imports`, {
      method: "POST",
      headers,
      body: JSON.stringify({ data: JSON.stringify(tempPayload), expires_at })
    });
    const tempResult = await tempRes.json();
    if (!tempRes.ok) throw new Error(JSON.stringify(tempResult));

    const tempId = tempResult[0].id;
    return res.redirect(`${APP_URL}?gads_setup=${tempId}&mod=10&uid=${uid}`);
  } catch (err) {
    return res.redirect(`${APP_URL}?gads_error=${encodeURIComponent(err.message)}&mod=10`);
  }
}
