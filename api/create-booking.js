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

// Find item(s) by name - returns single match or multiple options
async function findItemsByName(itemName) {
    const result = await checkfrontRequest('/item');
    if (!result.items) return { exact: null, matches: [] };
    
    const searchName = itemName.toLowerCase().trim();
    const matches = [];
    
    for (const [id, item] of Object.entries(result.items)) {
        const name = item.name.toLowerCase();
        if (name === searchName) {
            return { exact: { id, ...item }, matches: [] };
        }
        if (name.includes(searchName) || searchName.includes(name)) {
            matches.push({ id, ...item });
        }
    }
    
    if (matches.length === 1) {
        return { exact: matches[0], matches: [] };
    }
    
    return { exact: null, matches };
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, speech: 'Sorry, something went wrong. Can you try that again?' });

    try {
        const { item_id, item_name, date, start_date, customer_name, customer_email, customer_phone, quantity = 1 } = { ...req.query, ...req.body };

        // Resolve item_id from item_name if needed
        let resolvedItemId = item_id;
        let itemInfo = null;
        
        if (!resolvedItemId && item_name) {
            const { exact, matches } = await findItemsByName(item_name);
            
            if (exact) {
                itemInfo = exact;
                resolvedItemId = exact.id;
            } else if (matches.length > 0) {
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
                    speech: `We have a few options - there's the ${speechOptions}. Which one would you like to book?`
                });
            } else {
                return res.status(400).json({
                    success: false,
                    speech: `I'm not seeing anything called ${item_name}. What would you like to book?`
                });
            }
        }

        if (!resolvedItemId) {
            return res.status(400).json({ success: false, speech: 'What would you like to book today?' });
        }
        
        const bookingDate = date || start_date;
        if (!bookingDate) {
            return res.status(400).json({ success: false, speech: 'And what date were you thinking?' });
        }
        
        if (!customer_email && !customer_phone) {
            return res.status(400).json({ success: false, speech: 'Can I grab your email or phone number to confirm the booking?' });
        }

        const sessionResult = await checkfrontRequest('/booking/session', 'POST', { start_date: bookingDate, end_date: bookingDate, item_id: resolvedItemId, qty: quantity });
        if (sessionResult.error) {
            return res.status(400).json({ success: false, speech: `That date's not available unfortunately. Want to try a different date?` });
        }

        const sessionId = sessionResult.booking?.session?.id;
        if (!sessionId) {
            return res.status(400).json({ success: false, speech: `I had trouble starting that booking. Mind if we try again?` });
        }

        const bookingData = {
            form: {
                customer_name: customer_name || 'Guest',
                customer_email: customer_email || '',
                customer_phone: customer_phone || ''
            }
        };

        const createResult = await checkfrontRequest(`/booking/session/${sessionId}`, 'POST', bookingData);
        
        if (createResult.error || !createResult.booking) {
            return res.status(400).json({ success: false, speech: `Something went wrong with the booking. Can we give it another shot?` });
        }

        const booking = createResult.booking;
        const itemName = itemInfo?.name || 'your booking';
        const confirmationCode = booking.code || booking.booking_id;
        
        return res.status(200).json({
            success: true,
            booking_id: booking.booking_id || booking.id,
            booking_code: confirmationCode,
            item_name: itemName,
            date: bookingDate,
            customer_name: customer_name,
            total: booking.total,
            speech: `You're all set! I've got you booked for ${itemName} on ${bookingDate}. Your confirmation number is ${confirmationCode}. Is there anything else I can help with?`
        });

    } catch (error) {
        console.error('Booking error:', error);
        return res.status(500).json({ success: false, speech: `Sorry about that - I ran into an issue. Want to try again?` });
    }
};
