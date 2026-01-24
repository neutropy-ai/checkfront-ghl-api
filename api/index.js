module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    return res.status(200).json({
          status: 'ok',
          service: 'Checkfront GHL Voice AI API',
          version: '2.0.0',
          message: 'Use specific endpoints: /api/check-booking, /api/create-booking, /api/modify-booking, /api/cancel-booking'
    });
};
