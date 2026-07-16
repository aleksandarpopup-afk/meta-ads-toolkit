export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const API_KEY = process.env.VITE_ANTHROPIC_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: "API key not configured" });

  try {
    const { messages, max_tokens = 2000 } = req.body;
    if (!messages) return res.status(400).json({ error: "Missing messages" });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens,
        messages
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "API error");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
