// =========================================
// PDF SAYFALARINI SORULARA BÖLME
// Sayfadaki "1.", "2." gibi soru numaralarını bulur, her sorunun kapladığı dikdörtgeni verir.
// İki sütunlu sayfaları da tanır. Girdi (piksel, y aşağı doğru artar):
//   sayfalar: [{ g: genişlik, y: yükseklik, ogeler: [{ s: yazı, x: sol, y: taban çizgisi, h: yazı yüksekliği }] }]
// Çıktı: [{ sayfa, no, x, y, g, h }]  (kırpılacak dikdörtgenler, soru sırasıyla)
// =========================================
function soruKutulari(sayfalar) {
  const bulunan = [];
  let beklenen = 1;

  sayfalar.forEach((sf, si) => {
    const satirBasi = (o) => !sf.ogeler.some((d) => d !== o && Math.abs(d.y - o.y) < o.h * 0.6 && d.x < o.x - 4 && d.x > o.x - 260);
    for (;;) { // bu sayfada, sıradaki numaradan başlayarak ardışık sorular aranır
      const aday = sf.ogeler.filter((o) => {
        const m = /^\s*(\d{1,2})\s*[.)](?!\d)/.exec(o.s);
        return m && Number(m[1]) === beklenen && satirBasi(o);
      }).sort((a, b) => a.x - b.x || a.y - b.y)[0];
      if (!aday) break;
      bulunan.push({ sayfa: si, no: beklenen, x: aday.x, ust: aday.y - aday.h * 1.15 });
      beklenen++;
    }
  });

  const kutular = [];
  sayfalar.forEach((sf, si) => {
    const buSayfa = bulunan.filter((b) => b.sayfa === si);
    if (!buSayfa.length) return;
    // sütunlar: x konumları birbirine yakın olan sorular aynı sütundadır
    const xler = [...new Set(buSayfa.map((b) => Math.round(b.x)))].sort((a, b) => a - b);
    const sutunlar = [];
    xler.forEach((x) => {
      const son = sutunlar[sutunlar.length - 1];
      if (son && x - son.sol < sf.g * 0.15) return;
      sutunlar.push({ sol: x });
    });
    sutunlar.forEach((s, i) => { s.sag = i + 1 < sutunlar.length ? sutunlar[i + 1].sol - 10 : sf.g - 8; });

    buSayfa.forEach((b) => {
      const s = sutunlar.filter((c) => b.x >= c.sol - sf.g * 0.1).pop() || sutunlar[0];
      const ayniSutun = buSayfa.filter((d) => d.x >= s.sol - sf.g * 0.1 && d.x < s.sag).sort((p, q) => p.ust - q.ust);
      const sira = ayniSutun.indexOf(b);
      let alt, sonSoru = false;
      if (sira + 1 < ayniSutun.length) alt = ayniSutun[sira + 1].ust - 4;
      else { // sütunun son sorusu: altında şekil olabilir, sayfanın %94'üne kadar al (altbilgi hariç).
        alt = sf.y * 0.94; // Alttaki boş beyaz alan, görsel çizilince odev-gonder.js'te kırpılır (kirp: true)
        sonSoru = true;
      }
      const sol = Math.max(0, s.sol - 8);
      kutular.push({ sayfa: si, no: b.no, x: sol, y: Math.max(0, b.ust), g: Math.min(sf.g, s.sag) - sol, h: Math.min(sf.y, alt) - Math.max(0, b.ust), kirp: sonSoru });
    });
  });
  return kutular.sort((a, b) => a.no - b.no);
}
if (typeof module !== 'undefined') module.exports = { soruKutulari };
