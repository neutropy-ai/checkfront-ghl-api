// lib/checkfront.js
const fetch = require("node-fetch");

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

// Find item(s) by name - returns single match or multiple options
async function findItemsByName(itemName) {
  const result = await checkfront('/item');
  if (!result.items) return { exact: null, matches: [] };

  const searchName = itemName.toLowerCase().trim();
  const matches = [];

  for (const [id, item] of Object.entries(result.items)) {
    const name = item.name.toLowerCase();

    // Exact match - return immediately
    if (name === searchName) {
      return { exact: { id, ...item }, matches: [] };
    }

    // Partial match - add to list
    if (name.includes(searchName) || searchName.includes(name)) {
      matches.push({ id, ...item });
    }
  }

  // If only one partial match, treat it as exact
  if (matches.length === 1) {
    return { exact: matches[0], matches: [] };
  }

  return { exact: null, matches };
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
