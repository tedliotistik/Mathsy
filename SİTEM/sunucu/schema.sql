-- MATHSY veritabanı tabloları (Cloudflare D1)
-- D1 > veritabanın > Console sekmesine yapıştırıp çalıştır.

CREATE TABLE IF NOT EXISTS kullanicilar (
  ad         TEXT PRIMARY KEY,          -- kullanıcı adı (küçük harf)
  goruntu    TEXT NOT NULL,             -- ekranda görünen ad
  rol        TEXT NOT NULL,             -- 'ogrenci' ya da 'ogretmen'
  sinif      TEXT,                      -- 5, 6, 7 ...
  sifre_hash TEXT NOT NULL,
  tuz        TEXT NOT NULL,
  toplam     INTEGER NOT NULL DEFAULT 0, -- toplam aktif süre (saniye)
  son_nabiz  INTEGER                     -- son aktiflik (unix saniye)
);

CREATE TABLE IF NOT EXISTS oturumlar (
  jeton_hash TEXT PRIMARY KEY,
  ad         TEXT NOT NULL,
  olusturma  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS odevler (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  baslik  TEXT NOT NULL,
  sorular TEXT NOT NULL,                 -- JSON (doğru cevaplar dahil, öğrenciye gitmez)
  tarih   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS atamalar (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  odev_id       INTEGER NOT NULL,
  ogrenci       TEXT NOT NULL,
  durum         TEXT NOT NULL DEFAULT 'bekliyor',  -- bekliyor | kontrol | tamam
  cevaplar      TEXT,
  teslim_tarih  INTEGER,
  dogru         INTEGER,
  toplam        INTEGER,
  analiz        TEXT,
  geri_bildirim TEXT
);
CREATE INDEX IF NOT EXISTS atama_ogrenci ON atamalar (ogrenci);
CREATE INDEX IF NOT EXISTS atama_durum ON atamalar (durum);

CREATE TABLE IF NOT EXISTS gorseller (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  veri TEXT NOT NULL                     -- PDF'ten kırpılan soru görseli (data:image/...)
);
