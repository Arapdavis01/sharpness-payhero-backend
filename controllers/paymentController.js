const axios = require('axios');

const {
    PAYHERO_BASE_URL,
    PAYHERO_USERNAME,
    PAYHERO_PASSWORD,
    PAYHERO_CHANNEL_ID,
    PAYHERO_INITIATE_ENDPOINT,
    PAYHERO_CALLBACK_URL,
} = process.env;

// ---------- Initiate Payment ----------
exports.initiatePayment = async (req, res) => {
    try {
        const { phone, amount } = req.body;

        // --- Detailed validation ---
        if (!phone && !amount) {
            return res.status(400).json({
                success: false,
                message: 'Missing both phone and amount',
            });
        }
        if (!phone) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required',
            });
        }
        if (!amount) {
            return res.status(400).json({
                success: false,
                message: 'Amount is required',
            });
        }

        // Clean phone – ensure 254 prefix
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 9 || digits.length > 12) {
            return res.status(400).json({
                success: false,
                message: 'Phone number must be between 9 and 12 digits',
            });
        }
        const formattedPhone = digits.startsWith('254') ? digits : '254' + digits;

        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be a positive number',
            });
        }

        // Build PayHero payload
        const payload = {
            channel_id: PAYHERO_CHANNEL_ID,
            phone_number: formattedPhone,
            amount: amountNum.toFixed(2),
            description: 'Bomayangu payment',
            callback_url: PAYHERO_CALLBACK_URL,
        };

        const url = `${PAYHERO_BASE_URL}${PAYHERO_INITIATE_ENDPOINT}`;
        const response = await axios.post(url, payload, {
            auth: {
                username: PAYHERO_USERNAME,
                password: PAYHERO_PASSWORD,
            },
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            timeout: 30000,
        });

        return res.status(200).json({
            success: true,
            message: 'Payment initiated successfully',
            data: response.data,
        });
    } catch (error) {
        console.error('PayHero initiation error:', error.response?.data || error.message);
        const status = error.response?.status || 500;
        const message = error.response?.data?.message || error.message || 'Payment initiation failed';
        return res.status(status).json({
            success: false,
            message,
        });
    }
};

// ---------- Callback Handler ----------
exports.handleCallback = async (req, res) => {
    try {
        const callbackData = req.body;
        console.log('PayHero callback received:', callbackData);

        // TODO: Save to database, update order, etc.

        return res.status(200).json({ status: 'received' });
    } catch (error) {
        console.error('Callback processing error:', error);
        return res.status(200).json({ status: 'error', message: error.message });
    }
};
