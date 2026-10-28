// =========================================
// ÖDEV GÖNDER: öğrenci seçimi + soru hazırlama (4 soru türü)
// =========================================
(() => {
  const { api } = window.Mathsy;
  const ogrKutu = document.getElementById('od-ogrenciler');
  const hepsi = document.getElementById('od-hepsi');
  const sayiYazi = document.getElementById('od-sayi');
  const sorular = document.getElementById('od-sorular');
  const baslik = document.getElementById('od-baslik');
  const mesaj = document.getElementById('od-mesaj');
  const TURLER = { sec: 'Çoktan seçmeli', dy: 'Doğru / Yanlış', bosluk: 'Boşluk doldurma', kisa: 'Kısa cevap' };
  let sayac = 0;

  const el = (etiket, ozellik = {}, ...cocuk) => { const e = Object.assign(document.createElement(etiket), ozellik); e.append(...cocuk); return e; };
  const secili = () => [...ogrKutu.querySelectorAll('input:checked')].map((i) => i.value);
  const sayiGuncelle = () => { sayiYazi.textContent = `${secili().length} öğrenci seçildi`; };

  async function ogrencileriYukle() {
    try {
      const { ogrenciler } = await api('/ogrenciler');
      if (!ogrenciler.length) { ogrKutu.textContent = 'Önce “Öğrenci Ekle” sayfasından öğrenci eklemelisin.'; return; }
      ogrenciler.forEach((o) => {
        const kutu = el('input', { type: 'checkbox', value: o.ad });
        kutu.addEventListener('change', sayiGuncelle);
        ogrKutu.append(el('label', { className: 'secenek' }, kutu, el('span', { textContent: o.goruntu })));
      });
      sayiGuncelle();
    } catch (e) { ogrKutu.textContent = e.message; }
  }

  hepsi.addEventListener('change', () => { ogrKutu.querySelectorAll('input').forEach((i) => { i.checked = hepsi.checked; }); sayiGuncelle(); });

  function soruEkle(tur) {
    const id = ++sayac;
    const kaldir = el('button', { type: 'button', className: 'tablo-sil', textContent: 'Kaldır' });
    const kart = el('div', { className: 'soru-karti' }, el('div', { className: 'soru-bas' }, el('strong', { textContent: TURLER[tur] }), kaldir));
    kart.dataset.tur = tur;
    kaldir.addEventListener('click', () => kart.remove());
    const soru = el('textarea', { rows: 2, maxLength: 500, placeholder: tur === 'bosluk' ? 'Soru metni. Boşluk için ___ yaz. Örn: 3/4 + 1/4 = ___' : 'Soru metni' });
    soru.dataset.alan = 'soru';
    const konu = el('input', { maxLength: 40, placeholder: 'Konu (analiz için, örn. Kesirler)' });
    konu.dataset.alan = 'konu';
    kart.append(soru, konu);
    if (tur === 'sec') {
      kart.append(el('p', { className: 'soluk', textContent: 'Seçenekleri yaz, doğru olanın yanındaki daireyi işaretle.' }));
      for (let i = 0; i < 4; i++) {
        const s = el('input', { maxLength: 120, placeholder: `${String.fromCharCode(65 + i)} seçeneği` });
        s.dataset.alan = 'sec';
        kart.append(el('div', { className: 'sec-satir' }, el('input', { type: 'radio', name: `d${id}`, value: i }), s));
      }
    } else if (tur === 'dy') {
      kart.append(el('div', { className: 'dy-satir' },
        el('label', {}, el('input', { type: 'radio', name: `d${id}`, value: 'dogru' }), ' Doğru'),
        el('label', {}, el('input', { type: 'radio', name: `d${id}`, value: 'yanlis' }), ' Yanlış')));
    } else {
      const c = el('input', { maxLength: 100, placeholder: 'Doğru cevap (birden fazla kabul edilen varsa | ile ayır)' });
      c.dataset.alan = 'cevap';
      kart.append(c);
    }
    sorular.append(kart);
    soru.focus();
  }

  function topla() {
    const cikti = [];
    for (const kart of sorular.children) {
      const tur = kart.dataset.tur;
      if (tur === 'gorsel') { // PDF'den gelen görsel soru
        const dogru = kart.querySelector('input[type=radio]:checked');
        if (!dogru) throw new Error('PDF sorularının hepsinde doğru şıkkı işaretle.');
        cikti.push({ tur, gorsel: kart.gorselVeri, n: Number(kart.dataset.n), cevap: Number(dogru.value), konu: kart.querySelector('[data-alan=konu]').value.trim() });
        continue;
      }
      const q = { tur, soru: kart.querySelector('[data-alan=soru]').value.trim(), konu: kart.querySelector('[data-alan=konu]').value.trim() };
      if (!q.soru) throw new Error('Boş bir soru metni var.');
      const isaret = kart.querySelector('input[type=radio]:checked');
      if (tur === 'sec') {
        const dolu = [...kart.querySelectorAll('[data-alan=sec]')].map((x, i) => ({ v: x.value.trim(), i })).filter((x) => x.v);
        if (dolu.length < 2) throw new Error('Çoktan seçmeli soruda en az 2 seçenek yaz.');
        if (!isaret) throw new Error('Çoktan seçmeli soruda doğru seçeneği işaretle.');
        q.cevap = dolu.findIndex((x) => x.i === Number(isaret.value));
        if (q.cevap < 0) throw new Error('İşaretlediğin doğru seçenek boş bırakılmış.');
        q.secenekler = dolu.map((x) => x.v);
      } else if (tur === 'dy') {
        if (!isaret) throw new Error('Doğru / Yanlış sorusunda cevabı işaretle.');
        q.cevap = isaret.value === 'dogru';
      } else {
        q.cevap = kart.querySelector('[data-alan=cevap]').value.trim();
        if (!q.cevap) throw new Error('Bir sorunun doğru cevabı boş.');
        if (tur === 'bosluk' && !q.soru.includes('___')) throw new Error('Boşluk doldurma sorusunda ___ yazmalısın.');
      }
      cikti.push(q);
    }
    if (!cikti.length) throw new Error('En az bir soru ekle.');
    return cikti;
  }

  // ---- PDF'den soru ekleme ----
  const pdfDurum = document.getElementById('pdf-durum');
  const ISCI = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const webpVar = document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp');
  const OLCEK = 2; // sayfa 2 kat büyütülerek çizilir (okunaklı olsun)

  function gorselKarti(veri, n) {
    const kaldir = el('button', { type: 'button', className: 'tablo-sil', textContent: 'Kaldır' });
    const id = ++sayac;
    const kart = el('div', { className: 'soru-karti' }, el('div', { className: 'soru-bas' }, el('strong', { textContent: 'PDF sorusu' }), kaldir));
    kart.dataset.tur = 'gorsel';
    kart.dataset.n = n;
    kart.gorselVeri = veri;
    kaldir.addEventListener('click', () => kart.remove());
    const sikler = el('div', { className: 'sik-sec' });
    for (let i = 0; i < n; i++) sikler.append(el('label', {}, el('input', { type: 'radio', name: `d${id}`, value: i }), ` ${String.fromCharCode(65 + i)}`));
    const konu = el('input', { maxLength: 40, placeholder: 'Konu (analiz için, örn. Kesirler)' });
    konu.dataset.alan = 'konu';
    kart.append(el('div', { className: 'gorsel-onizleme' }, el('img', { src: veri, alt: 'Soru görseli' })), el('p', { className: 'soluk', textContent: 'Doğru şık:' }), sikler, konu);
    sorular.append(kart);
  }

  // Son sorunun altındaki boş beyaz alanı keser (şekil varsa şeklin altında durur)
  function altiKirp(kes) {
    const g = kes.width, h = kes.height;
    const veri = kes.getContext('2d').getImageData(0, 0, g, h).data;
    let son = h - 1;
    for (; son > 0; son--) {
      let dolu = false;
      for (let x = 0; x < g; x += 2) {
        const p = (son * g + x) * 4;
        if (veri[p] < 240 || veri[p + 1] < 240 || veri[p + 2] < 240) { dolu = true; break; }
      }
      if (dolu) break;
    }
    const yeniH = Math.min(h, Math.max(60, son + 16));
    if (yeniH >= h) return kes;
    const yeni = document.createElement('canvas');
    yeni.width = g; yeni.height = yeniH;
    yeni.getContext('2d').drawImage(kes, 0, 0);
    return yeni;
  }

  async function pdfIsle(dosya) {
    if (!window.pdfjsLib) throw new Error('PDF okuyucu yüklenemedi. İnternet bağlantını kontrol edip sayfayı yenile.');
    pdfjsLib.GlobalWorkerOptions.workerSrc = ISCI;
    const n = Number(document.getElementById('pdf-sik').value);
    const pdf = await pdfjsLib.getDocument({ data: await dosya.arrayBuffer() }).promise;
    const sayfalar = [], gorunumler = [];
    for (let i = 1; i <= pdf.numPages; i++) { // 1. tur: yazıları ve konumlarını oku
      pdfDurum.textContent = `PDF okunuyor… (${i}/${pdf.numPages})`;
      const sf = await pdf.getPage(i);
      const gv = sf.getViewport({ scale: OLCEK });
      const icerik = await sf.getTextContent();
      const ogeler = icerik.items.filter((o) => o.str && o.str.trim()).map((o) => {
        const t = pdfjsLib.Util.transform(gv.transform, o.transform);
        return { s: o.str, x: t[4], y: t[5], h: o.height ? o.height * OLCEK : Math.abs(t[3]) };
      });
      sayfalar.push({ g: gv.width, y: gv.height, ogeler });
      gorunumler.push({ sf, gv });
    }
    const kutular = document.getElementById('pdf-mod').value === 'sayfa'
      ? sayfalar.map((s, i) => ({ sayfa: i, x: 0, y: 0, g: s.g, h: s.y }))
      : soruKutulari(sayfalar);
    if (!kutular.length) throw new Error('Soru numaraları bulunamadı. “Her sayfa bir soru” yöntemini dene.');

    let eklenen = 0;
    for (const si of [...new Set(kutular.map((k) => k.sayfa))]) { // 2. tur: sayfayı çiz, soruları kırp
      pdfDurum.textContent = `Sorular hazırlanıyor… (sayfa ${si + 1}/${pdf.numPages})`;
      const { sf, gv } = gorunumler[si];
      const tuval = document.createElement('canvas');
      tuval.width = Math.ceil(gv.width);
      tuval.height = Math.ceil(gv.height);
      await sf.render({ canvasContext: tuval.getContext('2d'), viewport: gv }).promise;
      for (const k of kutular.filter((x) => x.sayfa === si)) {
        const x = Math.max(0, Math.floor(k.x - 8)), y = Math.max(0, Math.floor(k.y - 8));
        const g = Math.min(tuval.width - x, Math.ceil(k.g + 16)), h = Math.min(tuval.height - y, Math.ceil(k.h + 16));
        if (g < 60 || h < 30) continue;
        const kes = document.createElement('canvas');
        kes.width = g; kes.height = h;
        const c = kes.getContext('2d');
        c.fillStyle = '#fff';
        c.fillRect(0, 0, g, h);
        c.drawImage(tuval, x, y, g, h, 0, 0, g, h);
        const son = k.kirp ? altiKirp(kes) : kes;
        gorselKarti(webpVar ? son.toDataURL('image/webp', 0.88) : son.toDataURL('image/jpeg', 0.9), n);
        eklenen++;
      }
    }
    return eklenen;
  }

  document.getElementById('pdf-dosya').addEventListener('change', async (e) => {
    const dosya = e.target.files[0];
    if (!dosya) return;
    try {
      const eklenen = await pdfIsle(dosya);
      pdfDurum.textContent = `${eklenen} soru eklendi. Aşağıda her sorunun görüntüsünü kontrol et, doğru şıkları işaretle (ya da cevap anahtarını yaz).`;
    } catch (er) { pdfDurum.textContent = er.message; }
    e.target.value = '';
  });

  document.getElementById('pdf-uygula').addEventListener('click', () => {
    const harfler = document.getElementById('pdf-anahtar').value.toUpperCase().replace(/[^A-E]/g, '');
    const kartlar = [...sorular.querySelectorAll('[data-tur=gorsel]')];
    kartlar.forEach((k, i) => { const r = k.querySelectorAll('input[type=radio]')[harfler.charCodeAt(i) - 65]; if (r) r.checked = true; });
    pdfDurum.textContent = `Anahtardaki ${harfler.length} harf, ${kartlar.length} PDF sorusuna uygulandı.`;
  });

  document.querySelectorAll('[data-soru-turu]').forEach((d) => d.addEventListener('click', () => soruEkle(d.dataset.soruTuru)));

  document.getElementById('od-gonder').addEventListener('click', async () => {
    mesaj.textContent = '';
    try {
      if (!secili().length) throw new Error('En az bir öğrenci seç.');
      if (!baslik.value.trim()) throw new Error('Ödev başlığı yaz.');
      const v = await api('/odev', { baslik: baslik.value, sorular: topla(), ogrenciler: secili() });
      mesaj.textContent = `Ödev ${v.atanan} öğrenciye gönderildi.`;
      sorular.replaceChildren();
      baslik.value = '';
      pdfDurum.textContent = '';
      document.getElementById('pdf-anahtar').value = '';
      hepsi.checked = false;
      ogrKutu.querySelectorAll('input').forEach((i) => { i.checked = false; });
      sayiGuncelle();
    } catch (e) { mesaj.textContent = e.message; }
  });

  ogrencileriYukle();
})();
