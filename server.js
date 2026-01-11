const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const db = require('./config/database');

// --- IMPORT CONTROLLERS ---
const authController = require('./controllers/authController');
const productController = require('./controllers/productController');
const orderController = require('./controllers/orderController');
const adminController = require('./controllers/adminController');

// --- CONFIG MULTER ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './public/uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// --- MIDDLEWARES ---
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'rahasia_pws_super_aman',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 jam
}));

// --- AUTH MIDDLEWARE (API KEY) ---
app.use('/api/products', (req, res, next) => {
    // 1. Izinkan jika user login via web
    if (req.session.loggedin) return next();

    // 2. Izinkan jika pakai API Key (Postman/External)
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return res.status(403).json({ error: 'Access Denied. Login or provide x-api-key.' });

    db.query('SELECT id FROM users WHERE api_key = ?', [apiKey], (err, results) => {
        if (err || results.length === 0) return res.status(403).json({ error: 'Invalid API Key' });
        next();
    });
});

// --- ROUTES ---

// 1. AUTHENTICATION
app.post('/auth/login', authController.login);
app.post('/auth/register', authController.register);
app.get('/auth/logout', authController.logout);
app.get('/api/session/check', authController.checkSession);

// 2. USER API (PROFILE & DEVELOPER)
// Perhatikan nama fungsi ini sudah disesuaikan dengan authController baru
app.get('/api/user/me', authController.getMe);             
app.post('/api/user/generate-key', authController.generateKey); 
app.post('/api/user/validate-key', authController.validateAPIKey);

// 3. PRODUCT API (CRUD)
app.get('/api/products', productController.getAllProducts);
app.get('/api/products/:id', productController.getProductById);
app.post('/api/admin/product', upload.single('gambar'), productController.createProduct);
app.put('/api/admin/product/:id', upload.single('gambar'), productController.updateProduct);
app.delete('/api/admin/product/:id', productController.deleteProduct);
app.post('/api/products/buy/:id', productController.buyProduct);

// 4. ORDER API
app.post('/api/orders/create', orderController.createOrder);
app.get('/api/user/orders', orderController.getUserOrders);
app.get('/api/user/orders/:id', orderController.getOrderById);
app.get('/api/admin/orders', orderController.getAllOrders);
app.put('/api/admin/order/:id/status', orderController.updateOrderStatus);
app.delete('/api/admin/order/:id', orderController.deleteOrder);

// 5. ADMIN MANAGEMENT API
app.get('/api/admin/data', adminController.getDashboardData);
app.post('/api/admin/user', adminController.createUser);
app.get('/api/admin/users', adminController.getAllUsers);
app.get('/api/admin/users/:id', adminController.getUserById);
app.put('/api/admin/user/:id', adminController.updateUser);
app.delete('/api/admin/user/:id', adminController.deleteUser);

// --- START SERVER ---
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});