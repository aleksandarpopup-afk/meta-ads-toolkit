// api/analyze.js — posrednik ka Anthropic API-ju (koriste ga Health Check, AI zakljucci i uvoz u Report Studio-u)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  // Samo serverska varijabla (VITE_ varijable mogu zavrsiti u javnom kodu sajta)
  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    console.error("analyze: ANTHROPIC_API_KEY nije podesen");
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: "Missing messages" });
    // Gornja granica duzine odgovora (zastita od preskupih zahteva)
    const max_tokens = Math.min(Math.max(parseInt(req.body.max_tokens) || 2000, 1), 4000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens, messages }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("analyze: Anthropic API error", response.status, JSON.stringify(data).slice(0, 500));
      return res.status(500).json({ error: data.error?.message || "Anthropic API error" });
    }
    return res.status(200).json(data);
  } catch (error) {
    console.error("analyze: greska", error);
    return res.status(500).json({ error: error.message });
  }
}
