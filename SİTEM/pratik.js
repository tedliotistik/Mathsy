// =========================================
// PRATİK SAYFASI: GeoGebra geometri atölyesi + keşif görevleri
// =========================================
(() => { // diğer dosyalarla isim çakışmasın diye kapsülde
const GOREVLER = [
  { metin: 'Bir dikdörtgen çiz. Kenarlarını ölç; çevresini ve alanını hesapla.', ipucu: 'Araç çubuğundaki çokgen aracıyla 4 nokta seç. Uzunluk ve alan ölçme araçlarını dene.' },
  { metin: 'Bir üçgen çiz. Üç açısını ölç ve topla. Köşeleri sürüklesen toplam değişiyor mu?', ipucu: 'Açı ölçme aracını üçgenin köşelerine uygula. Sonra bir köşeyi sürükle.' },
  { metin: 'Bir şekil ve bir doğru çiz. Şeklin doğruya göre yansımasını (simetriğini) oluştur.', ipucu: 'Yansıtma aracını seç, önce şekle sonra doğruya tıkla.' },
  { metin: 'Bir çember çiz. Yarıçapını ölç. Çapı yarıçapın kaç katı?', ipucu: 'Merkez ve çember üzerinde bir nokta seçerek çember çiz, sonra uzunluk ölç.' },
];
const ANAHTAR = 'mathsy-geo-gorevler';

function kayitliOku() { try { return JSON.parse(localStorage.getItem(ANAHTAR)) || []; } catch (e) { return []; } }
function kayitliYaz(d) { try { localStorage.setItem(ANAHTAR, JSON.stringify(d)); } catch (e) { /* sorun değil */ } }

const liste = document.getElementById('geo-liste');
const ilerleme = document.getElementById('geo-ilerleme');
let bitenler = kayitliOku();

function ilerlemeYaz() {
  const n = bitenler.length;
  ilerleme.textContent = n === GOREVLER.length ? 'Harika! Hepsini keşfettin.' : `${n} / ${GOREVLER.length} görev tamamlandı`;
}

GOREVLER.forEach((g, i) => {
  const li = document.createElement('li');
  const etiket = document.createElement('label');
  const kutu = document.createElement('input');
  kutu.type = 'checkbox';
  kutu.checked = bitenler.includes(i);
  kutu.addEventListener('change', () => {
    bitenler = kutu.checked ? [...new Set([...bitenler, i])] : bitenler.filter((x) => x !== i);
    kayitliYaz(bitenler);
    ilerlemeYaz();
  });
  const yazi = document.createElement('span');
  yazi.textContent = g.metin;
  etiket.append(kutu, yazi);
  const ipucu = document.createElement('details');
  const ozet = document.createElement('summary');
  ozet.textContent = 'İpucu';
  const p = document.createElement('p');
  p.textContent = g.ipucu;
  ipucu.append(ozet, p);
  li.append(etiket, ipucu);
  liste.append(li);
});
ilerlemeYaz();

// GeoGebra yalnızca bölüm ekrana yaklaşınca yüklenir (sayfa hızlı açılsın)
const kutu = document.getElementById('ggb-element');
let yuklendi = false;
function geogebraYukle() {
  if (yuklendi) return;
  yuklendi = true;
  if (!window.GGBApplet) { kutu.textContent = 'GeoGebra yüklenemedi. İnternet bağlantını kontrol edip sayfayı yenile.'; return; }
  new GGBApplet({
    appName: 'geometry', width: Math.floor(kutu.clientWidth) || 700, height: 480,
    showToolBar: true, showAlgebraInput: false, showMenuBar: false, language: 'tr',
  }, true).inject('ggb-element');
}
new IntersectionObserver((k, g) => {
  if (k.some((x) => x.isIntersecting)) { geogebraYukle(); g.disconnect(); }
}, { rootMargin: '300px' }).observe(document.getElementById('geometri'));
})();
