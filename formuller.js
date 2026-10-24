// =========================================
// FORMÜL ARAMA
// 1) Önce sitedeki kayıtlı formüllerde arar (hemen çıkar).
// 2) AI_ADRESI doldurulmuşsa yapay zekâdan da cevap ister.
// =========================================

// Yapay zekâ sunucunun adresi (sunucu/yapay-zeka-sunucusu.js'i yayınlayınca buraya yaz).
// Boş bırakırsan sadece kayıtlı formüller aranır.
const AI_ADRESI = "";

// Kayıtlı formüller: LaTeX yazımı. Yeni formül eklemek için aynı biçimde satır ekle.
const FORMULLER = [
  { ad: "Dairenin alanı ve çevresi", anahtar: "daire alan cevre yaricap pi", formul: "A = \\pi r^2 \\qquad Ç = 2\\pi r", aciklama: "r: yarıçap" },
  { ad: "Pisagor teoremi", anahtar: "pisagor dik ucgen hipotenus kenar", formul: "a^2 + b^2 = c^2", aciklama: "a ve b dik kenarlar, c hipotenüs" },
  { ad: "İkinci dereceden denklemin kökleri", anahtar: "ikinci derece denklem diskriminant delta kok", formul: "x_{1,2} = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}", aciklama: "ax² + bx + c = 0 için; Δ = b² − 4ac" },
  { ad: "Üçgenin alanı", anahtar: "ucgen alan taban yukseklik", formul: "A = \\dfrac{a \\cdot h}{2}", aciklama: "a: taban, h: o tabana ait yükseklik" },
  { ad: "Dikdörtgen ve karenin alanı", anahtar: "dikdortgen kare alan cevre", formul: "A_{dikdörtgen} = a \\cdot b \\qquad A_{kare} = a^2", aciklama: "a, b: kenar uzunlukları" },
  { ad: "Önemli özdeşlikler", anahtar: "ozdeslik kare toplam fark iki kare", formul: "(a+b)^2 = a^2 + 2ab + b^2 \\\\ (a-b)^2 = a^2 - 2ab + b^2 \\\\ a^2 - b^2 = (a-b)(a+b)", aciklama: "" },
  { ad: "Silindirin hacmi", anahtar: "silindir hacim yaricap yukseklik", formul: "V = \\pi r^2 h", aciklama: "r: taban yarıçapı, h: yükseklik" },
  { ad: "Kürenin hacmi", anahtar: "kure hacim yaricap", formul: "V = \\dfrac{4}{3}\\pi r^3", aciklama: "r: yarıçap" },
  { ad: "Aritmetik dizinin genel terimi", anahtar: "aritmetik dizi genel terim fark toplam", formul: "a_n = a_1 + (n-1)d \\qquad S_n = \\dfrac{n(a_1 + a_n)}{2}", aciklama: "d: ortak fark" },
  { ad: "Geometrik dizinin genel terimi", anahtar: "geometrik dizi genel terim oran toplam", formul: "a_n = a_1 \\cdot r^{n-1}", aciklama: "r: ortak çarpan" },
];

// Sayfadaki konu özetleri (id, formuller.html'deki <details id="..."> ile aynı olmalı)
const KONULAR = [
  { id: 'bolunebilme', ad: 'Bölünebilme Kuralları', anahtar: 'bolunebilme bolunme kural 2 3 4 5 6 7 8 9 10 11' },
  { id: 'carpan-bolen', ad: 'Doğal Sayı Çarpan ve Bölen', anahtar: 'carpan bolen asal olmayan carpanlari bulma' },
  { id: 'asal-sayilar', ad: 'Asal Sayılar Hakkında Önemli Bilgiler', anahtar: 'asal sayi en kucuk buyuk 97' },
  { id: 'asal-carpanlar', ad: 'Asal Çarpanlara Ayırma Yöntemi', anahtar: 'asal carpanlara ayirma uslu cizgi' },
];

// Aramada yok sayılan, çok yaygın sözcükler
const GEREKSIZ = ['ile', 'icin', 'nedir', 'nasil', 'kural', 'kurali', 'formul', 'formulu'];

const form = document.getElementById('arama-formu');
const girdi = document.getElementById('arama-girdi');
const sonuc = document.getElementById('sonuc');
let sonIstek = 0; // eski cevapların yenisinin üstüne yazmasını engeller

// Türkçe karakterleri sadeleştir: "Dairenin ALANI" -> "dairenin alani"
function sade(metin) {
  return metin.toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
}

function yerelAra(soru) {
  const kelimeler = sade(soru).split(/\s+/).filter((k) => k.length >= 3 && !GEREKSIZ.includes(k));
  return [...FORMULLER, ...KONULAR]
    .map((f) => {
      const havuz = sade(f.ad + ' ' + f.anahtar);
      return { f, puan: kelimeler.filter((k) => havuz.includes(k.slice(0, 5))).length };
    })
    .filter((x) => x.puan > 0)
    .sort((a, b) => b.puan - a.puan)
    .slice(0, 3)
    .map((x) => x.f);
}

function kart(baslik, ...ogeler) {
  const k = document.createElement('article');
  k.className = 'formul-karti';
  const h = document.createElement('h3');
  h.textContent = baslik;
  k.append(h, ...ogeler);
  return k;
}

function yazi(metin, sinif) {
  const p = document.createElement('p');
  p.textContent = metin;
  if (sinif) p.className = sinif;
  return p;
}

function konuKarti(k) {
  const dugme = document.createElement('button');
  dugme.type = 'button';
  dugme.className = 'buton';
  dugme.textContent = 'Konuya git';
  dugme.addEventListener('click', () => {
    const konu = document.getElementById(k.id);
    konu.open = true;
    konu.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  return kart(k.ad, yazi('Konu özeti', 'soluk'), dugme);
}

function matematikCiz() {
  if (window.renderMathInElement) {
    renderMathInElement(sonuc, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
        { left: '$', right: '$', display: false },
      ],
      throwOnError: false,
    });
  }
}

async function yapayZekayaSor(soru) {
  const kontrol = new AbortController();
  const zamanAsimi = setTimeout(() => kontrol.abort(), 25000);
  try {
    const cevap = await fetch(AI_ADRESI, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ soru }),
      signal: kontrol.signal,
    });
    if (!cevap.ok) throw new Error('Sunucu hatası');
    const veri = await cevap.json();
    return veri.cevap;
  } finally {
    clearTimeout(zamanAsimi);
  }
}

async function ara(soru) {
  const istek = ++sonIstek;
  const yerel = yerelAra(soru);
  sonuc.replaceChildren();

  let aiKarti = null;
  if (AI_ADRESI) {
    aiKarti = kart('Yapay zekâ yanıtı', yazi('Formül hazırlanıyor…', 'soluk'));
    sonuc.append(aiKarti);
  }

  if (yerel.length) {
    const kayitli = document.createElement('div');
    yerel.forEach((f) => {
      if (f.id) { kayitli.append(konuKarti(f)); return; } // konu özeti
      kayitli.append(kart(f.ad, yazi('$$' + f.formul + '$$', 'formul'), yazi(f.aciklama, 'soluk')));
    });
    sonuc.append(kayitli);
  } else if (!AI_ADRESI) {
    sonuc.append(yazi('Bu aramayla eşleşen kayıtlı formül bulunamadı. Başka sözcüklerle dene.', 'soluk'));
  }
  matematikCiz();

  if (!AI_ADRESI) return;
  try {
    const metin = await yapayZekayaSor(soru);
    if (istek !== sonIstek) return; // bu arada yeni arama yapıldı
    const p = yazi(metin, 'ai-yanit');
    aiKarti.replaceChildren(aiKarti.firstChild, p);
  } catch (hata) {
    if (istek !== sonIstek) return;
    aiKarti.replaceChildren(aiKarti.firstChild, yazi('Yapay zekâya şu an ulaşılamadı. Biraz sonra tekrar dene.', 'soluk'));
  }
  matematikCiz();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const soru = girdi.value.trim();
  if (soru) ara(soru);
});

document.querySelectorAll('[data-ornek]').forEach((dugme) => {
  dugme.addEventListener('click', () => {
    girdi.value = dugme.dataset.ornek;
    ara(girdi.value);
  });
});
