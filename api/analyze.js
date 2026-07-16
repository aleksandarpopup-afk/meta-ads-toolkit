export default async function handler(req, res) {
  console.log("=== /api/analyze called ===");
  console.log("Method:", req.method);
  console.log("API key present:", !!process.env.ANTHROPIC_API_KEY);
  console.log("VITE key present:", !!process.env.VITE_ANTHROPIC_API_KEY);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const API_KEY = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
  
  if (!API_KEY) {
    console.error("ERROR: No API key found!");
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    const { messages, max_tokens = 2000 } = req.body;
    
    if (!messages) {
      console.error("ERROR: No messages in request body");
      return res.status(400).json({ error: "Missing messages" });
    }

    console.log("Calling Anthropic API with", messages.length, "messages");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens,
        messages
      })
    });

    const data = await response.json();
    console.log("Anthropic response status:", response.status);
    
    if (!response.ok) {
      console.error("Anthropic API error:", JSON.stringify(data));
      return res.status(500).json({ error: data.error?.message || "Anthropic API error", details: data });
    }

    console.log("Success! Returning response.");
    return res.status(200).json(data);

  } catch (error) {
    console.error("DETALJNA GREŠKA NA BACKENDU:", error);
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}
