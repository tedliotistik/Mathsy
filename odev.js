// =========================================
// ÖDEV ÇÖZME EKRANI (öğrenci): her sayfada bir soru, işaretleme, gözden geçirme, gönderme
// Soru türleri: PDF'den gelen görsel (A-E), çoktan seçmeli, doğru/yanlış, boşluk doldurma, kısa cevap
// =========================================
(() => {
  const { api } = window.Mathsy;
  const kutu = document.getElementById('quiz');
  const id = Number(new URLSearchParams(location.search).get('id'));
  const ANAHTAR = 'mathsy-odev-' + ((window.Mathsy.oku() || {}).ad || '') + '-' + id; // ortak cihazda başka öğrencinin cevapları görünmesin
  const HARF = (i) => String.fromCharCode(65 + i);
  const el = (e, o = {}, ...c) => { const x = Object.assign(document.createElement(e), o); x.append(...c); return x; };
  let odev, cevaplar = [], isaretli = [], su = 0;
  const gorseller = {}; // gid -> veri (bir kez indirilir)

  const kaydet = () => { try { localStorage.setItem(ANAHTAR, JSON.stringify({ cevaplar, isaretli })); } catch (e) { /* sorun değil */ } };
  const cevapli = (i) => cevaplar[i] !== undefined && cevaplar[i] !== null && cevaplar[i] !== '';
  const geriDugme = () => el('a', { className: 'geri', href: 'odevlerim.html', textContent: '← Ödevlerim' });

  function gorselYukle(s, hedef) {
    if (gorseller[s.gid]) { hedef.src = gorseller[s.gid]; return; }
    api('/gorsel?id=' + s.gid).then((v) => { gorseller[s.gid] = v.veri; hedef.src = v.veri; })
      .catch(() => { hedef.replaceWith(el('p', { className: 'soluk', textContent: 'Soru görseli yüklenemedi. Sayfayı yenile.' })); });
  }

  function giris() {
    kutu.replaceChildren(geriDugme(), el('h1', { textContent: odev.baslik }),
      el('div', { className: 'quiz-bilgi' },
        el('p', { textContent: `Soru sayısı: ${odev.sorular.length}` }),
        el('p', { textContent: 'Cevaplar yalnızca bir kez gönderilir. Göndermeden önce soruları gözden geçirebilirsin.' }),
        el('p', { textContent: 'Yarıda bırakırsan cevapların bu cihazda saklanır.' })),
      el('button', { className: 'oyun-buton', type: 'button', textContent: cevaplar.some((_, i) => cevapli(i)) ? 'Devam et' : 'Ödeve başla', onclick: () => soruGoster(0) }));
  }

  function gezinti() {
    const satir = el('div', { className: 'quiz-gezinti' });
    odev.sorular.forEach((_, i) => {
      const d = el('button', { type: 'button', className: 'quiz-no' + (cevapli(i) ? ' cevapli' : '') + (isaretli[i] ? ' isaretli' : '') + (i === su ? ' su-an' : ''), textContent: i + 1, onclick: () => soruGoster(i) });
      d.title = `Soru ${i + 1}`;
      satir.append(d);
    });
    return satir;
  }

  function sik(harf, metin, secili, sec, yuvarlak) {
    const radyo = el('input', { type: 'radio', name: 'cevap', checked: secili });
    radyo.addEventListener('change', sec);
    return yuvarlak
      ? el('label', { className: 'sik-yuvarlak' }, radyo, el('span', { className: 'daire', textContent: harf }))
      : el('label', { className: 'sik' }, radyo, el('span', { className: 'sik-harf', textContent: harf + '.' }), el('span', { textContent: metin }));
  }

  function soruGoster(i) {
    su = i;
    const s = odev.sorular[i];
    const sec = (v) => () => { cevaplar[i] = v; kaydet(); chip.className = 'chip chip-tamam'; chip.textContent = 'Cevaplandı'; };
    const chip = el('span', { className: 'chip ' + (cevapli(i) ? 'chip-tamam' : 'chip-bos'), textContent: cevapli(i) ? 'Cevaplandı' : 'Henüz cevaplanmadı' });
    const isaretDugme = el('button', { type: 'button', className: 'buton ikincil isaret-dugme', textContent: isaretli[i] ? 'İşareti kaldır' : 'Soruyu işaretle',
      onclick: () => { isaretli[i] = !isaretli[i]; kaydet(); soruGoster(i); } });

    const govde = el('div', { className: 'quiz-soru' });
    if (s.tur === 'gorsel') {
      const resim = el('img', { alt: `Soru ${i + 1}`, className: 'soru-gorsel' });
      gorselYukle(s, resim);
      const grup = el('div', { className: 'sik-grup' });
      for (let k = 0; k < s.n; k++) grup.append(sik(HARF(k), '', cevaplar[i] === k, sec(k), true));
      govde.append(el('div', { className: 'soru-kagit' }, resim), grup);
    } else {
      govde.append(el('p', { className: 'soru-metin', textContent: s.soru }));
      if (s.tur === 'sec') s.secenekler.forEach((m, k) => govde.append(sik(HARF(k), m, cevaplar[i] === k, sec(k))));
      else if (s.tur === 'dy') [['Doğru', true], ['Yanlış', false]].forEach(([m, v], k) => govde.append(sik(HARF(k), m, cevaplar[i] === v, sec(v))));
      else {
        const gir = el('input', { className: 'cevap-giris', maxLength: 100, placeholder: 'Cevabını yaz', value: cevaplar[i] || '' });
        gir.addEventListener('input', () => { cevaplar[i] = gir.value; kaydet(); const v = cevapli(i); chip.className = 'chip ' + (v ? 'chip-tamam' : 'chip-bos'); chip.textContent = v ? 'Cevaplandı' : 'Henüz cevaplanmadı'; });
        govde.append(gir);
      }
    }
    const son = i === odev.sorular.length - 1;
    kutu.replaceChildren(geriDugme(), gezinti(),
      el('section', { className: 'quiz-kart' },
        el('div', { className: 'quiz-baslik' }, el('h2', { textContent: `Soru ${i + 1}` }), isaretDugme),
        el('div', { className: 'quiz-chipler' }, chip, el('span', { className: 'chip', textContent: `${odev.sorular.length} sorudan ${i + 1}.` })),
        govde,
        el('div', { className: 'quiz-alt' },
          el('button', { type: 'button', className: 'buton ikincil', textContent: 'Önceki sayfa', disabled: i === 0, onclick: () => soruGoster(i - 1) }),
          el('button', { type: 'button', className: 'oyun-buton', textContent: son ? 'Bitir ve gözden geçir' : 'Sonraki sayfa', onclick: () => (son ? ozet() : soruGoster(i + 1)) }))));
    if (i + 1 < odev.sorular.length && odev.sorular[i + 1].tur === 'gorsel' && !gorseller[odev.sorular[i + 1].gid]) {
      api('/gorsel?id=' + odev.sorular[i + 1].gid).then((v) => { gorseller[odev.sorular[i + 1].gid] = v.veri; }).catch(() => {}); // sıradaki görseli önceden indir
    }
  }

  function ozet() {
    const bos = odev.sorular.filter((_, i) => !cevapli(i)).length;
    const tablo = el('div', { className: 'ozet-liste' });
    odev.sorular.forEach((_, i) => tablo.append(el('button', { type: 'button', className: 'ozet-satir', onclick: () => soruGoster(i) },
      el('span', { textContent: `Soru ${i + 1}` }),
      el('span', { className: cevapli(i) ? 'chip chip-tamam' : 'chip chip-bos', textContent: cevapli(i) ? 'Cevaplandı' : 'Cevaplanmadı' }),
      isaretli[i] ? el('span', { className: 'chip chip-isaret', textContent: 'İşaretli' }) : '')));
    const mesaj = el('p', { className: 'mesaj' });
    kutu.replaceChildren(geriDugme(), gezinti(), el('section', { className: 'quiz-kart' },
      el('h2', { textContent: 'Gözden geçir' }),
      el('p', { className: bos ? 'mesaj' : 'soluk', textContent: bos ? `${bos} soru cevapsız. İstersen soruya tıklayıp dönebilirsin.` : 'Tüm sorular cevaplandı.' }),
      tablo, mesaj,
      el('div', { className: 'quiz-alt' },
        el('button', { type: 'button', className: 'buton ikincil', textContent: 'Sorulara dön', onclick: () => soruGoster(odev.sorular.length - 1) }),
        el('button', { type: 'button', className: 'oyun-buton', textContent: 'Ödevi gönder', onclick: async (e) => {
          if (bos && !confirm(`${bos} soru cevapsız. Yine de göndermek istiyor musun? Gönderdikten sonra değiştiremezsin.`)) return;
          if (!bos && !confirm('Ödev gönderilsin mi? Gönderdikten sonra değiştiremezsin.')) return;
          e.target.disabled = true;
          try {
            await api('/teslim', { atama: id, cevaplar: odev.sorular.map((_, i) => (cevapli(i) ? cevaplar[i] : null)) });
            try { localStorage.removeItem(ANAHTAR); } catch (er) { /* sorun değil */ }
            bitti();
          } catch (er) { mesaj.textContent = er.message; e.target.disabled = false; }
        } }))));
  }

  function bitti() {
    kutu.replaceChildren(geriDugme(), el('section', { className: 'quiz-kart' },
      el('h2', { textContent: 'Ödevin gönderildi' }),
      el('p', { textContent: 'Öğretmenin cevaplarını kontrol edecek. Bu sürede ödevinin durumu “Kontrol aşamasında” olarak görünür; onaylanınca “✓ Tamamlandı” yazar.' }),
      el('a', { className: 'oyun-buton bagli', href: 'odevlerim.html', textContent: 'Ödevlerime dön' })));
  }

  (async () => {
    try {
      const { odevler } = await api('/odevlerim');
      odev = odevler.find((o) => o.id === id);
      if (!odev) { kutu.replaceChildren(geriDugme(), el('p', { textContent: 'Bu ödev bulunamadı.' })); return; }
      if (odev.durum !== 'bekliyor') {
        kutu.replaceChildren(geriDugme(), el('h1', { textContent: odev.baslik }),
          el('p', { className: 'quiz-bilgi', textContent: odev.durum === 'kontrol' ? 'Bu ödev gönderildi, öğretmenin kontrolünü bekliyor.' : '✓ Bu ödev tamamlandı.' }));
        return;
      }
      try { const k = JSON.parse(localStorage.getItem(ANAHTAR)); if (k) { cevaplar = k.cevaplar || []; isaretli = k.isaretli || []; } } catch (e) { /* kayıt yok */ }
      giris();
    } catch (e) { kutu.textContent = e.message; }
  })();
})();
