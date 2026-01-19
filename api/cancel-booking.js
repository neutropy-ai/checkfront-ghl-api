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
          start_date: booking.start_date
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
          const { booking_id, reason } = req.body || {};

      if (!booking_id) {
              return res.status(400).json({
                        success: false,
                        message: 'Please provide the booking_id to cancel',
                        speech: 'I need your booking ID or confirmation number to cancel. What is it?'
              });
      }

      const existingResult = await checkfrontRequest(`/booking/${booking_id}`);

      if (!existingResult.booking) {
              return res.status(404).json({
                        success: false,
                        message: `Booking ${booking_id} not found`,
                        speech: `I couldn't find a booking with ID ${booking_id}. Could you verify the confirmation number?`
              });
      }

      const existingBooking = existingResult.booking;
          const formatted = formatBookingForVoice(existingBooking);

      const currentStatus = (existingBooking.status_name || existingBooking.status || '').toLowerCase();
          if (currentStatus.includes('cancel')) {
                  return res.status(400).json({
                            success: false,
                            booking: formatted,
                            message: `Booking ${booking_id} is already cancelled`,
                            speech: `This booking has already been cancelled. Is there anything else I can help you with?`
                  });
          }

      const cancelData = {
              status_id: 'CANC',
              notes: reason ? `Cancelled via Voice AI: ${reason}` : 'Cancelled via Voice AI'
      };

      const cancelResult = await checkfrontRequest(`/booking/${booking_id}`, 'PUT', cancelData);

      if (cancelResult.booking) {
              const cancelledBooking = formatBookingForVoice(cancelResult.booking);
              return res.status(200).json({
                        success: true,
                        booking: cancelledBooking,
                        booking_id: booking_id,
                        previous_date: formatted.start_date,
                        message: `Booking ${booking_id} has been cancelled`,
                        speech: `Your booking for ${formatted.start_date} has been cancelled. Is there anything else I can help you with?`
              });
      }

      if (cancelResult.error) {
              const altCancelData = {
                        status: 'cancelled',
                        notes: reason ? `Cancelled via Voice AI: ${reason}` : 'Cancelled via Voice AI'
              };

            const altResult = await checkfrontRequest(`/booking/${booking_id}`, 'PUT', altCancelData);

            if (altResult.booking || altResult.success) {
                      return res.status(200).json({
                                  success: true,
                                  booking_id: booking_id,
                                  previous_date: formatted.start_date,
                                  message: `Booking ${booking_id} has been cancelled`,
                                  speech: `Your booking for ${formatted.start_date} has been cancelled. Is there anything else I can help you with?`
                      });
            }

            return res.status(400).json({
                      success: false,
                      message: cancelResult.error || altResult.error || 'Unable to cancel booking',
                      speech: 'I was not able to cancel the booking. Would you like me to connect you with someone who can help?'
            });
      }

      return res.status(400).json({
              success: false,
              message: 'Unable to cancel booking',
              details: cancelResult,
              speech: 'I was not able to cancel the booking. Would you like me to try again or connect you with someone?'
      });

    } catch (error) {
          console.error('Cancel booking error:', error);
          return res.status(500).json({
                  success: false,
                  message: 'Error cancelling booking',
                  error: error.message,
                  speech: 'I encountered an error cancelling your booking. Let me connect you with someone who can help.'
          });
    }
};
