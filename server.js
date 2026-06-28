require('dotenv').config();
const express = require('express');
const cors = require('cors');

const paymentRoutes = require('./routes/paymentRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- CORS: allow your Vercel frontend ----------
const allowedOrigins = [
    'https://sharpness-payhero-frontend.vercel.app',   // ✅ YOUR FRONTEND
    'http://localhost:3000',
    'http://localhost:5173',
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: Origin ${origin} not allowed`));
        }
    },
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- API routes ----------
app.use('/api/payments', paymentRoutes);

// ---------- Health check ----------
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------- Root endpoint ----------
app.get('/', (req, res) => {
    res.json({
        name: 'Bomayangu Payment API',
        status: 'running',
        endpoints: {
            initiate: '/api/payments/initiate',
            callback: '/api/payments/callback',
        },
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
