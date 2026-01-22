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

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed. Use POST.',
            speech: 'Sorry, something went wrong on my end. Can you try that again?'
        });
    }

    try {
        const { booking_id, reason } = { ...req.query, ...req.body };

        if (!booking_id) {
            return res.status(400).json({
                success: false,
                message: 'Provide booking_id to cancel',
                speech: 'Sure, I can help cancel a booking. What\'s your confirmation number?'
            });
        }

        // First, get the booking to verify it exists
        const bookingResult = await checkfrontRequest(`/booking/${booking_id}`);
        
        if (!bookingResult.booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found',
                speech: `I couldn't find a booking with that number. Could you double-check the confirmation code for me?`
            });
        }

        const booking = bookingResult.booking;
        const customerName = booking.customer?.name || 'there';
        const itemName = booking.items?.[0]?.name || 'your booking';

        // Check if already cancelled
        if (booking.status === 'CANCELLED' || booking.status_id === 'CANCELLED') {
            return res.status(400).json({
                success: false,
                message: 'Booking is already cancelled',
                speech: `That booking was actually already cancelled. Is there something else I can help you with?`
            });
        }

        // Cancel the booking
        const cancelResult = await checkfrontRequest(`/booking/${booking_id}`, 'PUT', {
            status_id: 'CANCELLED',
            note: reason || 'Cancelled via phone'
        });

        if (cancelResult.error) {
            return res.status(400).json({
                success: false,
                message: cancelResult.error,
                speech: `I wasn't able to cancel that booking. Want me to try again?`
            });
        }

        return res.status(200).json({
            success: true,
            booking_id: booking_id,
            cancelled: true,
            speech: `Done - I've cancelled the ${itemName} booking. You should get a confirmation email shortly. Anything else I can help with?`
        });

    } catch (error) {
        console.error('Cancel booking error:', error);
        return res.status(500).json({
            success: false,
            message: error.message,
            speech: `I ran into an issue cancelling that. Mind if we try again?`
        });
    }
};
