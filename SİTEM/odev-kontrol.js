// =========================================
// ÖDEV KONTROL (öğretmen)
// Liste: Öğrenci - Sınıf - Yapay Zekâ geri bildirimi - [Ödev] düğmesi
// Düğmeye basınca öğrencinin cevapları açılır; buradan onaylanır (✓ Tamamlandı).
// =========================================
(() => {
  const { api } = window.Mathsy;
  const kutu = document.getElementById('kontrol');
  const HARF = (i) => String.fromCharCode(65 + i);
  const el = (e, o = {}, ...c) => { const x = Object.assign(document.createElement(e), o); x.append(...c); return x; };
  const tarih = (sn) => new Date(sn * 1000).toLocaleDateString('tr-TR');
  const geriLink = () => el('a', { className: 'geri', href: '#', textContent: '← Ödev Kontrol' });
  const sinifYazi = (s) => (s ? `${s}. sınıf` : '–');

  // ---------- görseller (PDF soruları): 3'er 3'er yüklenir ----------
  const onbellek = {};
  let kuyruk = [], calisan = 0;
  function goruntuYukle(gid, img) { kuyruk.push({ gid, img }); siradaki(); }
  function siradaki() {
    while (calisan < 3 && kuyruk.length) {
      const { gid, img } = kuyruk.shift();
      calisan++;
      (onbellek[gid] ? Promise.resolve({ veri: onbellek[gid] }) : api('/gorsel?id=' + gid))
        .then((v) => { onbellek[gid] = v.veri; img.src = v.veri; })
        .catch(() => img.replaceWith(el('p', { className: 'soluk', textContent: 'Görsel yüklenemedi.' })))
        .finally(() => { calisan--; siradaki(); });
    }
  }

  // ---------- liste ----------
  async function listeGoster() {
    kuyruk = [];
    kutu.replaceChildren(el('h1', { textContent: 'Ödev Kontrol' }), el('p', { className: 'soluk', textContent: 'Yükleniyor…' }));
    try {
      const { teslimler } = await api('/teslimler');
      const bekleyen = teslimler.filter((t) => t.durum === 'kontrol').length;
      const govde = el('tbody');
      if (!teslimler.length) govde.append(el('tr', {}, el('td', { colSpan: 4, className: 'soluk', textContent: 'Henüz gönderilmiş ödev yok.' })));
      teslimler.forEach((t) => {
        const isim = el('td', {}, el('span', { className: 'ogr-ad', textContent: t.goruntu }),
          el('span', { className: 'alt-bilgi', textContent: `${t.baslik} · ${t.dogru}/${t.toplam} doğru · ${tarih(t.teslim_tarih)}` }));
        const islem = el('td', { className: 'kontrol-islem' });
        if (t.durum === 'tamam') islem.append(el('span', { className: 'chip chip-tamam', textContent: '✓ Tamamlandı' }));
        islem.append(el('button', { type: 'button', className: 'buton', textContent: 'Ödev', onclick: () => { location.hash = '#' + t.id; } }));
        govde.append(el('tr', {}, isim, el('td', { textContent: sinifYazi(t.sinif) }), el('td', { className: 'fb-hucre', textContent: t.geri_bildirim || '–' }), islem));
      });
      kutu.replaceChildren(el('a', { className: 'geri', href: 'ogretmen.html', textContent: '← Öğretmen Paneli' }),
        el('h1', { textContent: 'Ödev Kontrol' }),
        el('p', { className: 'soluk', textContent: bekleyen ? `${bekleyen} ödev kontrolünü bekliyor.` : 'Kontrol bekleyen ödev yok.' }),
        el('div', { className: 'tablo-kap' }, el('table', { className: 'tablo kontrol-tablo' },
          el('thead', {}, el('tr', {}, el('th', { textContent: 'Öğrenci' }), el('th', { textContent: 'Sınıf' }), el('th', { textContent: 'Yapay zekâ geri bildirimi' }), el('th'))), govde)));
    } catch (e) { kutu.replaceChildren(el('h1', { textContent: 'Ödev Kontrol' }), el('p', { className: 'mesaj', textContent: e.message })); }
  }

  // ---------- tek ödev ----------
  const goster = (s, v) => {
    if (v === null || v === undefined) return '— (boş bıraktı)';
    if (s.tur === 'gorsel') return HARF(v);
    if (s.tur === 'sec') return `${HARF(v)}. ${(s.secenekler || [])[v] ?? ''}`;
    if (s.tur === 'dy') return v ? 'Doğru' : 'Yanlış';
    return String(v);
  };
  const dogruGoster = (s) => (s.tur === 'bosluk' || s.tur === 'kisa' ? String(s.cevap).split('|').join('  ya da  ') : goster(s, s.cevap));

  async function detayGoster(id) {
    kuyruk = [];
    kutu.replaceChildren(geriLink(), el('p', { className: 'soluk', textContent: 'Yükleniyor…' }));
    try {
      const d = await api('/teslim-detay?id=' + id);
      const mesaj = el('p', { className: 'mesaj', role: 'alert' });
      const yuzde = d.toplam ? Math.round((100 * d.dogru) / d.toplam) : 0;

      const yorum = el('p', { className: 'ai-yanit', textContent: d.geri_bildirim || '–' });
      const yenile = el('button', { type: 'button', className: 'buton ikincil', textContent: 'Yorumu yenile', onclick: async (e) => {
        e.target.disabled = true; e.target.textContent = 'Hazırlanıyor…';
        try { yorum.textContent = (await api('/yorum-yenile', { id })).geri_bildirim; } catch (er) { mesaj.textContent = er.message; }
        e.target.disabled = false; e.target.textContent = 'Yorumu yenile';
      } });

      const konuChipleri = Object.entries(d.analiz.konular || {}).map(([ad, s]) => {
        const oran = s.dogru / s.toplam;
        return el('span', { className: 'chip ' + (oran >= 0.75 ? 'chip-tamam' : oran < 0.6 ? 'chip-yanlis' : 'chip-isaret'), textContent: `${ad}: ${s.dogru}/${s.toplam}` });
      });

      const kartlar = d.sorular.map((s, i) => {
        const bos = s.verilen === null;
        const [sinif, yazi] = bos ? ['bos', 'Boş'] : s.dogruMu ? ['dogru', '✓ Doğru'] : ['yanlis', '✗ Yanlış'];
        const kart = el('section', { className: `detay-kart ${sinif}` },
          el('div', { className: 'quiz-baslik' }, el('h2', { textContent: `Soru ${i + 1}` }),
            el('span', { className: 'chip ' + (bos ? 'chip-bos' : s.dogruMu ? 'chip-tamam' : 'chip-yanlis'), textContent: yazi })));
        if (s.konu) kart.append(el('p', { className: 'soluk kucuk', textContent: 'Konu: ' + s.konu }));
        if (s.tur === 'gorsel') {
          const img = el('img', { className: 'soru-gorsel', alt: `Soru ${i + 1}` });
          goruntuYukle(s.gid, img);
          kart.append(el('div', { className: 'soru-kagit' }, img));
        } else kart.append(el('p', { className: 'soru-metin', textContent: s.soru }));
        kart.append(el('dl', { className: 'detay-cevaplar' },
          el('dt', { textContent: 'Öğrencinin cevabı' }), el('dd', { textContent: goster(s, s.verilen) }),
          el('dt', { textContent: 'Doğru cevap' }), el('dd', { textContent: dogruGoster(s) })));
        return kart;
      });

      const alt = el('div', { className: 'detay-alt' });
      if (d.durum === 'kontrol') {
        alt.append(el('button', { type: 'button', className: 'oyun-buton', textContent: 'Onayla ✓ Tamamlandı', onclick: async (e) => {
          if (!confirm('Ödev onaylansın mı? Öğrencide “✓ Tamamlandı” görünecek.')) return;
          e.target.disabled = true;
          try { await api('/onayla', { id }); location.hash = ''; } catch (er) { mesaj.textContent = er.message; e.target.disabled = false; }
        } }));
      } else alt.append(el('span', { className: 'chip chip-tamam', textContent: '✓ Tamamlandı' }));

      kutu.replaceChildren(geriLink(),
        el('div', { className: 'detay-ust' }, el('h1', { textContent: `${d.goruntu} · ${sinifYazi(d.sinif)}` }),
          el('p', { className: 'soluk', textContent: `${d.baslik} · Teslim: ${tarih(d.teslim_tarih)}` })),
        el('div', { className: 'detay-chipler' }, el('span', { className: 'chip chip-isaret', textContent: `Doğru ${d.dogru}/${d.toplam} (%${yuzde})` }), ...konuChipleri),
        el('div', { className: 'ai-kutu' }, el('h3', { textContent: 'Yapay zekâ geri bildirimi' }), yorum, yenile),
        ...kartlar, mesaj, alt);
    } catch (e) { kutu.replaceChildren(geriLink(), el('p', { className: 'mesaj', textContent: e.message })); }
  }

  function yonlendir() {
    const id = Number(location.hash.slice(1));
    if (id) detayGoster(id); else listeGoster();
  }
  addEventListener('hashchange', yonlendir);
  yonlendir();
})();
