const db = require('../config/database');

// --- GET DASHBOARD DATA (Users & Products) ---
exports.getDashboardData = async (req, res) => {
    try {
        // Ambil data Produk
        const [products] = await db.promise().query('SELECT * FROM products ORDER BY id DESC');
        
        // Ambil data Users (Lengkap)
        const [users] = await db.promise().query('SELECT id, nama, email, password, no_hp, role, api_key FROM users ORDER BY id DESC');
        
        res.json({ products: products, users: users });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};

// --- CREATE USER (Admin) ---
exports.createUser = (req, res) => {
    const { nama, email, password, no_hp, role } = req.body;
    
    if(!nama || !email || !password) {
        return res.status(400).json({success: false, message: 'Data tidak lengkap'});
    }

    const sql = 'INSERT INTO users (nama, email, password, no_hp, role) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [nama, email, password, no_hp, role || 'user'], (err) => {
        if(err) {
            if(err.code === 'ER_DUP_ENTRY') return res.status(400).json({success: false, message: 'Email sudah dipakai'});
            return res.status(500).json({success: false, message: err.message});
        }
        res.json({success: true});
    });
};

// --- UPDATE USER (Admin) ---
exports.updateUser = (req, res) => {
    const { id } = req.params;
    const { nama, email, password, no_hp, role } = req.body;
    
    let sql = 'UPDATE users SET nama=?, email=?, no_hp=?, role=?';
    let params = [nama, email, no_hp, role];

    // Hanya update password jika diisi
    if(password && password.trim() !== "") {
        sql += ', password=?';
        params.push(password);
    }
    
    sql += ' WHERE id=?';
    params.push(id);

    db.query(sql, params, (err) => {
        if(err) return res.status(500).json({success: false, message: 'Gagal update user'});
        res.json({success: true});
    });
};

// --- DELETE USER (Admin) ---
exports.deleteUser = (req, res) => {
    const { id } = req.params;
    
    // Opsional: Hapus order user ini dulu atau biarkan (tergantung constraint DB)
    db.query('DELETE FROM users WHERE id = ?', [id], (err) => {
        if(err) return res.status(500).json({success: false, message: 'Gagal hapus'});
        res.json({success: true});
    });
};

// --- GET ALL USERS (Admin) ---
exports.getAllUsers = (req, res) => {
    db.query('SELECT id, nama, email, no_hp, role, api_key FROM users ORDER BY id DESC', (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(results);
    });
};

// --- GET USER BY ID (Admin) ---
exports.getUserById = (req, res) => {
    const { id } = req.params;
    db.query('SELECT id, nama, email, password, no_hp, role, api_key FROM users WHERE id = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (results.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(results[0]);
    });
};