// =========================================
// MATHSY SUNUCUSU (Cloudflare Worker + D1 veritabanı)
// Giriş, öğrenciler, ödev gönderme, teslim, kontrol ve yapay zekâ geri bildirimi.
// Kurulum: sunucu/KURULUM.txt
//
// Cloudflare panelinde ayarlanacaklar (koda YAZMA):
//   Bağlantı (Bindings): DB (D1 veritabanı), AI (Workers AI)
//   Secret: OGRETMEN_AD, OGRETMEN_SIFRE
//   İsteğe bağlı değişken: IZINLI_ADRESLER, AI_MODEL
// =========================================

const OTURUM_SURESI = 30 * 24 * 3600;   // giriş 30 gün açık kalır (saniye)
const PBKDF2_TUR = 30000;               // şifre karıştırma turu (1102 hatası alırsan düşür)
const MAX_ISTEK = 25 * 1024 * 1024;     // en büyük istek (PDF görselleri için)
const MAX_GORSEL = 1_500_000;           // tek soru görseli en çok ~1,5 MB (metin olarak)
const VARSAYILAN_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const enc = new TextEncoder();
const simdi = () => Math.floor(Date.now() / 1000);

class Hata extends Error {
  constructor(durum, mesaj) { super(mesaj); this.durum = durum; }
}

// ---------- yardımcılar ----------
function corsBasliklari(request, env) {
  const izinli = String(env.IZINLI_ADRESLER || '*').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = request.headers.get('Origin') || '';
  const ac = izinli.includes('*') ? '*' : (izinli.includes(origin) ? origin : izinli[0]);
  return {
    'Access-Control-Allow-Origin': ac,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

const json = (veri, durum, cors) => new Response(JSON.stringify(veri), {
  status: durum, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors },
});

async function govde(request) {
  if (Number(request.headers.get('Content-Length') || 0) > MAX_ISTEK) throw new Hata(413, 'İstek çok büyük. PDF’yi daha az soruyla gönder.');
  try { return await request.json(); } catch (e) { throw new Hata(400, 'Geçersiz istek.'); }
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const rastgeleHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
function esit(a, b) {
  if (a.length !== b.length) return false;
  let f = 0;
  for (let i = 0; i < a.length; i++) f |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return f === 0;
}
async function pbkdf2(sifre, tuz, tur) {
  const anahtar = await crypto.subtle.importKey('raw', enc.encode(sifre), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(tuz), iterations: tur }, anahtar, 256));
}
async function sifreHashle(sifre) {
  const tuz = rastgeleHex(16);
  return { tuz, hash: `${PBKDF2_TUR}$${await pbkdf2(sifre, tuz, PBKDF2_TUR)}` };
}
async function sifreDogruMu(sifre, tuz, kayit) {
  const [tur, h] = String(kayit).split('$');
  return esit(await pbkdf2(sifre, tuz, Number(tur) || PBKDF2_TUR), h || '');
}

const ogretmenAdi = (env) => String(env.OGRETMEN_AD || '').trim().toLowerCase();

// ---------- oturum ----------
async function kimlik(request, env) {
  const m = /^Bearer\s+([a-f0-9]{64})$/.exec(request.headers.get('Authorization') || '');
  if (!m) return null;
  return env.DB.prepare(
    'SELECT k.* FROM oturumlar o JOIN kullanicilar k ON k.ad = o.ad WHERE o.jeton_hash = ? AND o.olusturma > ?'
  ).bind(await sha256(m[1]), simdi() - OTURUM_SURESI).first();
}
const ogretmenGerek = (k) => { if (k.rol !== 'ogretmen') throw new Hata(403, 'Bu işlem sadece öğretmen içindir.'); };
const ogrenciGerek = (k) => { if (k.rol !== 'ogrenci') throw new Hata(403, 'Bu işlem sadece öğrenci içindir.'); };

async function giris(env, g) {
  const ad = String(g.ad || '').trim().toLowerCase();
  const sifre = String(g.sifre || '');
  if (!ad || !sifre) throw new Hata(400, 'Kullanıcı adı ve şifre gerekli.');
  let k = await env.DB.prepare('SELECT * FROM kullanicilar WHERE ad = ?').bind(ad).first();
  let dogru = false;

  if (ogretmenAdi(env) && ad === ogretmenAdi(env)) {
    const gizli = String(env.OGRETMEN_SIFRE || '');
    dogru = gizli.length >= 8 && esit(await sha256(sifre), await sha256(gizli));
    if (dogru && !k) {
      await env.DB.prepare("INSERT INTO kullanicilar (ad, goruntu, rol, sifre_hash, tuz) VALUES (?, ?, 'ogretmen', '-', '-')")
        .bind(ad, String(env.OGRETMEN_GORUNTU || 'Öğretmen')).run();
      k = await env.DB.prepare('SELECT * FROM kullanicilar WHERE ad = ?').bind(ad).first();
    }
  } else if (k && k.rol === 'ogrenci') {
    dogru = await sifreDogruMu(sifre, k.tuz, k.sifre_hash);
  } else {
    await pbkdf2(sifre, 'bos', PBKDF2_TUR); // var olmayan hesapta da aynı süre geçsin
  }
  if (!dogru) throw new Hata(401, 'Kullanıcı adı ya da şifre yanlış.');

  const jeton = rastgeleHex(32);
  const t = simdi();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM oturumlar WHERE olusturma < ?').bind(t - OTURUM_SURESI),
    env.DB.prepare('INSERT INTO oturumlar (jeton_hash, ad, olusturma) VALUES (?, ?, ?)').bind(await sha256(jeton), ad, t),
    env.DB.prepare('UPDATE kullanicilar SET son_nabiz = ? WHERE ad = ?').bind(t, ad),
  ]);
  return { jeton, ad, goruntu: k.goruntu, rol: k.rol, toplam: k.toplam || 0 };
}

async function nabiz(env, k) {
  const t = simdi();
  const ek = k.son_nabiz ? Math.min(30, t - k.son_nabiz) : 0;
  if (ek < 10) return { toplam: k.toplam || 0 };
  const toplam = (k.toplam || 0) + ek;
  await env.DB.prepare('UPDATE kullanicilar SET toplam = ?, son_nabiz = ? WHERE ad = ?').bind(toplam, t, k.ad).run();
  return { toplam };
}

// ---------- öğrenciler ----------
async function ogrenciler(env) {
  const { results } = await env.DB.prepare(
    "SELECT ad, goruntu, sinif, toplam, son_nabiz FROM kullanicilar WHERE rol = 'ogrenci' ORDER BY goruntu COLLATE NOCASE"
  ).all();
  return { ogrenciler: results };
}

async function ogrenciKaydet(env, g) {
  const ad = String(g.ad || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(ad)) throw new Hata(400, 'Kullanıcı adı 3-30 karakter olmalı (küçük harf, rakam, nokta, tire, alt çizgi).');
  if (ad === ogretmenAdi(env)) throw new Hata(400, 'Bu kullanıcı adı kullanılamaz.');
  const goruntu = String(g.goruntu || '').trim().slice(0, 40);
  if (!goruntu) throw new Hata(400, 'Öğrencinin adını yaz.');
  const sinif = String(g.sinif || '').trim();
  if (!/^\d{1,2}$/.test(sinif)) throw new Hata(400, 'Sınıf seç.');
  const sifre = String(g.sifre || '');
  const mevcut = await env.DB.prepare('SELECT rol FROM kullanicilar WHERE ad = ?').bind(ad).first();

  if (mevcut) {
    if (mevcut.rol !== 'ogrenci') throw new Hata(400, 'Bu kullanıcı adı kullanılamaz.');
    await env.DB.prepare('UPDATE kullanicilar SET goruntu = ?, sinif = ? WHERE ad = ?').bind(goruntu, sinif, ad).run();
    if (sifre) {
      if (sifre.length < 6) throw new Hata(400, 'Şifre en az 6 karakter olmalı.');
      const s = await sifreHashle(sifre);
      await env.DB.prepare('UPDATE kullanicilar SET sifre_hash = ?, tuz = ? WHERE ad = ?').bind(s.hash, s.tuz, ad).run();
      await env.DB.prepare('DELETE FROM oturumlar WHERE ad = ?').bind(ad).run(); // şifre değişince eski girişler kapanır
    }
  } else {
    if (sifre.length < 6) throw new Hata(400, 'Yeni öğrenci için en az 6 karakterlik şifre gerekli.');
    const s = await sifreHashle(sifre);
    await env.DB.prepare("INSERT INTO kullanicilar (ad, goruntu, rol, sinif, sifre_hash, tuz) VALUES (?, ?, 'ogrenci', ?, ?, ?)")
      .bind(ad, goruntu, sinif, s.hash, s.tuz).run();
  }
  return { tamam: true };
}

async function ogrenciSil(env, g) {
  const ad = String(g.ad || '').trim().toLowerCase();
  const k = await env.DB.prepare("SELECT ad FROM kullanicilar WHERE ad = ? AND rol = 'ogrenci'").bind(ad).first();
  if (!k) throw new Hata(404, 'Öğrenci bulunamadı.');
  await env.DB.batch([
    env.DB.prepare('DELETE FROM atamalar WHERE ogrenci = ?').bind(ad),
    env.DB.prepare('DELETE FROM oturumlar WHERE ad = ?').bind(ad),
    env.DB.prepare("DELETE FROM kullanicilar WHERE ad = ? AND rol = 'ogrenci'").bind(ad),
  ]);
  return { tamam: true };
}

// ---------- ödev gönderme ----------
const metin = (v, en) => String(v ?? '').trim().slice(0, en);

async function odevGonder(env, g) {
  const baslik = metin(g.baslik, 80);
  if (!baslik) throw new Hata(400, 'Ödev başlığı yaz.');
  if (!Array.isArray(g.sorular) || !g.sorular.length) throw new Hata(400, 'En az bir soru ekle.');
  if (g.sorular.length > 100) throw new Hata(400, 'Bir ödevde en fazla 100 soru olabilir.');
  const adlar = [...new Set((Array.isArray(g.ogrenciler) ? g.ogrenciler : []).map((a) => String(a).toLowerCase()))];
  if (!adlar.length) throw new Hata(400, 'En az bir öğrenci seç.');
  const yer = adlar.map(() => '?').join(',');
  const { results } = await env.DB.prepare(`SELECT ad FROM kullanicilar WHERE rol = 'ogrenci' AND ad IN (${yer})`).bind(...adlar).all();
  if (results.length !== adlar.length) throw new Hata(400, 'Seçilen öğrencilerden biri bulunamadı.');

  const sorular = [];
  for (const q of g.sorular) {
    const konu = metin(q.konu, 40);
    if (q.tur === 'gorsel') {
      const n = Number(q.n), cevap = Number(q.cevap);
      if (!/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(String(q.gorsel || '')) || q.gorsel.length > MAX_GORSEL) throw new Hata(400, 'Bir soru görseli geçersiz ya da çok büyük.');
      if (!Number.isInteger(n) || n < 2 || n > 5 || !Number.isInteger(cevap) || cevap < 0 || cevap >= n) throw new Hata(400, 'PDF sorularının hepsinde doğru şıkkı işaretle.');
      const r = await env.DB.prepare('INSERT INTO gorseller (veri) VALUES (?)').bind(q.gorsel).run();
      sorular.push({ tur: 'gorsel', gid: r.meta.last_row_id, n, cevap, konu });
      continue;
    }
    const soru = metin(q.soru, 500);
    if (!soru) throw new Hata(400, 'Boş bir soru metni var.');
    if (q.tur === 'sec') {
      const sec = (Array.isArray(q.secenekler) ? q.secenekler : []).map((s) => metin(s, 120)).filter(Boolean).slice(0, 6);
      const cevap = Number(q.cevap);
      if (sec.length < 2 || !Number.isInteger(cevap) || cevap < 0 || cevap >= sec.length) throw new Hata(400, 'Çoktan seçmeli sorularda seçenekleri ve doğru cevabı kontrol et.');
      sorular.push({ tur: 'sec', soru, secenekler: sec, cevap, konu });
    } else if (q.tur === 'dy') {
      if (typeof q.cevap !== 'boolean') throw new Hata(400, 'Doğru / Yanlış sorusunda cevabı işaretle.');
      sorular.push({ tur: 'dy', soru, cevap: q.cevap, konu });
    } else if (q.tur === 'bosluk' || q.tur === 'kisa') {
      const cevap = metin(q.cevap, 100);
      if (!cevap) throw new Hata(400, 'Bir sorunun doğru cevabı boş.');
      sorular.push({ tur: q.tur, soru, cevap, konu });
    } else throw new Hata(400, 'Bilinmeyen soru türü.');
  }

  const t = simdi();
  const o = await env.DB.prepare('INSERT INTO odevler (baslik, sorular, tarih) VALUES (?, ?, ?)').bind(baslik, JSON.stringify(sorular), t).run();
  await env.DB.batch(adlar.map((ad) => env.DB.prepare('INSERT INTO atamalar (odev_id, ogrenci) VALUES (?, ?)').bind(o.meta.last_row_id, ad)));
  return { atanan: adlar.length };
}

// ---------- öğrenci tarafı ----------
function aciksoru(q) { // öğrenciye doğru cevap GİTMEZ
  if (q.tur === 'gorsel') return { tur: q.tur, gid: q.gid, n: q.n };
  if (q.tur === 'sec') return { tur: q.tur, soru: q.soru, secenekler: q.secenekler };
  return { tur: q.tur, soru: q.soru };
}

async function odevlerim(env, k) {
  if (k.rol !== 'ogrenci') return { odevler: [] };
  const { results } = await env.DB.prepare(
    'SELECT a.id, a.durum, o.baslik, o.tarih, o.sorular FROM atamalar a JOIN odevler o ON o.id = a.odev_id WHERE a.ogrenci = ? ORDER BY a.id DESC'
  ).bind(k.ad).all();
  return { odevler: results.map((r) => ({ id: r.id, durum: r.durum, baslik: r.baslik, tarih: r.tarih, sorular: JSON.parse(r.sorular).map(aciksoru) })) };
}

async function gorsel(env, k, url) {
  const id = Number(url.searchParams.get('id'));
  if (!Number.isInteger(id) || id < 1) throw new Hata(400, 'Geçersiz görsel.');
  if (k.rol !== 'ogretmen') {
    const izin = await env.DB.prepare(
      'SELECT a.id FROM atamalar a JOIN odevler o ON o.id = a.odev_id WHERE a.ogrenci = ? AND o.sorular LIKE ? LIMIT 1'
    ).bind(k.ad, `%"gid":${id},%`).first();
    if (!izin) throw new Hata(403, 'Bu görsele erişimin yok.');
  }
  const r = await env.DB.prepare('SELECT veri FROM gorseller WHERE id = ?').bind(id).first();
  if (!r) throw new Hata(404, 'Görsel bulunamadı.');
  return { veri: r.veri };
}

// ---------- puanlama ve yorum ----------
const norm = (s) => String(s).toLocaleLowerCase('tr-TR').replace(/\s+/g, '').replace(/,/g, '.');
function dogruMu(q, v) {
  if (v === null || v === undefined) return false;
  if (q.tur === 'gorsel' || q.tur === 'sec' || q.tur === 'dy') return v === q.cevap;
  return String(q.cevap).split('|').some((a) => norm(a) === norm(v));
}
function analizEt(sorular, cevaplar) {
  const konular = {};
  let dogru = 0;
  sorular.forEach((q, i) => {
    const ok = dogruMu(q, cevaplar[i]);
    if (ok) dogru++;
    const ad = q.konu || 'Genel';
    const s = (konular[ad] ||= { dogru: 0, toplam: 0 });
    s.toplam++;
    if (ok) s.dogru++;
  });
  return { dogru, toplam: sorular.length, konular };
}

function kuralYorumu(goruntu, a) {
  const yuzde = a.toplam ? Math.round((100 * a.dogru) / a.toplam) : 0;
  let m = `${goruntu} ${a.toplam} sorudan ${a.dogru} tanesini doğru yaptı (%${yuzde}).`;
  const liste = Object.entries(a.konular).filter(([ad]) => ad !== 'Genel');
  const guclu = liste.filter(([, s]) => s.dogru / s.toplam >= 0.75).map(([ad]) => ad);
  const zayif = liste.filter(([, s]) => s.dogru / s.toplam < 0.6).map(([ad]) => ad);
  if (guclu.length) m += ` Güçlü konular: ${guclu.join(', ')}.`;
  if (zayif.length) m += ` Destek gereken konular: ${zayif.join(', ')}.`;
  return m;
}

async function yapayZekaYorumu(env, o) { // başarısız olursa null döner, kural yorumu kalır
  if (!env.AI) return null;
  const satirlar = Object.entries(o.analiz.konular).map(([ad, s]) => `- ${ad}: ${s.dogru}/${s.toplam} doğru`).join('\n');
  const mesajlar = [
    { role: 'system', content: 'Sen bir matematik özel ders öğretmeninin yardımcısısın. Öğretmene, öğrencinin ödev sonucunu Türkçe ve kısa (en fazla 3 cümle) özetlersin: hangi konuda güçlü, hangi konuda destek gerektiğini söyle ve bir sonraki derste neye odaklanılabileceğini öner. Sadece verilen sayılara dayan, olmayan bilgi uydurma. Başlık, madde işareti ya da emoji kullanma.' },
    { role: 'user', content: `Öğrenci: ${o.goruntu}${o.sinif ? ` (${o.sinif}. sınıf)` : ''}\nÖdev: ${o.baslik}\nToplam: ${o.analiz.dogru}/${o.analiz.toplam} doğru\nKonulara göre:\n${satirlar}` },
  ];
  try {
    const cevap = await Promise.race([
      env.AI.run(env.AI_MODEL || VARSAYILAN_MODEL, { messages: mesajlar, max_tokens: 250 }),
      new Promise((_, red) => setTimeout(() => red(new Error('zaman aşımı')), 20000)),
    ]);
    const m = String(cevap?.response || '').trim();
    return m ? m.slice(0, 700) : null;
  } catch (e) { console.error('Yapay zekâ yorumu alınamadı:', e); return null; }
}

async function teslim(env, ctx, k, g) {
  ogrenciGerek(k);
  const id = Number(g.atama);
  const s = await env.DB.prepare(
    'SELECT a.id, a.durum, o.baslik, o.sorular FROM atamalar a JOIN odevler o ON o.id = a.odev_id WHERE a.id = ? AND a.ogrenci = ?'
  ).bind(id, k.ad).first();
  if (!s) throw new Hata(404, 'Ödev bulunamadı.');
  if (s.durum !== 'bekliyor') throw new Hata(409, 'Bu ödev zaten gönderilmiş.');
  const sorular = JSON.parse(s.sorular);
  if (!Array.isArray(g.cevaplar) || g.cevaplar.length !== sorular.length) throw new Hata(400, 'Cevap listesi eksik.');
  const cevaplar = g.cevaplar.map((v) => {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'boolean' || typeof v === 'number') return v;
    return String(v).trim().slice(0, 100) || null;
  });
  const analiz = analizEt(sorular, cevaplar);
  const r = await env.DB.prepare(
    "UPDATE atamalar SET durum = 'kontrol', cevaplar = ?, teslim_tarih = ?, dogru = ?, toplam = ?, analiz = ?, geri_bildirim = ? WHERE id = ? AND durum = 'bekliyor'"
  ).bind(JSON.stringify(cevaplar), simdi(), analiz.dogru, analiz.toplam, JSON.stringify(analiz), kuralYorumu(k.goruntu, analiz), id).run();
  if (!r.meta.changes) throw new Hata(409, 'Bu ödev zaten gönderilmiş.');
  // öğrenci beklemesin: yapay zekâ yorumu arkada hazırlanır, hazır olunca kural yorumunun yerine geçer
  ctx.waitUntil((async () => {
    const yorum = await yapayZekaYorumu(env, { goruntu: k.goruntu, sinif: k.sinif, baslik: s.baslik, analiz });
    if (yorum) await env.DB.prepare('UPDATE atamalar SET geri_bildirim = ? WHERE id = ?').bind(yorum, id).run();
  })());
  return { tamam: true };
}

// ---------- öğretmen: ödev kontrol ----------
async function teslimler(env) {
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.durum, a.teslim_tarih, a.dogru, a.toplam, a.geri_bildirim, k.ad, k.goruntu, k.sinif, o.baslik
     FROM atamalar a JOIN odevler o ON o.id = a.odev_id JOIN kullanicilar k ON k.ad = a.ogrenci
     WHERE a.durum IN ('kontrol', 'tamam')
     ORDER BY (a.durum = 'kontrol') DESC, a.teslim_tarih DESC LIMIT 300`
  ).all();
  return { teslimler: results };
}

async function teslimSatiri(env, id) {
  const s = await env.DB.prepare(
    `SELECT a.*, o.baslik, o.sorular, k.goruntu, k.sinif
     FROM atamalar a JOIN odevler o ON o.id = a.odev_id JOIN kullanicilar k ON k.ad = a.ogrenci
     WHERE a.id = ? AND a.durum IN ('kontrol', 'tamam')`
  ).bind(id).first();
  if (!s) throw new Hata(404, 'Teslim bulunamadı.');
  return s;
}

async function teslimDetay(env, url) {
  const s = await teslimSatiri(env, Number(url.searchParams.get('id')));
  const sorular = JSON.parse(s.sorular);
  const cevaplar = JSON.parse(s.cevaplar || '[]');
  return {
    id: s.id, durum: s.durum, baslik: s.baslik, goruntu: s.goruntu, sinif: s.sinif, teslim_tarih: s.teslim_tarih,
    dogru: s.dogru, toplam: s.toplam, geri_bildirim: s.geri_bildirim, analiz: JSON.parse(s.analiz || '{}'),
    sorular: sorular.map((q, i) => ({ ...q, verilen: cevaplar[i] ?? null, dogruMu: dogruMu(q, cevaplar[i] ?? null) })),
  };
}

async function yorumYenile(env, g) {
  const s = await teslimSatiri(env, Number(g.id));
  const analiz = analizEt(JSON.parse(s.sorular), JSON.parse(s.cevaplar || '[]'));
  const yorum = (await yapayZekaYorumu(env, { goruntu: s.goruntu, sinif: s.sinif, baslik: s.baslik, analiz })) || kuralYorumu(s.goruntu, analiz);
  await env.DB.prepare('UPDATE atamalar SET geri_bildirim = ?, analiz = ? WHERE id = ?').bind(yorum, JSON.stringify(analiz), s.id).run();
  return { geri_bildirim: yorum };
}

async function onayla(env, g) {
  const r = await env.DB.prepare("UPDATE atamalar SET durum = 'tamam' WHERE id = ? AND durum = 'kontrol'").bind(Number(g.id)).run();
  if (!r.meta.changes) throw new Hata(409, 'Bu ödev onaylanamadı (zaten onaylanmış olabilir).');
  return { tamam: true };
}

// ---------- yönlendirme ----------
async function yonlendir(request, env, ctx) {
  const url = new URL(request.url);
  const yol = `${request.method} ${url.pathname}`;

  if (yol === 'POST /giris') return giris(env, await govde(request));

  const k = await kimlik(request, env);
  if (!k) throw new Hata(401, 'Giriş yapman gerekiyor.');

  switch (yol) {
    case 'GET /ben': return { ad: k.ad, goruntu: k.goruntu, rol: k.rol, sinif: k.sinif, toplam: k.toplam || 0 };
    case 'POST /nabiz': return nabiz(env, k);
    case 'POST /cikis':
      await env.DB.prepare('DELETE FROM oturumlar WHERE ad = ?').bind(k.ad).run();
      return { tamam: true };
    case 'GET /odevlerim': return odevlerim(env, k);
    case 'GET /gorsel': return gorsel(env, k, url);
    case 'POST /teslim': return teslim(env, ctx, k, await govde(request));
  }

  ogretmenGerek(k); // aşağıdakiler sadece öğretmen
  switch (yol) {
    case 'GET /ogrenciler': return ogrenciler(env);
    case 'POST /ogrenci': return ogrenciKaydet(env, await govde(request));
    case 'POST /ogrenci-sil': return ogrenciSil(env, await govde(request));
    case 'POST /odev': return odevGonder(env, await govde(request));
    case 'GET /teslimler': return teslimler(env);
    case 'GET /teslim-detay': return teslimDetay(env, url);
    case 'POST /yorum-yenile': return yorumYenile(env, await govde(request));
    case 'POST /onayla': return onayla(env, await govde(request));
  }
  throw new Hata(404, 'Böyle bir adres yok.');
}

export default {
  async fetch(request, env, ctx) {
    const cors = corsBasliklari(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      return json(await yonlendir(request, env, ctx), 200, cors);
    } catch (e) {
      if (e instanceof Hata) return json({ hata: e.message }, e.durum, cors);
      console.error(e);
      return json({ hata: 'Sunucuda bir sorun oluştu.' }, 500, cors);
    }
  },
};
