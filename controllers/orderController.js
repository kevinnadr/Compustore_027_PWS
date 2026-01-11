const db = require('../config/database');

// --- CREATE ORDER (User Checkout with Transaction) ---
exports.createOrder = async (req, res) => {
    const userId = req.session.userId; // Dari session

    if (!userId) {
        return res.status(401).json({ success: false, message: 'Silakan login terlebih dahulu' });
    }

    const { 
        fullName, phone, province, city, postalCode, address, 
        paymentMethod, items, subtotal, shippingCost, totalAmount 
    } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Keranjang kosong' });
    }

    // Gunakan Promise Connection untuk Transaction
    const connection = await db.promise().getConnection();

    try {
        await connection.beginTransaction();

        // 1. Insert ke Tabel Orders
        const [orderRes] = await connection.query(
            `INSERT INTO orders (
                user_id, customer_name, phone, province, city, postal_code, address, 
                payment_method, subtotal, shipping_cost, total_amount, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
            [userId, fullName, phone, province, city, postalCode, address, paymentMethod, subtotal, shippingCost, totalAmount]
        );

        const orderId = orderRes.insertId;

        // 2. Insert ke Tabel Order Details & Kurangi Stok
        for (const item of items) {
            // Insert Detail
            await connection.query(
                `INSERT INTO order_details (order_id, product_id, product_name, price, quantity, total) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [orderId, item.id, item.nama, item.harga, item.quantity, (item.harga * item.quantity)]
            );

            // Update Stok Produk
            await connection.query(
                'UPDATE products SET stok = stok - ? WHERE id = ?',
                [item.quantity, item.id]
            );
        }

        await connection.commit();
        res.json({ success: true, message: 'Pesanan berhasil dibuat', orderId });

    } catch (error) {
        await connection.rollback();
        console.error('Checkout Error:', error);
        res.status(500).json({ success: false, message: 'Gagal memproses pesanan' });
    } finally {
        connection.release();
    }
};

// --- GET USER ORDERS (Riwayat) ---
exports.getUserOrders = (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const sql = `
        SELECT o.id, o.total_amount, o.status, o.created_at, o.payment_method,
        GROUP_CONCAT(od.product_name SEPARATOR ', ') as items_preview
        FROM orders o
        LEFT JOIN order_details od ON o.id = od.order_id
        WHERE o.user_id = ?
        GROUP BY o.id
        ORDER BY o.created_at DESC
    `;

    db.query(sql, [userId], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(results);
    });
};

// --- GET ALL ORDERS (Admin) ---
exports.getAllOrders = (req, res) => {
    // Admin check middleware should cover this route
    const sql = `
        SELECT o.*, GROUP_CONCAT(od.product_name SEPARATOR ', ') as items_preview 
        FROM orders o
        LEFT JOIN order_details od ON o.id = od.order_id
        GROUP BY o.id
        ORDER BY o.created_at DESC
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: 'Error fetching orders' });
        res.json(results);
    });
};

// --- UPDATE ORDER STATUS (Admin) ---
exports.updateOrderStatus = (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // 'send' or 'cancel'

    db.query('UPDATE orders SET status = ? WHERE id = ?', [status, id], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
};

// --- GET ORDER BY ID (User - Own Orders) ---
exports.getOrderById = (req, res) => {
    const { id } = req.params;
    const userId = req.session.userId;

    if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    db.query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [id, userId], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (results.length === 0) return res.status(404).json({ error: 'Order not found' });
        res.json(results[0]);
    });
};

// --- DELETE ORDER (Admin) ---
exports.deleteOrder = (req, res) => {
    const { id } = req.params;

    db.query('DELETE FROM orders WHERE id = ?', [id], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: 'Database error' });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Order not found' });
        res.json({ success: true, message: 'Order deleted' });
    });
};