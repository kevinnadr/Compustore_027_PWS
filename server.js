const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer'); // Library upload file
const path = require('path');
const fs = require('fs');

const app = express();

// --- 1. KONFIGURASI DATABASE ---
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',      // Sesuaikan user database Anda
    password: 'Kevinnadr123',      // Sesuaikan password database Anda
    database: 'tugaspws_db',
    port: 3308
});

db.connect((err) => {
    if (err) throw err;
    console.log('Terhubung ke database tugaspws_db...');
    
    // Buat tabel orders jika belum ada
    const createOrdersTable = `
        CREATE TABLE IF NOT EXISTS orders (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT,
            customer_name VARCHAR(255),
            phone VARCHAR(20),
            province VARCHAR(100),
            city VARCHAR(100),
            postal_code VARCHAR(10),
            address TEXT,
            payment_method VARCHAR(50),
            items JSON,
            subtotal INT,
            shipping_cost INT,
            total_amount INT,
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `;
    
    db.query(createOrdersTable, (err) => {
        if (err) console.error('Error creating orders table:', err);
        else console.log('Orders table ready');
    });
});

// --- 2. KONFIGURASI MULTER (UPLOAD GAMBAR) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './public/uploads';
        // Buat folder jika belum ada
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Nama file unik: timestamp-namaasli.jpg
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// --- 3. MIDDLEWARE ---
app.use(express.static('public')); // Folder untuk file HTML, CSS, JS frontend
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'rahasia_pws_super_aman', // Secret key session
    resave: false,
    saveUninitialized: true
}));

// CORS headers untuk session cookies
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    next();
});

// --- 4. ROUTES AUTHENTICATION ---

// Login
app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, results) => {
        if (results.length > 0) {
            req.session.loggedin = true;
            req.session.userid = results[0].id;
            req.session.role = results[0].role;
            
            // Redirect sesuai role
            res.json({ 
                success: true, 
                redirect: results[0].role === 'admin' ? '/admin_dashboard.html' : '/user_dashboard.html' 
            });
        } else {
            res.json({ success: false, message: 'Username atau Password Salah' });
        }
    });
});

// Register
app.post('/auth/register', (req, res) => {
    const { username, password, role } = req.body;
    
    // Validasi role (hanya admin atau user)
    const validRole = (role === 'admin' || role === 'user') ? role : 'user';

    db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, password, validRole], (err) => {
        if (err) {
            return res.json({ success: false, message: 'Username sudah digunakan' });
        }
        res.json({ success: true });
    });
});

// Logout
app.get('/auth/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/index.html');
});

// --- MIDDLEWARE: Validasi API Key dari Header ---
app.use('/api/products', (req, res, next) => {
    // Cek apakah sudah login via session
    if (req.session.product_access) {
        return next();
    }

    // Cek API Key dari header (untuk API Explorer)
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        return res.status(403).json({ error: 'Akses Ditolak. Input API Key dulu.' });
    }

    // Validasi API Key dari database
    db.query('SELECT id FROM users WHERE api_key = ?', [apiKey], (err, results) => {
        if (err || results.length === 0) {
            return res.status(403).json({ error: 'API Key tidak valid' });
        }
        
        // API Key valid, lanjutkan
        req.validatedApiKey = apiKey;
        next();
    });
});

// --- 5. ROUTES API UNTUK USER (PEMBELI) ---

// Ambil info user yang sedang login
app.get('/api/user/me', (req, res) => {
    if (!req.session.loggedin) return res.status(401).json({ error: 'Unauthorized' });
    
    db.query('SELECT username, api_key FROM users WHERE id = ?', [req.session.userid], (err, result) => {
        res.json(result[0]);
    });
});

// Cek session status
app.get('/api/session/check', (req, res) => {
    if (req.session.loggedin) {
        res.json({ loggedin: true, userid: req.session.userid, role: req.session.role });
    } else {
        res.json({ loggedin: false });
    }
});

// Generate API Key Baru
app.post('/api/user/generate-key', (req, res) => {
    if (!req.session.loggedin) return res.status(401).json({ error: 'Unauthorized' });
    
    const newKey = uuidv4(); // Buat UUID unik
    db.query('UPDATE users SET api_key = ? WHERE id = ?', [newKey, req.session.userid], () => {
        res.json({ success: true, api_key: newKey });
    });
});

// Validasi API Key (Pintu Masuk ke Toko)
app.post('/api/user/validate-key', (req, res) => {
    if (!req.session.loggedin) return res.status(401).json({ error: 'Unauthorized' });
    
    const { input_key } = req.body;
    // Cek apakah key cocok dengan user yang login
    db.query('SELECT * FROM users WHERE id = ? AND api_key = ?', [req.session.userid, input_key], (err, results) => {
        if (results.length > 0) {
            req.session.product_access = true; // Beri akses sesi
            res.json({ success: true });
        } else {
            res.json({ success: false });
        }
    });
});

// List Produk (Validasi via middleware)
app.get('/api/products', (req, res) => {
    db.query('SELECT * FROM products', (err, results) => {
        res.json(results);
    });
});

// Beli Produk (Validasi via middleware)
app.post('/api/products/buy/:id', (req, res) => {
    db.query('UPDATE products SET stok = stok - 1 WHERE id = ? AND stok > 0', [req.params.id], (err, result) => {
        if (result.changedRows > 0) {
            res.json({ success: true, message: 'Pembelian Berhasil!' });
        } else {
            res.json({ success: false, message: 'Stok Habis' });
        }
    });
});

// --- 6. ROUTES API UNTUK ORDERS ---

// Buat Pesanan Baru
app.post('/api/orders/create', (req, res) => {
    if (!req.session.loggedin) return res.status(401).json({ success: false, message: 'Unauthorized' });
    
    const { fullName, phone, province, city, postalCode, address, paymentMethod, items, subtotal, shippingCost, totalAmount } = req.body;
    
    // Validasi input
    if (!fullName || !phone || !address || !paymentMethod || !items || items.length === 0) {
        return res.json({ success: false, message: 'Data tidak lengkap' });
    }
    
    const user_id = req.session.userid;
    const itemsJSON = JSON.stringify(items);
    
    const sql = `INSERT INTO orders (user_id, customer_name, phone, province, city, postal_code, address, payment_method, items, subtotal, shipping_cost, total_amount, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`;
    
    db.query(sql, [user_id, fullName, phone, province, city, postalCode, address, paymentMethod, itemsJSON, subtotal, shippingCost, totalAmount], (err, result) => {
        if (err) {
            console.error('Error creating order:', err);
            return res.json({ success: false, message: 'Gagal membuat pesanan' });
        }
        res.json({ success: true, orderId: result.insertId, message: 'Pesanan berhasil dibuat' });
    });
});

// Ambil History Order User (untuk user sendiri)
app.get('/api/user/orders', (req, res) => {
    if (!req.session.loggedin) return res.status(401).json({ success: false, message: 'Unauthorized' });
    
    const user_id = req.session.userid;
    db.query('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [user_id], (err, results) => {
        if (err) {
            console.error('Error fetching orders:', err);
            return res.json([]);
        }
        res.json(results);
    });
});

// --- 7. ROUTES API UNTUK ADMIN (PENGELOLA) ---

// Ambil Semua Data (Produk & User)
app.get('/api/admin/data', (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).json({ error: 'Bukan Admin' });
    
    const queryProds = 'SELECT * FROM products';
    const queryUsers = 'SELECT id, username, password, api_key, role FROM users WHERE role="user"'; 
    
    db.query(queryProds, (err, products) => {
        db.query(queryUsers, (err, users) => {
            res.json({ products, users });
        });
    });
});

// --- API PRODUK (ADMIN) ---

// Tambah Produk Baru (dengan Upload Gambar)
app.post('/api/admin/product', upload.single('gambar'), (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).json({ error: 'Bukan Admin' });
    
    const { nama, harga, stok, deskripsi } = req.body;
    const gambar = req.file ? '/uploads/' + req.file.filename : null; 

    const sql = 'INSERT INTO products (nama_barang, harga, stok, deskripsi, gambar) VALUES (?,?,?,?,?)';
    db.query(sql, [nama, harga, stok, deskripsi, gambar], () => {
        res.json({ success: true });
    });
});

// Edit Produk (PUT) - Handle Gambar Baru atau Lama
app.put('/api/admin/product/:id', upload.single('gambar'), (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).json({ error: 'Bukan Admin' });

    const { nama, harga, stok, deskripsi } = req.body;
    const id = req.params.id;
    
    let sql;
    let params;

    if (req.file) {
        // Jika admin upload gambar baru -> Update kolom gambar juga
        const gambar = '/uploads/' + req.file.filename;
        sql = 'UPDATE products SET nama_barang = ?, harga = ?, stok = ?, deskripsi = ?, gambar = ? WHERE id = ?';
        params = [nama, harga, stok, deskripsi, gambar, id];
    } else {
        // Jika tidak upload gambar -> Update data teks saja
        sql = 'UPDATE products SET nama_barang = ?, harga = ?, stok = ?, deskripsi = ? WHERE id = ?';
        params = [nama, harga, stok, deskripsi, id];
    }

    db.query(sql, params, (err) => {
        if (err) {
            console.error(err);
            return res.json({ success: false });
        }
        res.json({ success: true });
    });
});

// Hapus Produk
app.delete('/api/admin/product/:id', (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).json({ error: 'Bukan Admin' });
    
    db.query('DELETE FROM products WHERE id = ?', [req.params.id], () => {
        res.json({ success: true });
    });
});

// --- API USER MANAGEMENT (ADMIN) ---

// Tambah User (Manual oleh Admin)
app.post('/api/admin/user', (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).json({ error: 'Bukan Admin' });
    
    const { username, password } = req.body;
    db.query('INSERT INTO users (username, password, role) VALUES (?, ?, "user")', [username, password], (err) => {
        if (err) return res.json({ success: false, message: 'Username sudah ada' });
        res.json({ success: true });
    });
});

// Edit User (Ganti Username/Password)
app.put('/api/admin/user/:id', (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).json({ error: 'Bukan Admin' });
    
    const { username, password } = req.body;
    db.query('UPDATE users SET username = ?, password = ? WHERE id = ?', [username, password, req.params.id], (err) => {
        if (err) return res.json({ success: false });
        res.json({ success: true });
    });
});

// Hapus User
app.delete('/api/admin/user/:id', (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).json({ error: 'Bukan Admin' });
    
    db.query('DELETE FROM users WHERE id = ?', [req.params.id], () => {
        res.json({ success: true });
    });
});

// --- API ORDERS MANAGEMENT (ADMIN) ---

// Ambil Semua Orders (untuk Admin)
app.get('/api/admin/orders', (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).json({ error: 'Bukan Admin' });
    
    db.query('SELECT * FROM orders ORDER BY created_at DESC', (err, results) => {
        if (err) {
            console.error('Error fetching orders:', err);
            return res.json([]);
        }
        res.json(results);
    });
});

// Update Status Order (Admin)
app.put('/api/admin/order/:id/status', (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).json({ error: 'Bukan Admin' });
    
    const { status } = req.body;
    const validStatus = ['pending', 'send', 'cancel'];
    
    if (!validStatus.includes(status)) {
        return res.json({ success: false, message: 'Status tidak valid' });
    }
    
    db.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id], (err) => {
        if (err) {
            console.error('Error updating order status:', err);
            return res.json({ success: false });
        }
        res.json({ success: true });
    });
});

// Jalankan Server
app.listen(3000, () => {
    console.log('Server berjalan di http://localhost:3000');
});