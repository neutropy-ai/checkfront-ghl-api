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

// Find item(s) by name - returns single match or multiple options
async function findItemsByName(itemName) {
    const result = await checkfrontRequest('/item');
    if (!result.items) return { exact: null, matches: [] };
    
    const searchName = itemName.toLowerCase().trim();
    const matches = [];
    
    // Check all items for matches
    for (const [id, item] of Object.entries(result.items)) {
        const name = item.name.toLowerCase();
        
        // Exact match - return immediately
        if (name === searchName) {
            return { exact: { id, ...item }, matches: [] };
        }
        
        // Partial match - add to list
        if (name.includes(searchName) || searchName.includes(name)) {
            matches.push({ id, ...item });
        }
    }
    
    // If only one partial match, treat it as exact
    if (matches.length === 1) {
        return { exact: matches[0], matches: [] };
    }
    
    return { exact: null, matches };
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
        const { item_id, item_name, date, start_date, end_date, days = 7 } = { ...req.query, ...req.body };

        // Resolve item_id from item_name if needed
        let resolvedItemId = item_id;
        let itemInfo = null;
        
        if (!resolvedItemId && item_name) {
            const { exact, matches } = await findItemsByName(item_name);
            
            if (exact) {
                itemInfo = exact;
                resolvedItemId = exact.id;
            } else if (matches.length > 0) {
                // Multiple matches - ask caller to clarify
                const optionNames = matches.map(m => m.name);
                let speechOptions;
                
                if (optionNames.length === 2) {
                    speechOptions = `${optionNames[0]} or the ${optionNames[1]}`;
                } else {
                    const last = optionNames.pop();
                    speechOptions = `${optionNames.join(', ')}, or the ${last}`;
                }
                
                return res.status(200).json({
                    success: false,
                    multiple_matches: true,
                    matches: matches.map(m => ({ id: m.id, name: m.name })),
                    speech: `We have a few options for that - there's the ${speechOptions}. Which one works for you?`
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: `Could not find item matching "${item_name}"`,
                    speech: `Hmm, I'm not seeing anything called ${item_name}. Could you tell me a bit more about what you're looking for?`
                });
            }
        }

        if (!resolvedItemId) {
            return res.status(400).json({
                success: false,
                message: 'Please provide item_id or item_name to check availability',
                speech: 'Sure, I can check availability for you. What activity or service were you interested in?'
            });
        }

        const today = new Date().toISOString().split('T')[0];
        const checkStartDate = date || start_date || today;

        let checkEndDate = end_date;
        if (!checkEndDate) {
            const endDateObj = new Date(checkStartDate);
            endDateObj.setDate(endDateObj.getDate() + parseInt(days));
            checkEndDate = endDateObj.toISOString().split('T')[0];
        }

        const result = await checkfrontRequest(
            `/item/${resolvedItemId}?start_date=${checkStartDate}&end_date=${checkEndDate}`
        );

        if (result.error) {
            return res.status(400).json({
                success: false,
                message: result.error,
                speech: 'I ran into a problem checking that for you. Mind if we try again?'
            });
        }

        const item = result.item;
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found',
                speech: `I couldn't pull that one up. Want me to check something else for you?`
            });
        }

        // Get available dates from the calendar
        const availableDates = [];
        const unavailableDates = [];

        if (item.calendar) {
            for (const [dateStr, dayInfo] of Object.entries(item.calendar)) {
                if (dayInfo.available && dayInfo.available > 0) {
                    availableDates.push({
                        date: dateStr,
                        available: dayInfo.available,
                        rate: dayInfo.rate
                    });
                } else {
                    unavailableDates.push(dateStr);
                }
            }
        }

        const itemName = itemInfo?.name || item.name || 'that';
        
        let speechResponse;
        if (availableDates.length === 0) {
            speechResponse = `Unfortunately ${itemName} is fully booked from ${checkStartDate} to ${checkEndDate}. Want me to check some other dates?`;
        } else if (availableDates.length === 1) {
            speechResponse = `Good news - ${itemName} is available on ${availableDates[0].date}. Would you like me to book that for you?`;
        } else {
            const dateList = availableDates.slice(0, 3).map(d => d.date).join(', ');
            if (availableDates.length > 3) {
                speechResponse = `${itemName} has availability on ${dateList}, plus ${availableDates.length - 3} more dates. Which date works best for you?`;
            } else {
                speechResponse = `${itemName} is available on ${dateList}. Which date would you prefer?`;
            }
        }

        return res.status(200).json({
            success: true,
            item_id: resolvedItemId,
            item_name: itemName,
            start_date: checkStartDate,
            end_date: checkEndDate,
            available_dates: availableDates,
            unavailable_dates: unavailableDates,
            total_available: availableDates.length,
            speech: speechResponse
        });

    } catch (error) {
        console.error('Availability check error:', error);
        return res.status(500).json({
            success: false,
            message: error.message,
            speech: 'Sorry about that - I hit a snag. Can we try that again?'
        });
    }
};
