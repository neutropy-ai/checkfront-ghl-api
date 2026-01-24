// lib/guard.js

function guard(req, res) {
  const token = process.env.INTERNAL_TOKEN;
  if (!token) return true; // allow if not configured yet (dev mode)

  const got = req.headers["x-internal-token"];
  if (got !== token) {
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
