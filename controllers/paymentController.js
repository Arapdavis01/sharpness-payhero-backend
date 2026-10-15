const axios = require('axios');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');

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
        const { phone, amount, provider = 'm-pesa', name = '' } = req.body;

        if (!phone || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Phone and amount are required',
            });
        }

        const digits = String(phone).replace(/\D/g, '');
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

        // Generate a unique reference. This is the only value the callback
        // will trust when updating a transaction.
        const reference = 'EM-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();

        const transaction = await Transaction.create({
            reference,
            phone: formattedPhone,
            amount: amountNum,
            provider,
            method: 'stk',
            status: 'pending',
            customerName: name,
        });

        const payload = {
            channel_id: PAYHERO_CHANNEL_ID,
            phone_number: formattedPhone,
            amount: amountNum,
            provider,
            external_reference: reference,
            description: 'Eagle Master payment',
            callback_url: PAYHERO_CALLBACK_URL,
        };

        const endpoint = process.env.PAYHERO_INITIATE_ENDPOINT || '/payments';
        const url = PAYHERO_BASE_URL + endpoint;

        transaction.initiatePayload = payload;
        await transaction.save();

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

        transaction.initiateResponse = response.data;
        transaction.payheroReference =
            response.data?.reference || response.data?.CheckoutRequestID || '';
        transaction.checkoutRequestId = response.data?.CheckoutRequestID || '';
        transaction.merchantRequestId = response.data?.MerchantRequestID || '';
        await transaction.save();

        return res.status(200).json({
            success: true,
            message: 'Payment initiated',
            data: {
                reference,
                ...response.data,
            },
        });
    } catch (error) {
        console.error('PayHero error:', error.response?.data || error.message);
        const status = error.response?.status || 500;
        const message = error.response?.data?.message || error.message;
        return res.status(status).json({ success: false, message });
    }
};

// ---------- Callback Handler ----------
exports.handleCallback = async (req, res) => {
    try {
        console.log('Callback received:', JSON.stringify(req.body, null, 2));

        // PayHero places the external reference inside the payload. The exact
        // key can vary by version, so we check the common ones.
        const body = req.body || {};
        const reference =
            body.external_reference ||
            body.ExternalReference ||
            body.reference ||
            body?.data?.external_reference ||
            body?.data?.reference ||
            null;

        if (!reference) {
            console.warn('Callback missing external reference');
            return res.status(200).json({ status: 'received' });
        }

        const transaction = await Transaction.findOne({ reference });
        if (!transaction) {
            console.warn('Callback reference not found:', reference);
            return res.status(200).json({ status: 'received' });
        }

        const resultCode =
            body.result_code ??
            body.ResultCode ??
            body?.data?.result_code ??
            body?.data?.ResultCode ??
            null;

        const resultDescription =
            body.result_description ||
            body.ResultDesc ||
            body?.data?.result_description ||
            '';

        let status = 'pending';
        if (resultCode === 0 || resultCode === '0') {
            status = 'success';
        } else if (resultCode !== null) {
            status = 'failed';
        }

        transaction.callbackPayload = body;
        transaction.resultCode = resultCode;
        transaction.resultDescription = resultDescription;

        if (status !== 'pending') {
            transaction.status = status;
            transaction.completedAt = new Date();
        }

        await transaction.save();
        return res.status(200).json({ status: 'received' });
    } catch (error) {
        console.error('Callback error:', error);
        // Always 200 so PayHero does not retry indefinitely
        return res.status(200).json({ status: 'error' });
    }
};
