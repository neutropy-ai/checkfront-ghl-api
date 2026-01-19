const fetch = require('node-fetch');

const CHECKFRONT_DOMAIN = process.env.CHECKFRONT_DOMAIN || 'funkytown.checkfront.com';
const CHECKFRONT_API_KEY = process.env.CHECKFRONT_API_KEY || '63f16965e59953a8b4e41408e1a4a2fda01f5b62';
const CHECKFRONT_API_SECRET = process.env.CHECKFRONT_API_SECRET || 'add933b4539b93537600694efc27fd93274730b6f729a3edbbe5a655e0425091';

const credentials = Buffer.from(`${CHECKFRONT_API_KEY}:${CHECKFRONT_API_SECRET}`).toString('base64');

async function checkfrontRequest(endpoint) {
    const url = `https://${CHECKFRONT_DOMAIN}/api/3.0${endpoint}`;
    const response = await fetch(url, {
          headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' }
    });
    return await response.json();
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Use POST' });

    try {
          const { booking_id, email, phone } = req.body || {};
          if (!booking_id && !email && !phone) {
                  return res.status(400).json({ success: false, message: 'Provide booking_id, email, or phone', speech: 'I need your booking ID, email, or phone to look up your booking.' });
          }

      if (booking_id) {
              const result = await checkfrontRequest(`/booking/${booking_id}`);
              if (result.booking) {
                        return res.status(200).json({ success: true, booking: result.booking, speech: `Found booking ${booking_id} for ${result.booking.customer?.name || 'customer'}.` });
              }
              return res.status(404).json({ success: false, speech: `No booking found with ID ${booking_id}.` });
      }

      const params = new URLSearchParams();
          if (email) params.append('customer_email', email);
          if (phone) params.append('customer_phone', phone);
          const result = await checkfrontRequest(`/booking?${params}`);

      if (result.bookings && Object.keys(result.bookings).length > 0) {
              const bookings = Object.values(result.bookings);
              return res.status(200).json({ success: true, bookings, count: bookings.length, speech: `Found ${bookings.length} booking(s).` });
      }
          return res.status(404).json({ success: false, speech: 'No bookings found.' });
    } catch (error) {
          return res.status(500).json({ success: false, error: error.message, speech: 'Error looking up booking.' });
    }
};
