// api/ga4-auth.js — pocetak povezivanja GA4 naloga (preusmerava na Google).
// Ovo je obican link u pregledacu (bez prijave u zaglavlju), zato se ovde nista ne cita iz baze;
// "state" je potpisan, a povezivanje se zavrsava tek u /api/ga4-connect, koji trazi prijavu
// i proverava da klijent pripada radnom prostoru.
import { signState } from "./_lib/auth.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const APP_URL = process.env.APP_URL;
const REDIRECT_URI = `${APP_URL}/api/ga4-callback`;

export default async function handler(req, res) {
  const cid = Number(req.query.client_id);
  if (!Number.isInteger(cid) || cid <= 0) {
    return res.status(400).send("Nedostaje ili je neispravan client_id");
  }

  const state = signState({ client_id: cid });

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    access_type: "offline",
    prompt: "consent",
    state
  });

  res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  res.end();
}
