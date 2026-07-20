const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const APP_URL = "https://meta-ads-toolkit-a71e.vercel.app";

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday, 5=Friday, 6=Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isMonday = dayOfWeek === 1;
  const isFriday = dayOfWeek === 5;

  // Ne šalji vikendom
  if (isWeekend) {
    return res.status(200).json({ success: true, sent: 0, reason: "Weekend - skipped" });
  }

  const headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`
  };

  try {
    // Uzmi jedinstvene korisnike (ne subscriptione) da ne šaljemo duplikate
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?select=user_id`,
      { headers }
    );
    const allSubs = await r.json();
    
    // Deduplikuj user_id-eve
    const uniqueUserIds = [...new Set(allSubs.map(s => s.user_id))];
    
    let sent = 0;

    for (const userId of uniqueUserIds) {
      let title, body, url;

      if (isMonday) {
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        const fromDate = lastWeek.toISOString().split("T")[0];

        const ar = await fetch(
          `${SUPABASE_URL}/rest/v1/analyses?user_id=eq.${userId}&period_from=gte.${fromDate}&select=id&limit=1`,
          { headers }
        );
        const analyses = await ar.json();

        if (analyses.length > 0) {
          title = "📋 Weekly Report je spreman!";
          body = "Imam podatke za prošlu nedelju. Otvori Time Machine i generiši report!";
          url = `${APP_URL}?mod=11`;
        } else {
          title = "📋 Ponedeljak – Weekly Report";
          body = "Ubaci podatke za prošlu nedelju da ti napravim weekly report!";
          url = `${APP_URL}?mod=9`;
        }
      } else if (isFriday) {
        const ar = await fetch(
          `${SUPABASE_URL}/rest/v1/analyses?user_id=eq.${userId}&order=created_at.desc&limit=5&select=analysis_text,client_id`,
          { headers }
        );
        const analyses = await ar.json();

        if (analyses.length > 0) {
          const clientIds = [...new Set(analyses.map(a => a.client_id))];
          const cr = await fetch(
            `${SUPABASE_URL}/rest/v1/clients?id=in.(${clientIds.join(",")})&select=id,name`,
            { headers }
          );
          const clients = await cr.json();
          const clientMap = Object.fromEntries(clients.map(c => [c.id, c.name]));

          const spendParts = analyses.map(a => {
            const match = a.analysis_text.match(/spend[:\s]+[€$]?([0-9.,]+)|potrošnja[:\s]+[€$]?([0-9.,]+)/i);
            const dailySpend = match ? parseFloat((match[1] || match[2] || "0").replace(",", ".")) / 7 : 0;
            const weekendSpend = Math.round(dailySpend * 2.5);
            const clientName = clientMap[a.client_id] || "Klijent";
            return weekendSpend > 0 ? `${clientName} ~€${weekendSpend}` : null;
          }).filter(Boolean);

          if (spendParts.length > 0) {
            title = "⚠️ Vikend spend procena";
            body = `${spendParts.join(", ")}. Bazirano na poslednjim analizama.`;
            url = `${APP_URL}?mod=10`;
          } else {
            title = "📊 Petak – Proveri kampanje!";
            body = "Ubaci podatke da bih izračunao vikend spend!";
            url = `${APP_URL}?mod=9`;
          }
        } else {
          title = "📊 Petak – Proveri kampanje!";
          body = "Ubaci podatke da bih izračunao vikend spend!";
          url = `${APP_URL}?mod=9`;
        }
      } else {
        title = "📊 Dobro jutro!";
        body = "Vreme je da proveriš kampanje. Klikni bookmark i ubaci nove rezultate.";
        url = `${APP_URL}?mod=9`;
      }

      try {
        await fetch(`${APP_URL}/api/push-send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, title, body, url })
        });
        sent++;
      } catch (e) {}
    }

    return res.status(200).json({ success: true, sent, users: uniqueUserIds.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
