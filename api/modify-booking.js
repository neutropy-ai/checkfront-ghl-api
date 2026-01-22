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
            speech: 'Sorry, something went wrong. Can you try that again?'
        });
    }

    try {
        const { booking_id, new_date, new_start_date, new_end_date, customer_name, customer_email, customer_phone, notes, quantity } = { ...req.query, ...req.body };

        if (!booking_id) {
            return res.status(400).json({
                success: false,
                message: 'Provide booking_id to modify',
                speech: 'Sure, I can help change a booking. What\'s your confirmation number?'
            });
        }

        // First, get the existing booking
        const bookingResult = await checkfrontRequest(`/booking/${booking_id}`);
        
        if (!bookingResult.booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found',
                speech: `I couldn't find that booking. Could you double-check the confirmation number?`
            });
        }

        const booking = bookingResult.booking;
        const itemName = booking.items?.[0]?.name || 'your booking';
        const currentDate = booking.start_date;

        // Build update object with only provided fields
        const updateData = {};
        
        if (new_date || new_start_date) {
            updateData.start_date = new_date || new_start_date;
        }
        if (new_end_date) {
            updateData.end_date = new_end_date;
        }
        if (customer_name) {
            updateData.customer_name = customer_name;
        }
        if (customer_email) {
            updateData.customer_email = customer_email;
        }
        if (customer_phone) {
            updateData.customer_phone = customer_phone;
        }
        if (notes) {
            updateData.note = notes;
        }
        if (quantity) {
            updateData.qty = quantity;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No changes provided',
                speech: `What would you like to change about your ${itemName} booking on ${currentDate}?`
            });
        }

        // Update the booking
        const updateResult = await checkfrontRequest(`/booking/${booking_id}`, 'PUT', updateData);

        if (updateResult.error) {
            // Check if it's a date availability issue
            if (updateData.start_date) {
                return res.status(400).json({
                    success: false,
                    message: updateResult.error,
                    speech: `That new date isn't available unfortunately. Want to try a different date?`
                });
            }
            return res.status(400).json({
                success: false,
                message: updateResult.error,
                speech: `I couldn't update that booking. Want me to try again?`
            });
        }

        // Build confirmation message
        let changeDescription = '';
        if (updateData.start_date) {
            changeDescription = `moved to ${updateData.start_date}`;
        } else if (customer_name || customer_email || customer_phone) {
            changeDescription = 'updated with your new contact info';
        } else {
            changeDescription = 'updated';
        }

        return res.status(200).json({
            success: true,
            booking_id: booking_id,
            updated: true,
            changes: updateData,
            speech: `All done - your ${itemName} booking has been ${changeDescription}. Anything else I can help with?`
        });

    } catch (error) {
        console.error('Modify booking error:', error);
        return res.status(500).json({
            success: false,
            message: error.message,
            speech: `I ran into a problem updating that. Mind if we try again?`
        });
    }
};
