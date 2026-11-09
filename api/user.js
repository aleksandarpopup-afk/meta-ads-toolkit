// api/user.js — vraca ID radnog prostora prijavljenog korisnika.
// Ranije je pravio anonimnog korisnika svakome ko pozove adresu; sada se radni prostor
// pravi samo kroz prijavu (api/me.js), pa ovde niko ne moze da puni bazu praznim redovima.
import { guard } from "./_lib/auth.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).end();
  const ctx = await guard(req, res);
  if (!ctx) return;
  return res.status(200).json({ id: ctx.membership.workspace_id });
}
