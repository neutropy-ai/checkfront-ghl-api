const fetch = require('node-fetch');

const CHECKFRONT_DOMAIN = process.env.CHECKFRONT_DOMAIN || 'funkytown.checkfront.com';
const CHECKFRONT_API_KEY = process.env.CHECKFRONT_API_KEY || '63f16965e59953a8b4e41408e1a4a2fda01f5b62';
const CHECKFRONT_API_SECRET = process.env.CHECKFRONT_API_SECRET || 'add933b4539b93537600694efc27fd93274730b6f729a3edbbe5a655e0425091';

const credentials = Buffer.from(`${CHECKFRONT_API_KEY}:${CHECKFRONT_API_SECRET}`).toString('base64');

async function checkfrontRequest(endpoint, method = 'GET', body = null) {
    const url = `https://${CHECKFRONT_DOMAIN}/api/3.0${endpoint}`;
    const options = { method, headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/json', 'Accept': 'application/json' } };
    if (body) options.body = JSON.stringify(body);
    const response = await fetch(url, options);
    return await response.json();
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Use POST' });

    try {
          const { item_id, date, start_date, customer_name, customer_email, customer_phone, quantity = 1 } = req.body || {};

      if (!item_id) return res.status(400).json({ success: false, speech: 'What service would you like to book?' });
          const bookingDate = date || start_date;
          if (!bookingDate) return res.status(400).json({ success: false, speech: 'What date would you like to book?' });
          if (!customer_email && !customer_phone) return res.status(400).json({ success: false, speech: 'I need your email or phone to complete the booking.' });

      const sessionResult = await checkfrontRequest('/booking/session', 'POST', { item_id, start_date: bookingDate, end_date: bookingDate, qty: quantity });
          if (sessionResult.error) return res.status(400).json({ success: false, speech: sessionResult.error });

      const bookingResult = await checkfrontRequest('/booking', 'POST', {
              session_id: sessionResult.session?.id,
              customer_name: customer_name || 'Guest',
              customer_email: customer_email || '',
              customer_phone: customer_phone || '',
              start_date: bookingDate, end_date: bookingDate, item_id, qty: quantity
      });

      if (bookingResult.booking) {
              const id = bookingResult.booking.booking_id || bookingResult.booking.id;
              return res.status(201).json({ success: true, booking_id: id, speech: `Your booking is confirmed! Confirmation number is ${id}.` });
      }
          return res.status(400).json({ success: false, speech: bookingResult.error || 'Could not complete booking.' });
    } catch (error) {
          return res.status(500).json({ success: false, error: error.message, speech: 'Error creating booking.' });
    }
};
