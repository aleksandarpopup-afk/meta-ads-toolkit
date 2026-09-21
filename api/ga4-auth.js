const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const APP_URL = "https://meta-ads-toolkit-a71e.vercel.app";
const REDIRECT_URI = `${APP_URL}/api/ga4-callback`;

export default async function handler(req, res) {
  const { client_id, uid } = req.query;

  if (!client_id || !uid) {
    return res.status(400).send("Nedostaje client_id ili uid");
  }

  // State nosi client_id i uid kroz ceo OAuth proces, da znamo za koga je ovo kad se korisnik vrati
  const state = Buffer.from(JSON.stringify({ client_id, uid })).toString("base64");

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    access_type: "offline",
    prompt: "consent",
    state
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  res.writeHead(302, { Location: googleAuthUrl });
  res.end();
}
