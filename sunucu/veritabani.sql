-- Cloudflare D1 veritabanı tabloları (D1 > Console bölümüne yapıştırılır)
CREATE TABLE IF NOT EXISTS kullanici (ad TEXT PRIMARY KEY, goruntu TEXT NOT NULL, rol TEXT NOT NULL DEFAULT 'ogrenci', tuz TEXT NOT NULL, hash TEXT NOT NULL, toplam INTEGER NOT NULL DEFAULT 0, son_nabiz INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS oturum (jeton TEXT PRIMARY KEY, kullanici TEXT NOT NULL, bitis INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS deneme (ad TEXT PRIMARY KEY, sayi INTEGER NOT NULL, bitis INTEGER NOT NULL);
-- Ödev tabloları (bir sonraki adımda kullanılacak)
CREATE TABLE IF NOT EXISTS odev (id INTEGER PRIMARY KEY AUTOINCREMENT, baslik TEXT NOT NULL, sorular TEXT NOT NULL, tarih INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS atama (id INTEGER PRIMARY KEY AUTOINCREMENT, odev_id INTEGER NOT NULL, ogrenci TEXT NOT NULL, durum TEXT NOT NULL DEFAULT 'bekliyor', cevaplar TEXT, sonuc TEXT, analiz TEXT, teslim INTEGER, onay INTEGER);
