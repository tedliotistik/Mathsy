// =========================================
// GİRİŞ SUNUCUSU (Cloudflare Worker + D1 veritabanı)
// Hesapları sadece öğretmen oluşturur. Şifreler düz yazı olarak saklanmaz (tuzlu PBKDF2).
//
// Gerekli ayarlar (Worker > Settings):
//   Bindings   : D1 database  -> değişken adı: DB
//   Variables  : IZINLI_SITE      (Text)   siteni açan adresler, virgülle ayrılmış
//                KURULUM_SIFRESI  (Secret) öğretmen hesabını ilk kez oluşturmak için
// =========================================

const OTURUM_SN = 7 * 24 * 3600; // giriş 7 gün açık kalır
const PBKDF2_TUR = 10000;         // ücretsiz planın işlemci sınırına uygun değer
const AD_DESENI = /^[a-z0-9._-]{3,30}$/;
const enc = new TextEncoder();
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (s) => Uint8Array.from(s.match(/../g).map((x) => parseInt(x, 16)));
const rastgele = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
const simdi = () => Math.floor(Date.now() / 1000);

async function hashle(sifre, tuz) {
  const anahtar = await crypto.subtle.importKey('raw', enc.encode(sifre), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(tuz), iterations: PBKDF2_TUR }, anahtar, 256);
  return hex(bits);
}

function esit(a, b) { // sabit sürede karşılaştırma
  if (a.length !== b.length) return false;
  let fark = 0;
  for (let i = 0; i < a.length; i++) fark |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return fark === 0;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const yol = url.pathname;
    const izinliler = (env.IZINLI_SITE || '').split(',').map((s) => s.trim()).filter(Boolean);
    const origin = req.headers.get('Origin') || '';
    const izinli = izinliler.length === 0 || izinliler.includes(origin) || yol === '/kurulum';
    const cors = {
      'Access-Control-Allow-Origin': yol === '/kurulum' || izinliler.length === 0 ? '*' : (izinli ? origin : izinliler[0]),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Vary': 'Origin',
    };
    const yanit = (v, durum = 200) => new Response(JSON.stringify(v), { status: durum, headers: { ...cors, 'content-type': 'application/json' } });
    const sor = (sql, ...p) => env.DB.prepare(sql).bind(...p);

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (!izinli) return yanit({ hata: 'Bu adrese izin verilmedi' }, 403);

    async function hesapYaz(ad, goruntu, rol, sifre) {
      const tuz = rastgele(16);
      await sor(`INSERT INTO kullanici (ad, goruntu, rol, tuz, hash) VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(ad) DO UPDATE SET goruntu = excluded.goruntu, tuz = excluded.tuz, hash = excluded.hash`,
        ad, goruntu, rol, tuz, await hashle(sifre, tuz)).run();
    }

    try {
      const g = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
      const ad = String(g.ad || '').trim().toLowerCase();

      // --- Herkese açık: ilk kurulum ve giriş ---
      if (yol === '/kurulum' && req.method === 'POST') {
        if (!env.KURULUM_SIFRESI || !esit(String(g.kurulum || ''), env.KURULUM_SIFRESI)) return yanit({ hata: 'Kurulum şifresi hatalı' }, 403);
        if (await sor("SELECT ad FROM kullanici WHERE rol = 'ogretmen'").first()) return yanit({ hata: 'Öğretmen hesabı zaten var' }, 409);
        if (!AD_DESENI.test(ad) || String(g.sifre || '').length < 8) return yanit({ hata: 'Kullanıcı adı 3-30 karakter (küçük harf, rakam, . _ -), şifre en az 8 karakter olmalı' }, 400);
        await hesapYaz(ad, String(g.goruntu || 'Öğretmen').slice(0, 60), 'ogretmen', String(g.sifre));
        return yanit({ tamam: true });
      }

      if (yol === '/giris' && req.method === 'POST') {
        const d = await sor('SELECT sayi, bitis FROM deneme WHERE ad = ?', ad).first();
        const aktifDeneme = d && d.bitis > simdi() ? d.sayi : 0;
        if (aktifDeneme >= 5) return yanit({ hata: 'Çok fazla deneme yapıldı. 10 dakika sonra tekrar dene.' }, 429);
        const k = await sor('SELECT * FROM kullanici WHERE ad = ?', ad).first();
        if (!k || !esit(await hashle(String(g.sifre || ''), k.tuz), k.hash)) {
          await sor('INSERT OR REPLACE INTO deneme (ad, sayi, bitis) VALUES (?, ?, ?)', ad, aktifDeneme + 1, simdi() + 600).run();
          return yanit({ hata: 'Kullanıcı adı ya da şifre hatalı' }, 401);
        }
        await sor('DELETE FROM deneme WHERE ad = ?', ad).run();
        await sor('DELETE FROM oturum WHERE bitis < ?', simdi()).run();
        const jeton = rastgele(32);
        await sor('INSERT INTO oturum (jeton, kullanici, bitis) VALUES (?, ?, ?)', jeton, ad, simdi() + OTURUM_SN).run();
        await sor('UPDATE kullanici SET son_nabiz = ? WHERE ad = ?', simdi(), ad).run();
        return yanit({ jeton, ad, goruntu: k.goruntu, rol: k.rol, toplam: k.toplam });
      }

      // --- Giriş gerektirenler ---
      const jeton = (req.headers.get('Authorization') || '').replace('Bearer ', '');
      const ben = jeton ? await sor('SELECT k.* FROM oturum o JOIN kullanici k ON k.ad = o.kullanici WHERE o.jeton = ? AND o.bitis > ?', jeton, simdi()).first() : null;
      if (!ben) return yanit({ hata: 'Giriş gerekli' }, 401);

      if (yol === '/ben') return yanit({ ad: ben.ad, goruntu: ben.goruntu, rol: ben.rol, toplam: ben.toplam });

      if (yol === '/nabiz' && req.method === 'POST') { // istemci her 30 sn'de bir, sayfa açık ve kullanıcı etkinken çağırır
        const fark = ben.son_nabiz ? Math.min(Math.max(simdi() - ben.son_nabiz, 0), 45) : 0;
        await sor('UPDATE kullanici SET toplam = toplam + ?, son_nabiz = ? WHERE ad = ?', fark, simdi(), ben.ad).run();
        return yanit({ toplam: ben.toplam + fark });
      }

      if (yol === '/cikis' && req.method === 'POST') {
        await sor('DELETE FROM oturum WHERE jeton = ?', jeton).run();
        return yanit({ tamam: true });
      }

      // --- Sadece öğretmen ---
      if (ben.rol !== 'ogretmen') return yanit({ hata: 'Yetkin yok' }, 403);

      if (yol === '/ogrenciler') {
        const { results } = await sor("SELECT ad, goruntu, toplam, son_nabiz FROM kullanici WHERE rol = 'ogrenci' ORDER BY goruntu").all();
        return yanit({ ogrenciler: results });
      }

      if (yol === '/ogrenci' && req.method === 'POST') {
        const goruntu = String(g.goruntu || '').trim().slice(0, 60);
        const sifre = String(g.sifre || '');
        const var_ = await sor('SELECT rol FROM kullanici WHERE ad = ?', ad).first();
        if (!AD_DESENI.test(ad) || !goruntu) return yanit({ hata: 'Kullanıcı adı 3-30 karakter (küçük harf, rakam, . _ -) ve görünen ad gerekli' }, 400);
        if (var_ && var_.rol !== 'ogrenci') return yanit({ hata: 'Bu kullanıcı adı kullanılamaz' }, 400);
        if (!var_ && sifre.length < 6) return yanit({ hata: 'Yeni öğrenci için en az 6 karakterli şifre gerekli' }, 400);
        if (sifre) {
          if (sifre.length < 6 || sifre.length > 60) return yanit({ hata: 'Şifre 6-60 karakter olmalı' }, 400);
          await hesapYaz(ad, goruntu, 'ogrenci', sifre);
          await sor('DELETE FROM oturum WHERE kullanici = ?', ad).run(); // şifre değişince eski girişler kapanır
        } else {
          await sor('UPDATE kullanici SET goruntu = ? WHERE ad = ?', goruntu, ad).run();
        }
        return yanit({ tamam: true });
      }

      if (yol === '/ogrenci-sil' && req.method === 'POST') {
        await sor('DELETE FROM oturum WHERE kullanici = ?', ad).run();
        await sor("DELETE FROM kullanici WHERE ad = ? AND rol = 'ogrenci'", ad).run();
        return yanit({ tamam: true });
      }

      return yanit({ hata: 'Bulunamadı' }, 404);
    } catch (hata) {
      return yanit({ hata: 'Sunucu hatası' }, 500);
    }
  },
};
