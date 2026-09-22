const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const APP_URL = process.env.APP_URL;
const REDIRECT_URI = `${APP_URL}/api/ga4-callback`;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${APP_URL}?ga4_error=${encodeURIComponent(error)}&mod=10`);
  }
  if (!code || !state) {
    return res.redirect(`${APP_URL}?ga4_error=missing_code&mod=10`);
  }

  let client_id, uid;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64").toString());
    client_id = decoded.client_id;
    uid = decoded.uid;
  } catch (e) {
    return res.redirect(`${APP_URL}?ga4_error=bad_state&mod=10`);
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
      // Korisnik je već ranije odobrio pristup pa Google ovaj put nije vratio refresh_token
      return res.redirect(`${APP_URL}?ga4_error=no_refresh_token&mod=10`);
    }

    // 2. Lista GA4 naloga (properties) koje ovaj korisnik ima
    const propsRes = await fetch(
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const propsData = await propsRes.json();
    if (!propsRes.ok) throw new Error(JSON.stringify(propsData));

    const properties = [];
    for (const account of propsData.accountSummaries || []) {
      for (const prop of account.propertySummaries || []) {
        properties.push({
          property_id: prop.property?.replace("properties/", ""),
          property_name: prop.displayName,
          account_name: account.displayName
        });
      }
    }

    // 3. Parkiramo refresh_token + listu naloga privremeno (isti mehanizam kao Bookmark Connector)
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

    return res.redirect(`${APP_URL}?ga4_setup=${tempId}&mod=10&uid=${uid}`);
  } catch (err) {
    return res.redirect(`${APP_URL}?ga4_error=${encodeURIComponent(err.message)}&mod=10`);
  }
}
