// =========================================
// ÖĞRETMEN PANELİ: öğrenci hesapları ve aktif süreleri
// =========================================
(() => {
  const { api, sure } = window.Mathsy;
  const liste = document.getElementById('og-liste');
  const mesaj = document.getElementById('og-mesaj');
  const form = document.getElementById('ogrenci-formu');

  function sonGorulme(sn) {
    if (!sn) return 'hiç girmedi';
    const dk = Math.floor((Date.now() / 1000 - sn) / 60);
    if (dk < 1) return 'şimdi';
    if (dk < 60) return `${dk} dk önce`;
    return dk < 1440 ? `${Math.floor(dk / 60)} sa önce` : `${Math.floor(dk / 1440)} gün önce`;
  }

  function hucre(metin) { const td = document.createElement('td'); td.textContent = metin; return td; }

  async function yukle() {
    try {
      const { ogrenciler } = await api('/ogrenciler');
      liste.replaceChildren();
      if (!ogrenciler.length) liste.append(Object.assign(document.createElement('tr'), { innerHTML: '<td colspan="5" class="soluk">Henüz öğrenci eklenmedi.</td>' }));
      ogrenciler.forEach((o) => {
        const tr = document.createElement('tr');
        const sil = document.createElement('button');
        sil.type = 'button';
        sil.className = 'tablo-sil';
        sil.textContent = 'Sil';
        sil.addEventListener('click', async () => {
          if (!confirm(`${o.goruntu} hesabı silinsin mi?`)) return;
          try { await api('/ogrenci-sil', { ad: o.ad }); yukle(); } catch (e) { mesaj.textContent = e.message; }
        });
        const son = document.createElement('td');
        son.append(sil);
        tr.append(hucre(o.goruntu), hucre(o.ad), hucre(sure(o.toplam)), hucre(sonGorulme(o.son_nabiz)), son);
        liste.append(tr);
      });
    } catch (e) { mesaj.textContent = e.message; }
  }

  document.getElementById('og-uret').addEventListener('click', () => {
    const harf = 'abcdefghjkmnpqrstuvwxyz23456789'; // karışan harfler (l, 1, o, 0) yok
    const baytlar = crypto.getRandomValues(new Uint8Array(8));
    document.getElementById('og-sifre').value = [...baytlar].map((b) => harf[b % harf.length]).join('');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ad = document.getElementById('og-ad').value.trim().toLowerCase();
    const sifre = document.getElementById('og-sifre').value;
    mesaj.textContent = '';
    try {
      await api('/ogrenci', { ad, goruntu: document.getElementById('og-goruntu').value, sifre });
      mesaj.textContent = sifre ? `Kaydedildi. Kullanıcı adı: ${ad}  ·  Şifre: ${sifre}  (şifreyi şimdi not al, sonra görünmez)` : 'Kaydedildi.';
      form.reset();
      yukle();
    } catch (er) { mesaj.textContent = er.message; }
  });

  yukle();
})();
