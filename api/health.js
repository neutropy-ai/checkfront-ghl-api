require("../instrument.js");
const Sentry = require("@sentry/node");
const { checkfront } = require("../lib/checkfront");

module.exports = async (req, res) => {
  const checks = {
    api: true,
    checkfront: false,
    sentry: !!process.env.SENTRY_DSN || true,
    timestamp: new Date().toISOString()
  };

  try {
    await checkfront('/item', { timeoutMs: 5000 });
    checks.checkfront = true;
  } catch (e) {
    checks.checkfront = false;
    checks.checkfront_error = e.message;
  }

  const status = checks.checkfront ? 200 : 503;
  res.status(status).json(checks);
};
