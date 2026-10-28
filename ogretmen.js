// =========================================
// ÖĞRETMEN: Öğrenci Listesi, Öğrenci Ekle ve panel sayfaları
// (Ödev Kontrol için odev-kontrol.js'e bak)
// =========================================
(() => {
  const { api, sure } = window.Mathsy;
  const liste = document.getElementById('og-liste');
  const form = document.getElementById('ogrenci-formu');
  const mesaj = document.getElementById('og-mesaj');
  const rozet = document.getElementById('kontrol-rozet');

  function sonGorulme(sn) {
    if (!sn) return 'hiç girmedi';
    const dk = Math.floor((Date.now() / 1000 - sn) / 60);
    if (dk < 1) return 'şimdi';
    if (dk < 60) return `${dk} dk önce`;
    return dk < 1440 ? `${Math.floor(dk / 60)} sa önce` : `${Math.floor(dk / 1440)} gün önce`;
  }
  const hucre = (metin) => Object.assign(document.createElement('td'), { textContent: metin });

  function durumHucresi(o) {
    const td = document.createElement('td');
    if (o.son_nabiz && Date.now() / 1000 - o.son_nabiz < 120) {
      td.append(Object.assign(document.createElement('span'), { className: 'chip chip-tamam', textContent: '● Çevrimiçi' }));
    } else td.textContent = sonGorulme(o.son_nabiz);
    return td;
  }

  async function yukle() {
    try {
      const { ogrenciler } = await api('/ogrenciler');
      liste.replaceChildren();
      if (!ogrenciler.length) liste.innerHTML = '<tr><td colspan="6" class="soluk">Henüz öğrenci eklenmedi.</td></tr>';
      ogrenciler.forEach((o) => {
        const sil = Object.assign(document.createElement('button'), { type: 'button', className: 'tablo-sil', textContent: 'Sil' });
        sil.addEventListener('click', async () => {
          if (!confirm(`${o.goruntu} hesabı ve ödevleri silinsin mi?`)) return;
          try { await api('/ogrenci-sil', { ad: o.ad }); yukle(); } catch (e) { alert(e.message); }
        });
        const son = document.createElement('td');
        son.append(sil);
        const tr = document.createElement('tr');
        tr.append(hucre(o.goruntu), hucre(o.sinif ? `${o.sinif}. sınıf` : '–'), hucre(o.ad), hucre(sure(o.toplam)), durumHucresi(o), son);
        liste.append(tr);
      });
    } catch (e) {
      liste.replaceChildren();
      const td = Object.assign(document.createElement('td'), { colSpan: 6, className: 'soluk', textContent: e.message });
      const tr = document.createElement('tr');
      tr.append(td);
      liste.append(tr);
    }
  }
  if (liste) yukle();

  // Panel: kontrol bekleyen ödev sayısı
  if (rozet) {
    api('/teslimler').then(({ teslimler }) => {
      const n = teslimler.filter((t) => t.durum === 'kontrol').length;
      if (n) { rozet.textContent = `${n} ödev bekliyor`; rozet.hidden = false; }
    }).catch(() => { /* rozet olmasa da olur */ });
  }

  if (form) {
    document.getElementById('og-uret').addEventListener('click', () => {
      const harf = 'abcdefghjkmnpqrstuvwxyz23456789'; // karışan harfler (l, 1, o, 0) yok
      document.getElementById('og-sifre').value = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => harf[b % harf.length]).join('');
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ad = document.getElementById('og-ad').value.trim().toLowerCase();
      const sifre = document.getElementById('og-sifre').value;
      mesaj.textContent = '';
      try {
        await api('/ogrenci', { ad, goruntu: document.getElementById('og-goruntu').value, sinif: document.getElementById('og-sinif').value, sifre });
        mesaj.textContent = sifre ? `Kaydedildi. Kullanıcı adı: ${ad}  ·  Şifre: ${sifre}  (şifreyi şimdi not al, sonra görünmez)` : 'Kaydedildi.';
        form.reset();
      } catch (er) { mesaj.textContent = er.message; }
    });
  }
})();
