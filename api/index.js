require("../instrument.js");
const Sentry = require("@sentry/node");

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-internal-token');

    if (req.method === 'OPTIONS') return res.status(200).end();

    return res.status(200).json({
          status: 'ok',
          service: 'Checkfront GHL Voice AI API',
          version: '2.0.3',
          build: '2026-01-25-debug',
          auth_required: !!process.env.INTERNAL_TOKEN,
          endpoints: [
            '/api/check-booking',
            '/api/create-booking',
            '/api/modify-booking',
            '/api/cancel-booking',
            '/api/get-availability',
            '/api/items',
            '/api/lookup-customer'
          ]
    });
};
