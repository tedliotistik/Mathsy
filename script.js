// =========================================
// MATHSY – menü ve kaydırma efektleri
// =========================================

const kok = document.body.dataset.kok || ''; // alt sayfalarda "../" olur
const ustMenu = document.querySelector('.ust-menu');
const baglantilar = document.querySelectorAll('.baglantilar a');
const bolumler = document.querySelectorAll('main section');

// 1) Aşağı kaydırınca üst menüyü koyulaştır
function menuyuGuncelle() {
  ustMenu.classList.toggle('kaydi', window.scrollY > 40);
}
window.addEventListener('scroll', menuyuGuncelle, { passive: true });
menuyuGuncelle();

// 2) Ekrana girince göster, çıkınca gizle → efekt HER SEFERİNDE tekrarlanır
const belirGozcusu = new IntersectionObserver((kayitlar) => {
  kayitlar.forEach((kayit) => {
    kayit.target.classList.toggle('gorundu', kayit.isIntersecting);
  });
}, { threshold: 0.15 });

document.querySelectorAll('.belir').forEach((oge) => belirGozcusu.observe(oge));

// 3) Hangi bölümdeysen üst menüde o bağlantıyı vurgula (sadece ana sayfada)
const bolumGozcusu = new IntersectionObserver((kayitlar) => {
  kayitlar.forEach((kayit) => {
    if (kayit.isIntersecting) {
      baglantilar.forEach((a) => {
        a.classList.toggle('aktif', a.getAttribute('href') === '#' + kayit.target.id);
      });
    }
  });
}, { rootMargin: '-45% 0px -45% 0px' });

bolumler.forEach((bolum) => bolumGozcusu.observe(bolum));

// 4) SOL MENÜ: menu.js'teki MENU listesinden kurulur
const yanMenu = document.getElementById('yan-menu');
const dugme = document.getElementById('menu-dugme');
const liste = document.getElementById('yan-liste');

if (liste && typeof MENU !== 'undefined') {
  MENU.forEach((grup) => {
    if (grup.sayfa) { // alt başlığı olmayan, doğrudan sayfaya giden başlık
      const tek = document.createElement('a');
      tek.className = 'tek-baslik';
      tek.href = kok + grup.sayfa;
      tek.textContent = grup.baslik;
      if (location.pathname.endsWith(grup.sayfa)) tek.classList.add('aktif');
      liste.appendChild(tek);
      return;
    }
    const kutu = document.createElement('details');
    const baslik = document.createElement('summary');
    baslik.textContent = grup.baslik;
    kutu.appendChild(baslik);

    const ul = document.createElement('ul');
    grup.altlar.forEach((alt) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = kok + alt.sayfa;
      a.textContent = alt.ad;
      if (location.pathname.endsWith(alt.sayfa)) { // bulunduğun sayfayı işaretle
        a.classList.add('aktif');
        kutu.open = true;
      }
      li.appendChild(a);
      ul.appendChild(li);
    });
    kutu.appendChild(ul);
    liste.appendChild(kutu);
  });
}

function menuyuAyarla(ac) {
  yanMenu.classList.toggle('acik', ac);
  dugme.setAttribute('aria-expanded', ac);
  dugme.setAttribute('aria-label', ac ? 'Menüyü kapat' : 'Menüyü aç');
}

dugme.addEventListener('click', () => menuyuAyarla(!yanMenu.classList.contains('acik')));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menuyuAyarla(false); });
document.addEventListener('click', (e) => { if (!yanMenu.contains(e.target)) menuyuAyarla(false); });

// 5) SAYFA ÇEVİRME: yan menüdeki başlıklara tıklayınca sayfa çevrilerek açılır
let menudenGidiyor = false;
const gecisDestekli = 'onpageswap' in window; // Chrome, Edge, Opera, yeni Safari

// Sayfa çevirme sadece yan menüden gidilince çalışsın (üst menüde çalışmasın)
window.addEventListener('pageswap', (e) => {
  if (e.viewTransition && !menudenGidiyor) e.viewTransition.skipTransition();
});

// Geri tuşuyla dönülünce ayarları sıfırla
window.addEventListener('pageshow', () => {
  menudenGidiyor = false;
  document.documentElement.classList.remove('cevir-cik');
});

if (liste) {
  liste.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || a.href === location.href) return;
    menudenGidiyor = true;
    // Tarayıcı sayfa çevirmeyi desteklemiyorsa yedek animasyonu oynat, sonra git
    if (!gecisDestekli && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      e.preventDefault();
      document.documentElement.classList.add('cevir-cik');
      setTimeout(() => { location.href = a.href; }, 550);
    }
  });
}
