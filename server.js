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

// ---------- Trust proxy (Render sits behind a proxy) ----------
app.set('trust proxy', 1);

// ---------- Security middleware ----------
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
            // Allow non-browser clients (curl, Postman, server-to-server)
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            return callback(new Error('CORS: Origin ' + origin + ' not allowed'));
        },
        credentials: true,
    })
);

// ---------- Body parsers ----------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------- Routes ----------
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);

// ---------- Health check ----------
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
    });
});

// ---------- Root ----------
app.get('/', (req, res) => {
    res.json({
        name: 'Eagle Master Payment API',
        status: 'running',
        endpoints: {
            initiate: '/api/payments/initiate',
            callback: '/api/payments/callback',
            adminLogin: '/api/admin/login',
            adminStats: '/api/admin/stats',
            adminTransactions: '/api/admin/transactions',
            health: '/health',
        },
    });
});

// ---------- 404 handler ----------
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found: ' + req.method + ' ' + req.originalUrl });
});

// ---------- Global error handler ----------
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.message);
    if (err.message && err.message.startsWith('CORS:')) {
        return res.status(403).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
});

// ---------- Graceful shutdown ----------
async function shutdown(signal) {
    console.log(signal + ' received. Shutting down gracefully...');
    try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed.');
        process.exit(0);
    } catch (err) {
        console.error('Error during shutdown:', err.message);
        process.exit(1);
    }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ---------- Bootstrap: connect DB first, then listen ----------
(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected');

        app.listen(PORT, () => {
            console.log('Server running on port ' + PORT);
            console.log('Environment: ' + (process.env.NODE_ENV || 'development'));
        });
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        process.exit(1);
    }
})();
