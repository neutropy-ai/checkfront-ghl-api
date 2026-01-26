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
      if (v === undefined || v === null || v === "") continue;
      // Handle nested objects like param: { qty: 2 } → param[qty]=2
      if (typeof v === "object" && !Array.isArray(v)) {
        for (const [subKey, subVal] of Object.entries(v)) {
          if (subVal !== undefined && subVal !== null && subVal !== "") {
            url.searchParams.set(`${k}[${subKey}]`, String(subVal));
          }
        }
      } else {
        url.searchParams.set(k, String(v));
      }
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

// Normalize search terms for better matching
function normalizeSearchTerm(str) {
  return str
    .toLowerCase()
    .replace(/\bminutes?\b/g, "min")      // minute/minutes → min
    .replace(/\bhours?\b/g, "hour")        // hours → hour
    .replace(/\bprivate\s+sauna\b/g, "sauna")  // "private sauna" → "sauna" for initial match
    .replace(/\bshared\s+sauna\b/g, "sauna")   // "shared sauna" → "sauna" for initial match
    .replace(/\s+/g, " ")                  // collapse whitespace
    .trim();
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
  const normalizedSearch = normalizeSearchTerm(decodedName);

  // First check for exact match (case-insensitive) - try both original and normalized
  const exactMatch = itemsArray.find(item => {
    const itemLower = item.name.toLowerCase();
    const itemNormalized = normalizeSearchTerm(item.name);
    return itemLower === searchName || itemNormalized === normalizedSearch;
  });
  if (exactMatch) {
    console.log("[findItemsByName] Exact match found:", exactMatch.name);
    return { exact: exactMatch, matches: [] };
  }

  // Check for simple contains match (e.g., "kayak" matches "Single Kayak - 2hr")
  // Use normalized terms for better matching
  const containsMatches = itemsArray.filter(item => {
    const name = item.name.toLowerCase();
    const nameNormalized = normalizeSearchTerm(item.name);
    return name.includes(searchName) || searchName.includes(name) ||
           nameNormalized.includes(normalizedSearch) || normalizedSearch.includes(nameNormalized);
  });

  if (containsMatches.length === 1) {
    console.log("[findItemsByName] Single contains match:", containsMatches[0].name);
    return { exact: containsMatches[0], matches: [] };
  }

  if (containsMatches.length > 1) {
    console.log("[findItemsByName] Multiple contains matches:", containsMatches.map(m => m.name));
    return { exact: null, matches: containsMatches };
  }

  // Special case: "30 minute private sauna" - there IS no private option for 30 min
  // Return clarification that 30 min is shared only, private requires 1 hour
  if (normalizedSearch.includes("30") && normalizedSearch.includes("min") && normalizedSearch.includes("sauna")) {
    if (normalizedSearch.includes("private")) {
      // User asked for private 30 min which doesn't exist
      console.log("[findItemsByName] User asked for 30 min private sauna - doesn't exist");
      const thirtyMin = itemsArray.find(item => item.name.toLowerCase().includes("30 min sauna"));
      const hourPrivate = itemsArray.find(item => item.name.toLowerCase().includes("1 hour private sauna"));
      return {
        exact: null,
        matches: [thirtyMin, hourPrivate].filter(Boolean),
        clarification: "The 30 minute session is shared only. For a private sauna, you'd need the 1 hour option. Which would you prefer?"
      };
    }
    const thirtyMinSauna = itemsArray.find(item => item.name.toLowerCase().includes("30 min sauna"));
    if (thirtyMinSauna) {
      console.log("[findItemsByName] Matched 30 min sauna request to:", thirtyMinSauna.name);
      return { exact: thirtyMinSauna, matches: [] };
    }
  }

  // Special case: "1 hour private sauna" or "hour private sauna"
  if (normalizedSearch.includes("hour") && normalizedSearch.includes("private") && normalizedSearch.includes("sauna")) {
    const hourPrivate = itemsArray.find(item => item.name.toLowerCase().includes("1 hour private sauna"));
    if (hourPrivate) {
      console.log("[findItemsByName] Matched 1 hour private sauna request to:", hourPrivate.name);
      return { exact: hourPrivate, matches: [] };
    }
  }

  // Special case: "1 hour shared sauna" or "hour shared sauna"
  if (normalizedSearch.includes("hour") && normalizedSearch.includes("shared") && normalizedSearch.includes("sauna")) {
    const hourShared = itemsArray.find(item => item.name.toLowerCase().includes("1 hour shared sauna"));
    if (hourShared) {
      console.log("[findItemsByName] Matched 1 hour shared sauna request to:", hourShared.name);
      return { exact: hourShared, matches: [] };
    }
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
