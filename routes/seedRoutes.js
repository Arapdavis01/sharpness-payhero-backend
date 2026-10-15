const express = require('express');
const Admin = require('../models/Admin');

const router = express.Router();

// TEMPORARY route. Delete this file and its use in server.js after seeding.
router.post('/admin', async (req, res) => {
    try {
        const secret = req.headers['x-seed-secret'];
        if (!secret || secret !== process.env.JWT_SECRET) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
        if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
            return res.status(500).json({ success: false, message: 'ADMIN_EMAIL or ADMIN_PASSWORD missing in env' });
        }

        const email = ADMIN_EMAIL.toLowerCase().trim();
        const existing = await Admin.findOne({ email });
        if (existing) {
            return res.json({ success: true, message: 'Admin already exists', email });
        }

        const passwordHash = await Admin.hashPassword(ADMIN_PASSWORD);
        const admin = await Admin.create({
            email,
            passwordHash,
            name: ADMIN_NAME || 'Primary Admin',
            role: 'owner',
        });

        return res.json({ success: true, message: 'Admin created', email: admin.email });
    } catch (err) {
        console.error('Seed route error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
