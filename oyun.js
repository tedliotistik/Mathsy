// =========================================
// MATEMATİK OYUNLARI: çarpma ve bölme, 30 saniyelik tur
// Sayfada <div data-oyun="carpma"></div> ya da data-oyun="bolme" yazılan yere oyun kartı kurulur.
// =========================================

const SURE = 30;            // tur süresi (saniye) - değiştirmek için buradaki sayıyı yaz
const DOGRU_BEKLEME = 600;  // doğru cevaptan sonra sonraki soruya geçme süresi (ms)
const YANLIS_BEKLEME = 1100; // yanlış cevapta doğru cevabı gösterme süresi (ms)

const OYUNLAR = {
  carpma: { baslik: 'Çarpım tablosu testi', aciklama: `2’den 12’ye çarpım tablosu. ${SURE} saniyede kaç soruyu bilebilirsin?` },
  bolme:  { baslik: 'Bölme testi', aciklama: `Çarpım tablosunun tersi: bölme. ${SURE} saniyede kaç soruyu bilebilirsin?` },
};

let aktifOyun = null; // aynı anda sadece bir oyun oynanır (klavye ona gider)

function soruUret(tur, onceki) {
  let soru;
  do {
    const a = 2 + Math.floor(Math.random() * 11);
    const b = 2 + Math.floor(Math.random() * 11);
    soru = tur === 'bolme'
      ? { metin: `${a * b} ÷ ${a} =`, cevap: b }
      : { metin: `${a} × ${b} =`, cevap: a * b };
  } while (onceki && soru.metin === onceki.metin); // aynı soru üst üste gelmesin
  return soru;
}

function enIyiOku(tur) {
  try { return Number(localStorage.getItem('mathsy-en-iyi-' + tur)) || 0; } catch (e) { return 0; }
}
function enIyiYaz(tur, n) {
  try { localStorage.setItem('mathsy-en-iyi-' + tur, n); } catch (e) { /* kayıt yapılamazsa sorun değil */ }
}

function oyunKur(kap) {
  const tur = kap.dataset.oyun;
  const ayar = OYUNLAR[tur];
  if (!ayar) return null;
  const CEVRE = 2 * Math.PI * 19; // halkanın çevresi

  kap.innerHTML = `
    <div class="oyun-kart" data-durum="hazir">
      <h3 class="oyun-baslik">${ayar.baslik}</h3>
      <p class="oyun-aciklama">${ayar.aciklama}</p>
      <div class="zaman">
        <svg class="halka" viewBox="0 0 44 44" aria-hidden="true">
          <circle class="halka-iz" cx="22" cy="22" r="19"></circle>
          <circle class="halka-ilerleme" cx="22" cy="22" r="19"></circle>
        </svg>
        <span class="zaman-sayi" aria-hidden="true">${SURE}</span>
      </div>
      <div class="d-hazir">
        <p class="oyun-ipucu">Süre, Başla’ya bastığın anda işlemeye başlar.</p>
        <button type="button" class="oyun-buton" data-islem="baslat">Başla</button>
      </div>
      <div class="d-oyun">
        <p class="oyun-sayac">Soru <span data-alan="no">1</span> · Doğru <span data-alan="dogru">0</span></p>
        <div class="soru" data-alan="soru"></div>
        <div class="cevap" data-alan="cevap"></div>
        <p class="geri-bildirim" data-alan="geri"></p>
        <div class="tuslar">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-tus="${n}">${n}</button>`).join('')}
          <button type="button" data-tus="sil">Sil</button>
          <button type="button" data-tus="0">0</button>
          <button type="button" data-tus="enter">Enter</button>
        </div>
      </div>
      <div class="d-bitti" aria-live="polite">
        <h4>Süre doldu!</h4>
        <p class="sonuc-ozet" data-alan="ozet"></p>
        <p class="oyun-ipucu" data-alan="yanlisyazi"></p>
        <ul class="yanlislar" data-alan="yanlislar"></ul>
        <button type="button" class="oyun-buton" data-islem="baslat">Tekrar oyna</button>
      </div>
    </div>`;

  const kart = kap.querySelector('.oyun-kart');
  const al = (ad) => kap.querySelector(`[data-alan="${ad}"]`);
  const sayi = kap.querySelector('.zaman-sayi');
  const ilerleme = kap.querySelector('.halka-ilerleme');
  const zaman = kap.querySelector('.zaman');
  const tuslar = kap.querySelector('.tuslar');
  ilerleme.style.strokeDasharray = CEVRE;

  let bitisZamani = 0, sayac = null, beklemeId = null;
  let soru = null, yazilan = '', kilitli = false;
  let dogru = 0, yanlis = 0, no = 1, yanlislar = [];

  function halkayiGuncelle(kalan) {
    ilerleme.style.strokeDashoffset = CEVRE * (1 - kalan / SURE);
    sayi.textContent = Math.max(0, Math.ceil(kalan));
    zaman.classList.toggle('dusuk', kalan <= 5); // son 5 saniye kırmızı
    ilerleme.style.opacity = kalan > 0 ? '1' : '0'; // süre bitince halkanın ucundaki nokta görünmesin
  }

  function cevapGoster(metin, sinif) {
    const k = al('cevap');
    k.textContent = metin;
    k.className = 'cevap' + (sinif ? ' ' + sinif : '');
  }

  function soruGoster() {
    soru = soruUret(tur, soru);
    yazilan = '';
    kilitli = false;
    al('soru').textContent = soru.metin;
    al('no').textContent = no;
    al('dogru').textContent = dogru;
    al('geri').textContent = '';
    cevapGoster('', '');
    tuslar.classList.remove('kilitli');
  }

  function sonraki() {
    if (kart.dataset.durum !== 'oyun') return;
    no++;
    soruGoster();
  }

  function baslat() {
    if (aktifOyun && aktifOyun !== oyun) aktifOyun.sifirla();
    clearInterval(sayac);
    clearTimeout(beklemeId);
    dogru = 0; yanlis = 0; no = 1; yanlislar = []; soru = null;
    kart.dataset.durum = 'oyun';
    aktifOyun = oyun;
    soruGoster();
    // Telefonda tuş takımı ekranda kalsın diye kartı görünür alana getir
    kap.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    bitisZamani = performance.now() + SURE * 1000;
    halkayiGuncelle(SURE);
    sayac = setInterval(() => {
      const kalan = (bitisZamani - performance.now()) / 1000;
      if (kalan <= 0) { halkayiGuncelle(0); bitir(); } else { halkayiGuncelle(kalan); }
    }, 100);
  }

  function bitir() {
    clearInterval(sayac);
    clearTimeout(beklemeId);
    kilitli = true;
    kart.dataset.durum = 'bitti';
    if (aktifOyun === oyun) aktifOyun = null;

    const eski = enIyiOku(tur);
    const rekor = dogru > eski;
    if (rekor) enIyiYaz(tur, dogru);
    al('ozet').textContent = `Doğru: ${dogru} · Yanlış: ${yanlis}. ` +
      (rekor ? 'Yeni en iyi skor!' : `En iyi skor: ${eski}.`);

    const liste = al('yanlislar');
    liste.replaceChildren();
    yanlislar.slice(0, 4).forEach((y) => {
      const li = document.createElement('li');
      li.textContent = `${y.metin} ${y.cevap}`;
      liste.append(li);
    });
    al('yanlisyazi').textContent = yanlislar.length ? 'Şunlara tekrar bak:' : '';
  }

  function sifirla() {
    clearInterval(sayac);
    clearTimeout(beklemeId);
    kart.dataset.durum = 'hazir';
    halkayiGuncelle(SURE);
    if (aktifOyun === oyun) aktifOyun = null;
  }

  function gonder() {
    if (kilitli || yazilan === '') return;
    kilitli = true;
    tuslar.classList.add('kilitli');
    if (Number(yazilan) === soru.cevap) {
      dogru++;
      cevapGoster(yazilan, 'dogru');
      al('geri').textContent = 'Doğru!';
      beklemeId = setTimeout(sonraki, DOGRU_BEKLEME);
    } else {
      yanlis++;
      if (!yanlislar.some((y) => y.metin === soru.metin)) yanlislar.push({ metin: soru.metin, cevap: soru.cevap });
      cevapGoster(yazilan, 'yanlis');
      al('geri').textContent = `Doğrusu: ${soru.metin} ${soru.cevap}`;
      beklemeId = setTimeout(sonraki, YANLIS_BEKLEME);
    }
    al('dogru').textContent = dogru;
  }

  function tusBas(t) {
    if (kart.dataset.durum !== 'oyun' || kilitli) return;
    if (t === 'enter') { gonder(); return; }
    if (t === 'sil') yazilan = yazilan.slice(0, -1);
    else if (yazilan.length < 3 && !(t === '0' && yazilan === '')) yazilan += t; // en çok 3 hane (12 × 12 = 144)
    cevapGoster(yazilan, '');
  }

  kap.querySelectorAll('[data-islem="baslat"]').forEach((b) => b.addEventListener('click', baslat));
  tuslar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tus]');
    if (b) tusBas(b.dataset.tus);
  });

  const oyun = { tusBas, sifirla };
  halkayiGuncelle(SURE);
  return oyun;
}

// Klavye desteği: rakamlar, Backspace (sil) ve Enter
document.addEventListener('keydown', (e) => {
  if (!aktifOyun || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  let tus = null;
  if (/^[0-9]$/.test(e.key)) tus = e.key;
  else if (e.key === 'Backspace') tus = 'sil';
  else if (e.key === 'Enter') tus = 'enter';
  if (tus === null) return;
  e.preventDefault();
  aktifOyun.tusBas(tus);
});

document.querySelectorAll('[data-oyun]').forEach(oyunKur);
