const mysql = require('mysql2');

// Konfigurasi Database Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',              // Sesuaikan user database Anda
    password: 'Kevinnadr123',   // Sesuaikan password database Anda
    database: 'tugaspws_db',
    port: 3308
});

// Koneksi ke Database
db.connect((err) => {
    if (err) throw err;
    console.log('✓ Terhubung ke database tugaspws_db...');
    
    // Buat tabel users jika belum ada
    const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
            id INT PRIMARY KEY AUTO_INCREMENT,
            username VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            api_key VARCHAR(255),
            role ENUM('admin', 'user') DEFAULT 'user'
        )
    `;
    
    // Buat tabel products jika belum ada
    const createProductsTable = `
        CREATE TABLE IF NOT EXISTS products (
            id INT PRIMARY KEY AUTO_INCREMENT,
            nama_barang VARCHAR(255),
            harga INT,
            stok INT,
            deskripsi TEXT,
            gambar VARCHAR(255)
        )
    `;
    
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
    
    // Execute semua query pembuatan tabel
    db.query(createUsersTable, (err) => {
        if (err) console.error('Error creating users table:', err);
        else console.log('✓ Users table ready');
    });
    
    db.query(createProductsTable, (err) => {
        if (err) console.error('Error creating products table:', err);
        else console.log('✓ Products table ready');
    });
    
    db.query(createOrdersTable, (err) => {
        if (err) console.error('Error creating orders table:', err);
        else console.log('✓ Orders table ready');
    });
});

module.exports = db;
