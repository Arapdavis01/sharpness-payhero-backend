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

        // Our reference wins over whatever PayHero returns.
        return res.status(200).json({
            success: true,
            message: 'Payment initiated',
            data: {
                ...response.data,
                reference: reference,
                external_reference: reference,
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
// PayHero wraps its data inside a top-level "response" object. Example:
// {
//   "status": true,
//   "response": {
//     "ExternalReference": "EM-...",
//     "ResultCode": 0,
//     "Status": "Success",
//     "MpesaReceiptNumber": "...",
//     "Amount": 5,
//     "Phone": "254...",
//     "MerchantRequestID": "...",
//     "CheckoutRequestID": "...",
//     "ResultDesc": "..."
//   },
//   "sent_at": "..."
// }
exports.handleCallback = async (req, res) => {
    try {
        console.log('Callback received:', JSON.stringify(req.body, null, 2));

        const body = req.body || {};
        const r = body.response || body.data || body;

        // Reference can be at the top level or inside response
        const reference =
            r.ExternalReference ||
            r.external_reference ||
            r.reference ||
            body.external_reference ||
            body.reference ||
            null;

        if (!reference) {
            console.warn('Callback missing external reference. Payload:', body);
            return res.status(200).json({ status: 'received' });
        }

        const transaction = await Transaction.findOne({ reference });
        if (!transaction) {
            console.warn('Callback reference not found:', reference);
            return res.status(200).json({ status: 'received' });
        }

        // Already processed? Do not overwrite terminal states.
        if (transaction.status === 'success' || transaction.status === 'failed') {
            console.log('Transaction already finalized:', reference, transaction.status);
            return res.status(200).json({ status: 'received' });
        }

        const resultCode = r.ResultCode ?? r.result_code ?? null;
        const resultDescription = r.ResultDesc || r.result_description || '';
        const payheroStatus = r.Status || r.status || '';

        let status = 'pending';
        if (resultCode === 0 || resultCode === '0' || String(payheroStatus).toLowerCase() === 'success') {
            status = 'success';
        } else if (resultCode !== null || payheroStatus) {
            status = 'failed';
        }

        transaction.callbackPayload = body;
        transaction.resultCode = resultCode;
        transaction.resultDescription = resultDescription;
        transaction.payheroReference = transaction.payheroReference || r.MpesaReceiptNumber || '';
        transaction.checkoutRequestId = transaction.checkoutRequestId || r.CheckoutRequestID || '';
        transaction.merchantRequestId = transaction.merchantRequestId || r.MerchantRequestID || '';

        if (status !== 'pending') {
            transaction.status = status;
            transaction.completedAt = new Date();
        }

        await transaction.save();
        console.log('Transaction updated:', reference, '->', status);
        return res.status(200).json({ status: 'received' });
    } catch (error) {
        console.error('Callback error:', error);
        return res.status(200).json({ status: 'error' });
    }
};

// ---------- Get Payment Status (for frontend polling) ----------
// Public endpoint. Returns only the fields the payment page needs.
// The reference itself acts as a bearer token for this specific transaction.
exports.getPaymentStatus = async (req, res) => {
    try {
        const { reference } = req.params;
        if (!reference) {
            return res.status(400).json({ success: false, message: 'Reference required' });
        }

        const transaction = await Transaction.findOne({ reference })
            .select('reference status amount phone completedAt resultCode resultDescription')
            .lean();

        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }

        return res.json({
            success: true,
            data: {
                reference: transaction.reference,
                status: transaction.status,
                amount: transaction.amount,
                phone: transaction.phone,
                completedAt: transaction.completedAt,
                resultCode: transaction.resultCode,
                resultDescription: transaction.resultDescription,
            },
        });
    } catch (err) {
        console.error('Get payment status error:', err);
        return res.status(500).json({ success: false, message: 'Failed to get status' });
    }
};
