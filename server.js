const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer'); // Library upload file
const path = require('path');
const fs = require('fs');

const app = express();

// --- 1. IMPORT DATABASE ---
const db = require('./config/database');

// --- 2. IMPORT CONTROLLERS ---
const authController = require('./controllers/authController');
const productController = require('./controllers/productController');
const orderController = require('./controllers/orderController');
const adminController = require('./controllers/adminController');

// --- 3. KONFIGURASI MULTER (UPLOAD GAMBAR) ---
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

// --- 4. MIDDLEWARE ---
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

// --- 5. MIDDLEWARE: Validasi API Key dari Header ---
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

// --- 6. ROUTES AUTHENTICATION ---
app.post('/auth/login', authController.login);
app.post('/auth/register', authController.register);
app.get('/auth/logout', authController.logout);
app.get('/api/session/check', authController.checkSession);

// --- 7. ROUTES API USER ---
app.get('/api/user/me', authController.getUserInfo);
app.post('/api/user/generate-key', authController.generateAPIKey);
app.post('/api/user/validate-key', authController.validateAPIKey);

// --- 8. ROUTES API PRODUK (CRUD) ---
app.get('/api/products', productController.getAllProducts);
app.get('/api/products/:id', productController.getProductById);
app.post('/api/admin/product', upload.single('gambar'), productController.createProduct);
app.put('/api/admin/product/:id', upload.single('gambar'), productController.updateProduct);
app.delete('/api/admin/product/:id', productController.deleteProduct);
app.post('/api/products/buy/:id', productController.buyProduct);

// --- 9. ROUTES API ORDERS ---
app.post('/api/orders/create', orderController.createOrder);
app.get('/api/user/orders', orderController.getUserOrders);
app.get('/api/user/orders/:id', orderController.getOrderById);
app.get('/api/admin/orders', orderController.getAllOrders);
app.get('/api/admin/orders/:id', orderController.getOrderByIdAdmin);
app.put('/api/admin/order/:id/status', orderController.updateOrderStatus);
app.delete('/api/admin/order/:id', orderController.deleteOrder);

// --- 10. ROUTES ADMIN (USER MANAGEMENT) ---
app.get('/api/admin/data', adminController.getDashboardData);
app.post('/api/admin/user', adminController.createUser);
app.get('/api/admin/users', adminController.getAllUsers);
app.get('/api/admin/users/:id', adminController.getUserById);
app.put('/api/admin/user/:id', adminController.updateUser);
app.delete('/api/admin/user/:id', adminController.deleteUser);

// --- 11. JALANKAN SERVER ---
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║   🚀 CompuStore Server Berjalan                        ║
║   📍 http://localhost:${PORT}                              ║
║   ✓ Database Connected                                 ║
║   ✓ Controllers Loaded                                 ║
╚════════════════════════════════════════════════════════╝
    `);
});