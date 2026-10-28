// =========================================
// OTURUM: giriş, çıkış, aktif süre ve sayfa koruması
// =========================================
const GIRIS_ADRESI = "https://mathsy-sunucu.mathsy.workers.dev"; // giriş sunucusunun (Cloudflare Worker) adresi, örn. https://mathsy-giris.mathsy.workers.dev

(() => {
  const kok = document.body.dataset.kok || '';
  const ANAHTAR = 'mathsy-oturum';
  const oku = () => { try { return JSON.parse(localStorage.getItem(ANAHTAR)); } catch (e) { return null; } };
  const yaz = (v) => { try { if (v) localStorage.setItem(ANAHTAR, JSON.stringify(v)); else localStorage.removeItem(ANAHTAR); } catch (e) { /* sorun değil */ } };

  function sure(sn) {
    const dk = Math.floor((sn || 0) / 60);
    return dk < 60 ? `${dk} dk` : `${Math.floor(dk / 60)} sa ${dk % 60} dk`;
  }

  async function api(yol, govde) {
    if (!GIRIS_ADRESI) throw new Error('Giriş sistemi henüz kurulmadı.');
    const o = oku();
    const yanit = await fetch(GIRIS_ADRESI + yol, {
      method: govde === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(o ? { Authorization: 'Bearer ' + o.jeton } : {}) },
      body: govde === undefined ? undefined : JSON.stringify(govde),
    });
    const veri = await yanit.json().catch(() => ({}));
    if (yanit.status === 401 && o) { yaz(null); hesapCiz(); }
    if (!yanit.ok) throw Object.assign(new Error(veri.hata || 'Bir hata oluştu'), { durum: yanit.status });
    return veri;
  }

  // Üst menünün sağındaki hesap kutusu
  const ust = document.querySelector('.ust-menu');
  const hesap = document.createElement('div');
  hesap.className = 'hesap';
  if (ust) ust.append(hesap);

  // Sol menüde "Ödevlerim" (öğrenci) ya da "Öğretmen Paneli" (öğretmen) sadece giriş yapınca görünür
  function girisliMenu() {
    const liste = document.getElementById('yan-liste');
    if (!liste) return;
    liste.querySelectorAll('.giris-linki').forEach((a) => a.remove());
    const o = oku();
    if (!o) return;
    const hoca = o.rol === 'ogretmen';
    const hedef = hoca ? 'sayfalar/ogretmen.html' : 'sayfalar/odevlerim.html';
    const a = document.createElement('a');
    a.className = 'tek-baslik giris-linki';
    a.href = kok + hedef;
    a.textContent = hoca ? 'Öğretmen Paneli' : 'Ödevlerim';
    if (location.pathname.endsWith(hedef.split('/').pop())) a.classList.add('aktif');
    liste.prepend(a);
  }

  function hesapCiz() {
    const o = oku();
    hesap.replaceChildren();
    girisliMenu();
    if (!o) {
      const a = document.createElement('a');
      a.href = kok + 'giris.html';
      a.className = 'hesap-dugme';
      a.textContent = 'Giriş yap';
      hesap.append(a);
      return;
    }
    const ad = document.createElement('span');
    ad.className = 'hesap-ad';
    ad.textContent = o.goruntu;
    ad.title = 'Toplam aktif süre';
    const s = document.createElement('span');
    s.className = 'hesap-sure';
    s.textContent = sure(o.toplam);
    const cik = document.createElement('button');
    cik.type = 'button';
    cik.className = 'hesap-dugme';
    cik.textContent = 'Çıkış';
    cik.addEventListener('click', async () => {
      try { await api('/cikis', {}); } catch (e) { /* çıkış yine de yapılır */ }
      yaz(null);
      location.href = kok + 'index.html';
    });
    hesap.append(ad, s, cik);
  }
  hesapCiz();

  // Giriş gerektiren sayfaların koruması
  async function dogrula() {
    const o = oku();
    const gerek = document.body.hasAttribute('data-giris-gerekli');
    if (!o) {
      if (gerek) location.href = kok + 'giris.html?git=' + encodeURIComponent((kok ? 'sayfalar/' : '') + location.pathname.split('/').pop());
      return;
    }
    try {
      const b = await api('/ben');
      yaz({ ...o, goruntu: b.goruntu, rol: b.rol, toplam: b.toplam });
      hesapCiz();
      const rol = document.body.dataset.rol;
      if (rol && b.rol !== rol) { location.href = kok + 'index.html'; return; }
    } catch (e) {
      if (e.durum === 401 && gerek) location.href = kok + 'giris.html';
    }
  }
  dogrula();

  // Aktif süre: sayfa açık ve kullanıcı son 2 dakikada bir şey yaptıysa 30 sn'de bir sayılır
  let sonEtkilesim = Date.now();
  ['pointerdown', 'keydown', 'scroll', 'mousemove', 'touchstart'].forEach((ad) => addEventListener(ad, () => { sonEtkilesim = Date.now(); }, { passive: true }));
  setInterval(async () => {
    const o = oku();
    if (!o || document.hidden || Date.now() - sonEtkilesim > 120000) return;
    try {
      const v = await api('/nabiz', {});
      yaz({ ...o, toplam: v.toplam });
      hesapCiz();
    } catch (e) { /* bağlantı yoksa sonra sayılır */ }
  }, 30000);

  // Giriş formu (giris.html)
  const form = document.getElementById('giris-formu');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const hata = document.getElementById('gi-hata');
      hata.textContent = '';
      try {
        const v = await api('/giris', { ad: document.getElementById('gi-ad').value, sifre: document.getElementById('gi-sifre').value });
        yaz({ jeton: v.jeton, ad: v.ad, goruntu: v.goruntu, rol: v.rol, toplam: v.toplam });
        const git = new URLSearchParams(location.search).get('git');
        const guvenli = git && /^[a-z0-9\/._-]+\.html$/i.test(git) && !git.startsWith('/') && !git.includes('..');
        location.href = kok + (guvenli ? git : (v.rol === 'ogretmen' ? 'sayfalar/ogretmen.html' : 'sayfalar/odevlerim.html'));
      } catch (er) { hata.textContent = er.message; }
    });
  }

  window.Mathsy = { api, oku, yaz, sure };
})();
