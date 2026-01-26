require("../instrument.js");
const Sentry = require("@sentry/node");
// api/items.js
const { checkfront } = require("../lib/checkfront");
const { guard } = require("../lib/guard");

module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-internal-token");
    return res.status(200).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  // Auth check
  if (!guard(req, res)) return;

  // Allow both GET and POST
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      code: "METHOD_NOT_ALLOWED",
      speech: "Sorry, something went wrong. Can you try that again?"
    });
  }

  try {
    const result = await checkfront("/item");

    if (!result?.items) {
      return res.status(200).json({
        ok: true,
        items: [],
        speech: "I don't see any services available right now."
      });
    }

    // Convert to array and simplify for voice
    const items = Object.entries(result.items).map(([id, item]) => ({
      id,
      name: item.name,
      summary: item.summary || "",
      rate: item.rate,
      available: item.stock !== 0
    }));

    // Filter to only available items
    const availableItems = items.filter(i => i.available);

    // Build speech response
    let speech;
    if (availableItems.length === 0) {
      speech = "I don't see any services available right now.";
    } else if (availableItems.length <= 3) {
      const names = availableItems.map(i => i.name).join(", ");
      speech = `We offer ${names}. Which one interests you?`;
    } else {
      const topItems = availableItems.slice(0, 3).map(i => i.name).join(", ");
      speech = `We have several options including ${topItems}, and ${availableItems.length - 3} more. What type of service are you looking for?`;
    }

    return res.status(200).json({
      ok: true,
      items: availableItems,
      total: availableItems.length,
      speech
    });

  } catch (err) {
    console.error("items failed:", err.message, err.payload || "");
    Sentry.captureException(err);

    return res.status(500).json({
      ok: false,
      code: "INTERNAL_ERROR",
      speech: "I had trouble getting the service list. Can you try again in a moment?"
    });
  }
};
