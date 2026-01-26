// lib/guard.js

function guard(req, res) {
  const token = process.env.INTERNAL_TOKEN;

  // Skip auth if no token configured (dev mode)
  if (!token || token === "") {
    return true;
  }

  const got = req.headers["x-internal-token"];
  if (got !== token) {
    console.warn("[guard] Unauthorized request rejected");
    res.status(401).json({
      ok: false,
      code: "UNAUTHORISED",
      speech: "Sorry — I can't do that right now."
    });
    return false;
  }

  return true;
}

module.exports = { guard };
