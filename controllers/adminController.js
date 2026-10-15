const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Transaction = require('../models/Transaction');

function signToken(admin) {
    return jwt.sign(
        { sub: admin._id.toString(), email: admin.email, role: admin.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
    );
}

// POST /api/admin/login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password required' });
        }

        const admin = await Admin.findOne({ email: String(email).toLowerCase().trim() });
        if (!admin || !admin.active) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const ok = await admin.verifyPassword(password);
        if (!ok) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        admin.lastLoginAt = new Date();
        await admin.save();

        const token = signToken(admin);
        return res.json({
            success: true,
            token,
            admin: {
                id: admin._id,
                email: admin.email,
                name: admin.name,
                role: admin.role,
            },
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ success: false, message: 'Login failed' });
    }
};

// GET /api/admin/me
exports.me = async (req, res) => {
    return res.json({
        success: true,
        admin: {
            id: req.admin._id,
            email: req.admin.email,
            name: req.admin.name,
            role: req.admin.role,
            lastLoginAt: req.admin.lastLoginAt,
        },
    });
};

// GET /api/admin/transactions
// Query params: page, limit, status, provider, method, phone, from, to, q
exports.listTransactions = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page || '1', 10), 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        if (req.query.provider) filter.provider = req.query.provider;
        if (req.query.method) filter.method = req.query.method;
        if (req.query.phone) filter.phone = { $regex: String(req.query.phone).replace(/\D/g, '') };

        if (req.query.from || req.query.to) {
            filter.createdAt = {};
            if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
            if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
        }

        if (req.query.q) {
            const needle = String(req.query.q).trim();
            filter.$or = [
                { reference: { $regex: needle, $options: 'i' } },
                { customerName: { $regex: needle, $options: 'i' } },
            ];
        }

        const [items, total] = await Promise.all([
            Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Transaction.countDocuments(filter),
        ]);

        return res.json({
            success: true,
            data: items,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (err) {
        console.error('List transactions error:', err);
        return res.status(500).json({ success: false, message: 'Failed to list transactions' });
    }
};

// GET /api/admin/transactions/:id
exports.getTransaction = async (req, res) => {
    try {
        const tx = await Transaction.findById(req.params.id).lean();
        if (!tx) return res.status(404).json({ success: false, message: 'Not found' });
        return res.json({ success: true, data: tx });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to load transaction' });
    }
};

// DELETE /api/admin/transactions/:id
exports.deleteTransaction = async (req, res) => {
    try {
        const result = await Transaction.findByIdAndDelete(req.params.id);
        if (!result) return res.status(404).json({ success: false, message: 'Not found' });
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to delete transaction' });
    }
};

// GET /api/admin/stats
exports.stats = async (req, res) => {
    try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const [
            total,
            successAgg,
            failedCount,
            pendingCount,
            todayAgg,
            recent,
        ] = await Promise.all([
            Transaction.countDocuments({}),
            Transaction.aggregate([
                { $match: { status: 'success' } },
                { $group: { _id: null, count: { $sum: 1 }, sum: { $sum: '$amount' } } },
            ]),
            Transaction.countDocuments({ status: 'failed' }),
            Transaction.countDocuments({ status: 'pending' }),
            Transaction.aggregate([
                { $match: { status: 'success', createdAt: { $gte: startOfToday } } },
                { $group: { _id: null, count: { $sum: 1 }, sum: { $sum: '$amount' } } },
            ]),
            Transaction.find({}).sort({ createdAt: -1 }).limit(5).lean(),
        ]);

        const successCount = successAgg[0]?.count || 0;
        const successSum = successAgg[0]?.sum || 0;
        const todayCount = todayAgg[0]?.count || 0;
        const todaySum = todayAgg[0]?.sum || 0;
        const successRate = total > 0 ? Math.round((successCount / total) * 1000) / 10 : 0;

        return res.json({
            success: true,
            data: {
                total,
                successCount,
                successSum,
                failedCount,
                pendingCount,
                successRate,
                today: { count: todayCount, sum: todaySum },
                recent,
            },
        });
    } catch (err) {
        console.error('Stats error:', err);
        return res.status(500).json({ success: false, message: 'Failed to load stats' });
    }
};
