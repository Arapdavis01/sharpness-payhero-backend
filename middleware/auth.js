const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ success: false, message: 'Missing token' });
    }

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    Admin.findById(payload.sub)
        .then((admin) => {
            if (!admin || !admin.active) {
                return res.status(401).json({ success: false, message: 'Admin not found or inactive' });
            }
            req.admin = admin;
            next();
        })
        .catch(() => res.status(500).json({ success: false, message: 'Auth lookup failed' }));
}

module.exports = { requireAuth };
