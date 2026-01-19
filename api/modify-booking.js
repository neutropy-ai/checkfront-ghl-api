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

function formatBookingForVoice(booking) {
    if (!booking) return null;
    return {
          booking_id: booking.booking_id || booking.id,
          status: booking.status_name || booking.status,
          customer_name: booking.customer?.name || `${booking.customer?.first_name || ''} ${booking.customer?.last_name || ''}`.trim(),
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

    if (req.method === 'OPTIONS') {
          return res.status(200).end();
    }

    if (req.method !== 'POST') {
          return res.status(405).json({
                  success: false,
                  message: 'Method not allowed. Use POST.',
                  speech: 'There was a technical issue. Please try again.'
          });
    }

    try {
          const { booking_id, new_date, new_start_date, new_end_date, customer_name, customer_email, customer_phone, notes, quantity } = req.body || {};

      if (!booking_id) {
              return res.status(400).json({
                        success: false,
                        message: 'Please provide the booking_id to modify',
                        speech: 'I need your booking ID to make changes. What is it?'
              });
      }

      const existingResult = await checkfrontRequest(`/booking/${booking_id}`);

      if (!existingResult.booking) {
              return res.status(404).json({
                        success: false,
                        message: `Booking ${booking_id} not found`,
                        speech: `I couldn't find booking ${booking_id}. Could you verify the number?`
              });
      }

      const updateData = {};
          const updatedStartDate = new_date || new_start_date;
          if (updatedStartDate) {
                  updateData.start_date = updatedStartDate;
                  updateData.end_date = new_end_date || updatedStartDate;
          }
          if (customer_name) updateData.customer_name = customer_name;
          if (customer_email) updateData.customer_email = customer_email;
          if (customer_phone) updateData.customer_phone = customer_phone;
          if (notes) updateData.notes = notes;
          if (quantity) updateData.qty = quantity;

      if (Object.keys(updateData).length === 0) {
              return res.status(400).json({
                        success: false,
                        message: 'No changes specified',
                        speech: 'What would you like to change about your booking?'
              });
      }

      const updateResult = await checkfrontRequest(`/booking/${booking_id}`, 'PUT', updateData);

      if (updateResult.booking) {
              const formatted = formatBookingForVoice(updateResult.booking);
              let changeDescription = [];
              if (updatedStartDate) changeDescription.push(`date changed to ${updatedStartDate}`);
              if (customer_name) changeDescription.push('name updated');
              if (customer_email) changeDescription.push('email updated');
              if (customer_phone) changeDescription.push('phone updated');

            return res.status(200).json({
                      success: true,
                      booking: formatted,
                      booking_id: formatted.booking_id,
                      changes_made: changeDescription,
                      message: `Booking ${booking_id} updated: ${changeDescription.join(', ')}`,
                      speech: updatedStartDate ? `Your booking is now scheduled for ${updatedStartDate}. Anything else?` : `Your booking has been updated. Anything else?`
            });
      }

      if (updateResult.error) {
              return res.status(400).json({
                        success: false,
                        message: updateResult.error,
                        speech: `I couldn't make that change. ${updateResult.error}`
              });
      }

      return res.status(400).json({
              success: false,
              message: 'Unable to update booking',
              speech: 'I was not able to update the booking. Would you like me to try again?'
      });

    } catch (error) {
          console.error('Modify booking error:', error);
          return res.status(500).json({
                  success: false,
                  message: 'Error modifying booking',
                  error: error.message,
                  speech: 'I had trouble updating your booking. Let me connect you with someone who can help.'
          });
    }
};
