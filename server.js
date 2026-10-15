require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');

const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Database ----------
mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch((err) => {
        console.error('MongoDB connection error:', err.message);
        process.exit(1);
    });

// ---------- Security ----------
app.use(helmet());
app.use(morgan('tiny'));

// ---------- CORS ----------
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            return callback(new Error('CORS: Origin ' + origin + ' not allowed'));
        },
        credentials: true,
    })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------- Routes ----------
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);

// ---------- Health ----------
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
    });
});

app.get('/', (req, res) => {
    res.json({
        name: 'Eagle Master Payment API',
        status: 'running',
        endpoints: {
            initiate: '/api/payments/initiate',
            callback: '/api/payments/callback',
            adminLogin: '/api/admin/login',
        },
    });
});

// ---------- Error handler ----------
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log('Server running on port ' + PORT);
});
