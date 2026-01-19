const fetch = require('node-fetch');

const CHECKFRONT_DOMAIN = process.env.CHECKFRONT_DOMAIN || 'funkytown.checkfront.com';
const CHECKFRONT_API_KEY = process.env.CHECKFRONT_API_KEY || '63f16965e59953a8b4e41408e1a4a2fda01f5b62';
const CHECKFRONT_API_SECRET = process.env.CHECKFRONT_API_SECRET || 'add933b4539b93537600694efc27fd93274730b6f729a3edbbe5a655e0425091';

const credentials = Buffer.from(`${CHECKFRONT_API_KEY}:${CHECKFRONT_API_SECRET}`).toString('base64');

async function checkfrontRequest(endpoint, method = 'GET', body = null) {
    const url = `https://${CHECKFRONT_DOMAIN}/api/3.0${endpoint}`;
    const options = {
          method,
          headers: {
                  'Authorization': `Basic ${credentials}`,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
          }
    };
    if (body && (method === 'POST' || method === 'PUT')) {
          options.body = JSON.stringify(body);
    }
    const response = await fetch(url, options);
    return await response.json();
}

function formatBooking(booking) {
    if (!booking) return null;
    return {
          booking_id: booking.booking_id || booking.id,
          status: booking.status_name || booking.status,
          customer_name: booking.customer?.name,
          customer_email: booking.customer?.email,
          customer_phone: booking.customer?.phone,
          start_date: booking.start_date,
          end_date: booking.end_date,
          total: booking.total
    };
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    return res.status(200).json({
          status: 'ok',
          service: 'Checkfront GHL Voice AI API',
          version: '1.0.0',
          message: 'Use specific endpoints: /api/check-booking, /api/create-booking, /api/modify-booking, /api/cancel-booking'
    });
};
