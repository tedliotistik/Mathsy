// =========================================
// ÖDEVLERİM (öğrenci / veli ekranı)
// Durumlar: Bekliyor, Kontrol aşamasında, ✓ Tamamlandı
// =========================================
(() => {
  const { api } = window.Mathsy;
  const kutu = document.getElementById('od-liste');
  const ROZET = { bekliyor: ['Bekliyor', 'rozet-bekliyor'], kontrol: ['Kontrol aşamasında', 'rozet-kontrol'], tamam: ['✓ Tamamlandı', 'rozet-tamam'] };

  (async () => {
    try {
      const { odevler } = await api('/odevlerim');
      kutu.replaceChildren();
      if (!odevler.length) {
        kutu.innerHTML = '<div class="form-kart"><p>Henüz sana gönderilmiş bir ödev yok.</p><p class="soluk">Ödevler gönderilince burada görünecek.</p></div>';
        return;
      }
      odevler.forEach((o) => {
        const [yazi, sinif] = ROZET[o.durum] || ROZET.bekliyor;
        const kart = document.createElement('article');
        kart.className = 'odev-karti';
        const bilgi = document.createElement('div');
        const baslik = Object.assign(document.createElement('h3'), { textContent: o.baslik });
        const alt = Object.assign(document.createElement('p'), { className: 'soluk', textContent: `${o.sorular.length} soru · ${new Date(o.tarih * 1000).toLocaleDateString('tr-TR')}` });
        bilgi.append(baslik, alt);
        const sag = document.createElement('div');
        sag.className = 'odev-sag';
        sag.append(Object.assign(document.createElement('span'), { className: 'rozet ' + sinif, textContent: yazi }));
        if (o.durum === 'bekliyor') sag.append(Object.assign(document.createElement('a'), { className: 'buton', href: 'odev.html?id=' + o.id, textContent: 'Ödeve başla' }));
        kart.append(bilgi, sag);
        kutu.append(kart);
      });
    } catch (e) { kutu.textContent = e.message; }
  })();
})();
