const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// --- REGISTER ---
exports.register = (req, res) => {
    const { nama, email, password, no_hp, role } = req.body;
    if (!nama || !email || !password || !no_hp) {
        return res.status(400).json({ success: false, message: 'Data tidak lengkap!' });
    }
    const userRole = role || 'user';
    const apiKey = `CS-${uuidv4().split('-')[0].toUpperCase()}`;

    db.query('INSERT INTO users (nama, email, password, no_hp, role, api_key) VALUES (?, ?, ?, ?, ?, ?)', 
    [nama, email, password, no_hp, userRole, apiKey], (err) => {
        if (err) {
            if(err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Email sudah dipakai!' });
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, message: 'Registrasi berhasil' });
    });
};

// --- LOGIN ---
exports.login = (req, res) => {
    const { email, password } = req.body;
    db.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], (err, results) => {
        if (err || results.length === 0) return res.status(401).json({ success: false, message: 'Email/Password salah!' });

        const user = results[0];
        req.session.loggedin = true;
        req.session.userId = user.id;
        req.session.username = user.nama;
        req.session.role = user.role;
        if (user.role === 'user') req.session.product_access = true;

        res.json({ success: true, role: user.role });
    });
};

// --- LOGOUT ---
exports.logout = (req, res) => {
    req.session.destroy(() => res.redirect('/index.html'));
};

// --- GET CURRENT USER (ME) ---
exports.getMe = (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    db.query('SELECT id, nama as username, email, role, api_key FROM users WHERE id = ?', [req.session.userId], (err, results) => {
        if (err || !results.length) return res.status(404).json({ error: 'User not found' });
        res.json(results[0]);
    });
};

// --- GENERATE API KEY ---
exports.generateKey = (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false });
    const newKey = `CS-${uuidv4().split('-')[0].toUpperCase()}`;
    db.query('UPDATE users SET api_key = ? WHERE id = ?', [newKey, req.session.userId], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, api_key: newKey });
    });
};

// --- VALIDATE API KEY (Untuk Developer Console) ---
exports.validateAPIKey = (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { input_key } = req.body;
    db.query('SELECT id FROM users WHERE id = ? AND api_key = ?', [req.session.userId, input_key], (err, results) => {
        if (err || results.length === 0) return res.json({ success: false, message: 'Key tidak valid' });
        res.json({ success: true, message: 'Valid' });
    });
};

// --- CHECK SESSION (Opsional/Legacy) ---
exports.checkSession = (req, res) => {
    res.json({ loggedin: !!req.session.userId, role: req.session.role });
};