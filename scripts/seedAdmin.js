require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

async function main() {
    const { MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;

    if (!MONGODB_URI) throw new Error('MONGODB_URI is missing');
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
        throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
    }
    if (ADMIN_PASSWORD.length < 8) {
        throw new Error('ADMIN_PASSWORD must be at least 8 characters');
    }

    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const email = ADMIN_EMAIL.toLowerCase().trim();
    const existing = await Admin.findOne({ email });
    if (existing) {
        console.log('Admin already exists for', email, '- nothing to do.');
        await mongoose.disconnect();
        return;
    }

    const passwordHash = await Admin.hashPassword(ADMIN_PASSWORD);
    const admin = await Admin.create({
        email,
        passwordHash,
        name: ADMIN_NAME || 'Primary Admin',
        role: 'owner',
    });

    console.log('Admin created:', admin.email);
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
});
