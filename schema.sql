-- Schema for Aplikasi SPP D1 Database

CREATE TABLE IF NOT EXISTS Admin (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    nama TEXT NOT NULL,
    aksesKelas TEXT
);

CREATE TABLE IF NOT EXISTS Siswa (
    nis TEXT PRIMARY KEY,
    password TEXT,
    nama TEXT,
    kelas TEXT,
    gender TEXT,
    tagihan INTEGER
);

CREATE TABLE IF NOT EXISTS JenisPembayaran (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jenis TEXT NOT NULL,
    nominal INTEGER NOT NULL,
    kelas TEXT,
    adminName TEXT
);

CREATE TABLE IF NOT EXISTS Transaksi (
    id TEXT PRIMARY KEY,
    tanggal TEXT,
    nis TEXT NOT NULL,
    namaSiswa TEXT,
    jenis TEXT,
    jumlah INTEGER,
    admin TEXT
);

CREATE TABLE IF NOT EXISTS Logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT,
    adminName TEXT,
    role TEXT,
    action TEXT,
    detail TEXT,
    kelas TEXT
);

CREATE TABLE IF NOT EXISTS Arsip (
    id TEXT PRIMARY KEY,
    tahunPelajaran TEXT,
    tanggal TEXT,
    totalSiswa INTEGER,
    admin TEXT,
    data TEXT
);

-- Insert Default Admin
INSERT OR IGNORE INTO Admin (username, password, nama, aksesKelas) 
VALUES ('admin', 'admin123', 'Administrator', '');
