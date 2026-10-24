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
