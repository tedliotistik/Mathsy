// =========================================
// FORMÜL ARAMA: sadece yapay zekâ ile
// =========================================

// Yapay zekâ sunucusunun adresi (sunucu/yapay-zeka-sunucusu.js'i yayınlayınca buraya yaz).
// Boşken arama "Yakında..." mesajı gösterir.
const AI_ADRESI = "";

const form = document.getElementById('arama-formu');
const girdi = document.getElementById('arama-girdi');
const sonuc = document.getElementById('sonuc');
let sonIstek = 0; // eski cevapların yenisinin üstüne yazmasını engeller

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

// Cevaptaki LaTeX'i ($$ ... $$) düzgün matematik yazımına çevirir
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
  sonuc.replaceChildren();

  if (!AI_ADRESI) {
    sonuc.append(kart('Yapay zekâ araması', yazi('Yakında...', 'soluk')));
    return;
  }

  const k = kart('Yapay zekâ yanıtı', yazi('Formül hazırlanıyor…', 'soluk'));
  sonuc.append(k);
  try {
    const metin = await yapayZekayaSor(soru);
    if (istek !== sonIstek) return; // bu arada yeni arama yapıldı
    k.replaceChildren(k.firstChild, yazi(metin, 'ai-yanit'));
    matematikCiz();
  } catch (hata) {
    if (istek !== sonIstek) return;
    k.replaceChildren(k.firstChild, yazi('Yapay zekâya şu an ulaşılamadı. Biraz sonra tekrar dene.', 'soluk'));
  }
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
