const fetch = require('node-fetch');

const CHECKFRONT_DOMAIN = process.env.CHECKFRONT_DOMAIN || 'funkytown.checkfront.com';
const CHECKFRONT_API_KEY = process.env.CHECKFRONT_API_KEY || '63f16965e59953a8b4e41408e1a4a2fda01f5b62';
const CHECKFRONT_API_SECRET = process.env.CHECKFRONT_API_SECRET || 'add933b4539b93537600694efc27fd93274730b6f729a3edbbe5a655e0425091';

const credentials = Buffer.from(`${CHECKFRONT_API_KEY}:${CHECKFRONT_API_SECRET}`).toString('base64');

async function checkfrontRequest(endpoint) {
    const url = `https://${CHECKFRONT_DOMAIN}/api/3.0${endpoint}`;
    const options = {
          method: 'GET',
          headers: {
                  'Authorization': `Basic ${credentials}`,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
          }
    };
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
                  speech: 'There was a technical issue. Please try again.'
          });
    }

    try {
          const { item_id, date, start_date, end_date, days = 7 } = req.body || {};

      if (!item_id) {
              return res.status(400).json({
                        success: false,
                        message: 'Please provide item_id to check availability',
                        speech: 'What service or activity would you like to check availability for?'
              });
      }

      const today = new Date().toISOString().split('T')[0];
          const checkStartDate = date || start_date || today;

      let checkEndDate = end_date;
          if (!checkEndDate) {
                  const endDateObj = new Date(checkStartDate);
                  endDateObj.setDate(endDateObj.getDate() + days);
                  checkEndDate = endDateObj.toISOString().split('T')[0];
          }

      const result = await checkfrontRequest(
              `/item/${item_id}?start_date=${checkStartDate}&end_date=${checkEndDate}`
            );

      if (result.item) {
              const item = result.item;
              let availableDates = [];

            if (result.calendar || item.calendar) {
                      const calendar = result.calendar || item.calendar;
                      for (const [dateKey, dateInfo] of Object.entries(calendar)) {
                                  if (dateInfo.available || dateInfo.qty > 0) {
                                                availableDates.push({
                                                                date: dateKey,
                                                                slots: dateInfo.slots || dateInfo.qty || 1,
                                                                times: dateInfo.times || []
                                                });
                                  }
                      }
            }

            const hasAvailability = availableDates.length > 0;
              const nextAvailable = availableDates[0];

            return res.status(200).json({
                      success: true,
                      item_id: item_id,
                      item_name: item.name,
                      check_period: { start: checkStartDate, end: checkEndDate },
                      has_availability: hasAvailability,
                      available_dates: availableDates,
                      available_count: availableDates.length,
                      next_available: nextAvailable,
                      message: hasAvailability
                        ? `${item.name} has ${availableDates.length} available date(s) between ${checkStartDate} and ${checkEndDate}`
                                  : `No availability for ${item.name} between ${checkStartDate} and ${checkEndDate}`,
                      speech: hasAvailability
                        ? `${item.name} has availability. The next available date is ${nextAvailable?.date || checkStartDate}. Would you like to book that?`
                                  : `I'm sorry, ${item.name} doesn't have any availability in that time period. Would you like to check different dates?`
            });
      }

      return res.status(404).json({
              success: false,
              message: `Item ${item_id} not found`,
              speech: 'I could not find that service. Would you like me to list what is available?'
      });

    } catch (error) {
          console.error('Get availability error:', error);
          return res.status(500).json({
                  success: false,
                  message: 'Error checking availability',
                  error: error.message,
                  speech: 'I had trouble checking availability. Let me connect you with someone who can help.'
          });
    }
};
