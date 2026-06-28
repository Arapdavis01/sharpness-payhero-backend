const axios = require('axios');

const {
    PAYHERO_BASE_URL,
    PAYHERO_USERNAME,
    PAYHERO_PASSWORD,
    PAYHERO_CHANNEL_ID,
    PAYHERO_CALLBACK_URL,
} = process.env;

// ---------- Initiate Payment ----------
exports.initiatePayment = async (req, res) => {
    try {
        const { phone, amount } = req.body;

        // --- Validation ---
        if (!phone || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Phone and amount are required',
            });
        }

        // Clean phone (remove non-digits)
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 9 || digits.length > 12) {
            return res.status(400).json({
                success: false,
                message: 'Phone must be 9-12 digits',
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

        // --- Build PayHero payload (corrected) ---
        const payload = {
            channel_id: PAYHERO_CHANNEL_ID,
            phone_number: formattedPhone,   // might be 'phone' – check docs
            amount: amountNum.toFixed(2),
            external_reference: `INV-${Date.now()}`, // unique ref
            provider: 'm-pesa',             // specify provider
            description: 'Bomayangu payment',
            callback_url: PAYHERO_CALLBACK_URL,
        };

        // --- Use the correct endpoint (if needed) ---
        // If your PAYHERO_INITIATE_ENDPOINT is set to '/initiate-stk-push', use it.
        // Otherwise, construct the URL directly.
        const endpoint = process.env.PAYHERO_INITIATE_ENDPOINT || '/initiate-stk-push';
        const url = `${PAYHERO_BASE_URL}${endpoint}`;

        console.log('📤 Sending to PayHero:', JSON.stringify(payload, null, 2));

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
            message: 'Payment initiated',
            data: response.data,
        });
    } catch (error) {
        console.error('PayHero error:', error.response?.data || error.message);
        const status = error.response?.status || 500;
        const message = error.response?.data?.message || error.message;
        return res.status(status).json({
            success: false,
            message,
        });
    }
};

// ---------- Callback Handler ----------
exports.handleCallback = async (req, res) => {
    try {
        console.log('Callback received:', req.body);
        // TODO: update your database with the payment status
        return res.status(200).json({ status: 'received' });
    } catch (error) {
        console.error('Callback error:', error);
        return res.status(200).json({ status: 'error' });
    }
};
