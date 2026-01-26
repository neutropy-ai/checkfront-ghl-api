// lib/checkfront.js
// Uses native fetch (Node.js 18+)
const Fuse = require("fuse.js");

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function baseUrl() {
  return `https://${required("CHECKFRONT_DOMAIN")}/api/3.0`;
}

function authHeader() {
  const key = required("CHECKFRONT_API_KEY");
  const secret = required("CHECKFRONT_API_SECRET");
  return "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
}

async function checkfront(path, { method = "GET", query, form, timeoutMs = 10000 } = {}) {
  const url = new URL(baseUrl() + path);

  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = { Authorization: authHeader(), Accept: "application/json" };
    let body;

    // IMPORTANT: Checkfront expects x-www-form-urlencoded for POST updates
    if (form && method !== "GET") {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(
        Object.fromEntries(Object.entries(form).filter(([, v]) => v !== undefined && v !== null))
      ).toString();
    }

    const resp = await fetch(url.toString(), { method, headers, body, signal: controller.signal });

    const contentType = resp.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const payload = isJson ? await resp.json() : await resp.text();

    if (!resp.ok) {
      const err = new Error(`Checkfront error ${resp.status}`);
      err.status = resp.status;
      err.payload = payload;
      throw err;
    }

    return payload;
  } finally {
    clearTimeout(t);
  }
}

// Find item(s) by name using fuzzy search - handles typos, partial names, vague queries
async function findItemsByName(itemName) {
  // URL-decode and normalize the input (GHL sometimes sends encoded strings)
  const decodedName = decodeURIComponent(itemName).trim();
  console.log("[findItemsByName] Searching for:", decodedName);

  const result = await checkfront('/item');

  if (!result.items) {
    console.log("[findItemsByName] No items returned from Checkfront API");
    return { exact: null, matches: [] };
  }

  // Convert items object to array with id included
  const itemsArray = Object.entries(result.items).map(([id, item]) => ({
    id,
    ...item
  }));

  console.log("[findItemsByName] Available items:", itemsArray.map(i => i.name));

  const searchName = decodedName.toLowerCase();

  // First check for exact match (case-insensitive)
  const exactMatch = itemsArray.find(item => item.name.toLowerCase() === searchName);
  if (exactMatch) {
    console.log("[findItemsByName] Exact match found:", exactMatch.name);
    return { exact: exactMatch, matches: [] };
  }

  // Check for simple contains match (e.g., "kayak" matches "Single Kayak - 2hr")
  const containsMatches = itemsArray.filter(item => {
    const name = item.name.toLowerCase();
    return name.includes(searchName) || searchName.includes(name);
  });

  if (containsMatches.length === 1) {
    console.log("[findItemsByName] Single contains match:", containsMatches[0].name);
    return { exact: containsMatches[0], matches: [] };
  }

  if (containsMatches.length > 1) {
    console.log("[findItemsByName] Multiple contains matches:", containsMatches.map(m => m.name));
    return { exact: null, matches: containsMatches };
  }

  // Use fuzzy search for typos, partial words, similar sounding names
  const fuse = new Fuse(itemsArray, {
    keys: ["name"],
    threshold: 0.6,        // 0 = exact, 1 = match anything (0.6 for voice AI tolerance)
    distance: 100,         // How far to search in the string
    includeScore: true,
    minMatchCharLength: 2,
    ignoreLocation: true,  // Match anywhere in the string
  });

  const fuzzyResults = fuse.search(searchName);
  console.log("[findItemsByName] Fuzzy search results:", fuzzyResults.map(r => ({
    name: r.item.name,
    score: r.score?.toFixed(3)
  })));

  if (fuzzyResults.length === 0) {
    console.log("[findItemsByName] No matches found");
    return { exact: null, matches: [] };
  }

  // If top result has a very good score (< 0.2), treat as exact match
  if (fuzzyResults[0].score < 0.2) {
    console.log("[findItemsByName] High confidence fuzzy match:", fuzzyResults[0].item.name);
    return { exact: fuzzyResults[0].item, matches: [] };
  }

  // If only one result, use it
  if (fuzzyResults.length === 1) {
    console.log("[findItemsByName] Single fuzzy match:", fuzzyResults[0].item.name);
    return { exact: fuzzyResults[0].item, matches: [] };
  }

  // Multiple fuzzy matches - return top matches for user to choose
  const topMatches = fuzzyResults.slice(0, 5).map(r => r.item);
  console.log("[findItemsByName] Multiple fuzzy matches, returning options");
  return { exact: null, matches: topMatches };
}

// Return minimal booking info (voice-safe, no PII leakage)
function safeBooking(b) {
  return {
    booking_id: b.booking_id || b.id,
    code: b.code,
    status: b.status_name || b.status,
    start_date: b.start_date,
    item: b.items?.[0]?.name,
    total: b.total,
  };
}

module.exports = { checkfront, findItemsByName, safeBooking };
