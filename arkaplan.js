// =========================================
// HAREKETLİ ARKA PLAN: şeffaf kareler, dikdörtgenler, problemler, fonksiyonlar ve formüller
// Renkleri değiştirmek için aşağıdaki MOR ve ALTIN değerlerini (r,g,b) değiştir.
// =========================================
(() => {
  const MOR = '196,160,255';
  const ALTIN = '255,200,87';
  const YAZILAR = ['12 + 8 = 20', '3 × 4 = 12', '□ + 5 = 12', 'f(x) = 2x + 1', 'Alan = a × b', 'Çevre = 2 × (a + b)',
    '½ + ¼ = ¾', '%25 · 80 = 20', 'π ≈ 3,14', '−3 + 5 = 2', '60° + 30° + 90°', '3² = 9', '24 ÷ 6 = 4', 'y = x + 2'];

  const tuval = document.createElement('canvas');
  tuval.id = 'arkaplan';
  tuval.setAttribute('aria-hidden', 'true');
  document.body.prepend(tuval);
  const c = tuval.getContext('2d');
  const azalt = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rast = (a, b) => a + Math.random() * (b - a);
  let G, Y, esyalar = [];

  function kur() {
    const oran = window.devicePixelRatio || 1;
    G = innerWidth; Y = innerHeight;
    tuval.width = G * oran; tuval.height = Y * oran;
    c.setTransform(oran, 0, 0, oran, 0, 0);
    const adet = Math.round(Math.min(34, Math.max(14, (G * Y) / 45000)));
    esyalar = Array.from({ length: adet }, (_, i) => ({
      yazi: i % 3 ? YAZILAR[Math.floor(Math.random() * YAZILAR.length)] : null, // 3 öğeden 1'i şekil
      x: rast(0, G), y: rast(0, Y), w: rast(40, 150), h: rast(30, 110), boyut: rast(15, 26),
      vx: rast(-0.12, 0.12), vy: rast(-0.25, -0.06), a: rast(-0.5, 0.5), va: rast(-0.0015, 0.0015),
      ex: 0, ey: 0, ea: 0, alfa: rast(0.08, 0.18), renk: Math.random() < 0.25 ? ALTIN : MOR,
    }));
  }

  function ciz() {
    c.clearRect(0, 0, G, Y);
    for (const e of esyalar) {
      c.save();
      c.translate(e.x, e.y);
      c.rotate(e.a);
      if (e.yazi) {
        c.fillStyle = `rgba(${e.renk},${e.alfa})`;
        c.font = `600 ${e.boyut}px Fredoka, Arial, sans-serif`;
        c.fillText(e.yazi, 0, 0);
      } else {
        c.lineWidth = 1.5;
        c.strokeStyle = `rgba(${e.renk},${e.alfa})`;
        c.fillStyle = `rgba(${e.renk},${e.alfa * 0.25})`;
        c.fillRect(-e.w / 2, -e.h / 2, e.w, e.h);
        c.strokeRect(-e.w / 2, -e.h / 2, e.w, e.h);
      }
      c.restore();
    }
  }

  function ilerle() {
    for (const e of esyalar) {
      e.x += e.vx + e.ex; e.y += e.vy + e.ey; e.a += e.va + e.ea;
      e.ex *= 0.94; e.ey *= 0.94; e.ea *= 0.95; // tıklama etkisi yavaşça söner
      if (e.y < -160) { e.y = Y + 60; e.x = rast(0, G); }
      if (e.x < -250) e.x = G + 40;
      if (e.x > G + 250) e.x = -40;
    }
  }

  let son = 0;
  function dongu(zaman) {
    if (zaman - son > 33) { son = zaman; ilerle(); ciz(); } // yaklaşık 30 kare/sn
    requestAnimationFrame(dongu);
  }

  let bekle;
  addEventListener('resize', () => { clearTimeout(bekle); bekle = setTimeout(() => { kur(); ciz(); }, 200); });
  // Boş bir yere tıklayınca yakındaki şekil ve yazılar savrulur, kendi etrafında döner
  if (!azalt) {
    addEventListener('pointerdown', (ol) => {
      if (ol.target.closest && ol.target.closest('a, button, input, label, summary, .oyun-kart, aside, header')) return;
      for (const e of esyalar) {
        const dx = e.x - ol.clientX, dy = e.y - ol.clientY, d = Math.hypot(dx, dy);
        if (d > 280) continue;
        const g = 1 - d / 280;
        e.ex += (dx / (d || 1)) * g * 8;
        e.ey += (dy / (d || 1)) * g * 8;
        e.ea += (Math.random() < 0.5 ? -1 : 1) * g * 0.18;
      }
    });
  }

  kur();
  ciz();
  if (!azalt) requestAnimationFrame(dongu); // "hareketi azalt" açıksa sabit kalır
})();
