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

    try {
          const result = await checkfrontRequest('/item');

      if (result.items && Object.keys(result.items).length > 0) {
              const items = Object.values(result.items).map(item => ({
                        id: item.item_id,
                        name: item.name,
                        description: item.summary || item.description,
                        category: item.category_name,
                        price: item.rate,
                        unit: item.unit
              }));

            const itemNames = items.slice(0, 5).map(i => i.name).join(', ');

            return res.status(200).json({
                      success: true,
                      items: items,
                      count: items.length,
                      message: `Found ${items.length} bookable items/services`,
                      speech: items.length <= 5
                        ? `We have ${items.length} services available: ${itemNames}. Which one would you like to book?`
                                  : `We have ${items.length} services available, including ${itemNames}, and more. What are you interested in?`
            });
      }

      return res.status(200).json({
              success: true,
              items: [],
              count: 0,
              message: 'No items found',
              speech: 'I do not see any available services at the moment. Would you like me to check something else?'
      });

    } catch (error) {
          console.error('Get items error:', error);
          return res.status(500).json({
                  success: false,
                  message: 'Error fetching items',
                  error: error.message,
                  speech: 'I had trouble getting the list of services. Let me connect you with someone who can help.'
          });
    }
};
