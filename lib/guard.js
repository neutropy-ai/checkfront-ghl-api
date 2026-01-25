// lib/guard.js

function guard(req, res) {
  const token = process.env.INTERNAL_TOKEN;

  // Debug logging
  console.log("[guard] INTERNAL_TOKEN set:", !!token);
  console.log("[guard] Received header:", req.headers["x-internal-token"] ? "yes" : "no");

  // If no token configured, allow all requests (dev mode)
  if (!token || token === "") {
    console.log("[guard] No token configured - allowing request");
    return true;
  }

  const got = req.headers["x-internal-token"];
  if (got !== token) {
    console.log("[guard] Token mismatch - rejecting");
    res.status(401).json({
      ok: false,
      code: "UNAUTHORISED",
      speech: "Sorry — I can't do that right now."
    });
    return false;
  }

  console.log("[guard] Token matched - allowing request");
  return true;
}

module.exports = { guard };
