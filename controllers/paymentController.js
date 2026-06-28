// controllers/paymentController.js
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

        if (!phone || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and amount are required',
            });
        }

        // Clean phone – ensure 254 prefix
        const digits = phone.replace(/\D/g, '');
        const formattedPhone = digits.startsWith('254') ? digits : '254' + digits;

        const payload = {
            channel_id: PAYHERO_CHANNEL_ID,
            phone_number: formattedPhone,
            amount: parseFloat(amount).toFixed(2),
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

        // TODO: Save transaction to database, update order status, etc.
        // Example:
        // const { transaction_id, status, amount, phone } = callbackData;
        // await Order.update({ payment_status: status }, { where: { transaction_id } });

        // Always respond with 200 OK to acknowledge receipt
        return res.status(200).json({ status: 'received' });
    } catch (error) {
        console.error('Callback processing error:', error);
        // Still return 200 to prevent PayHero from retrying
        return res.status(200).json({ status: 'error', message: error.message });
    }
};