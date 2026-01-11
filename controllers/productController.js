const db = require('../config/database');
const fs = require('fs');
const path = require('path');

// --- GET ALL PRODUCTS ---
exports.getAllProducts = (req, res) => {
    // Filter Query (Optional)
    const { search, kategori } = req.query;
    let sql = 'SELECT * FROM products WHERE 1=1';
    let params = [];

    if (search) {
        sql += ' AND (nama_barang LIKE ? OR deskripsi LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }
    if (kategori) {
        sql += ' AND kategori = ?'; // Pastikan kolom kategori ada di DB jika fitur ini aktif
        params.push(kategori);
    }
    
    sql += ' ORDER BY id DESC';

    db.query(sql, params, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
};

// --- GET SINGLE PRODUCT ---
exports.getProductById = (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM products WHERE id = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (results.length === 0) return res.status(404).json({ error: 'Produk tidak ditemukan' });
        res.json(results[0]);
    });
};

// --- CREATE PRODUCT (Admin) ---
exports.createProduct = (req, res) => {
    const { nama, harga, stok, deskripsi } = req.body;
    // Gambar dari Multer (req.file)
    const gambar = req.file ? `/uploads/${req.file.filename}` : null;

    if (!nama || !harga || !stok) {
        return res.status(400).json({ error: 'Nama, Harga, dan Stok wajib diisi' });
    }

    const sql = 'INSERT INTO products (nama_barang, harga, stok, deskripsi, gambar) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [nama, harga, stok, deskripsi, gambar], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Gagal menambah produk' });
        }
        res.json({ success: true, message: 'Produk berhasil ditambahkan', id: result.insertId });
    });
};

// --- UPDATE PRODUCT (Admin) ---
exports.updateProduct = (req, res) => {
    const { id } = req.params;
    const { nama, harga, stok, deskripsi } = req.body;
    
    // Cek apakah ada gambar baru
    let sql = 'UPDATE products SET nama_barang=?, harga=?, stok=?, deskripsi=?';
    let params = [nama, harga, stok, deskripsi];

    if (req.file) {
        sql += ', gambar=?';
        params.push(`/uploads/${req.file.filename}`);
        
        // (Opsional) Hapus gambar lama di sini jika perlu
    }

    sql += ' WHERE id=?';
    params.push(id);

    db.query(sql, params, (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Gagal update' });
        res.json({ success: true, message: 'Produk berhasil diupdate' });
    });
};

// --- DELETE PRODUCT (Admin) ---
exports.deleteProduct = (req, res) => {
    const { id } = req.params;
    
    // Ambil info gambar dulu untuk dihapus filenya
    db.query('SELECT gambar FROM products WHERE id = ?', [id], (err, results) => {
        if (!err && results.length > 0 && results[0].gambar) {
            const filePath = path.join(__dirname, '../public', results[0].gambar);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // Hapus file fisik
        }

        db.query('DELETE FROM products WHERE id = ?', [id], (err) => {
            if (err) return res.status(500).json({ success: false });
            res.json({ success: true });
        });
    });
};

// --- BUY PRODUCT (Kurangi Stok) ---
exports.buyProduct = (req, res) => {
    const { id } = req.params;
    db.query('UPDATE products SET stok = stok - 1 WHERE id = ? AND stok > 0', [id], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: 'Database error' });
        if (result.affectedRows === 0) return res.status(400).json({ success: false, message: 'Stok habis' });
        res.json({ success: true, message: 'Pembelian berhasil' });
    });
};