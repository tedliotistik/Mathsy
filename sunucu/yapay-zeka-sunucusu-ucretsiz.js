// =========================================
// ÜCRETSİZ YAPAY ZEKÂ SUNUCUSU (Cloudflare Worker + Workers AI)
// Anthropic hesabı, API anahtarı ve kredi kartı GEREKMEZ.
// Cloudflare'in ücretsiz günlük kotası içinde çalışır; kota dolarsa o gün arama çalışmaz,
// ücretli plana geçmediğin sürece para çekilmez.
//
// Kurulum:
//   1) Worker'ın Settings → Bindings bölümünden "Workers AI" bağlantısı ekle, adı: AI
//   2) Settings → Variables and Secrets bölümünden bir Text değişkeni ekle:
//        IZINLI_SITE = siteni açan adresler, virgülle ayrılmış
//        örn: https://mathsy.net,https://www.mathsy.net
// =========================================

// Sırayla denenir: ilki hata verirse (ya da kaldırılırsa) bir sonrakine geçilir.
// Güncel model adları için Cloudflare panelinde Workers AI → Models sayfasına bak.
const MODELLER = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.1-8b-instruct',
];

const SISTEM = `Sen bir matematik formül asistanısın. Kullanıcı bir formül ya da konu yazar.
Türkçe, kısa ve doğru cevap ver:
- Formülün adı (tek satır)
- Formülün kendisi: LaTeX ile, $$ ... $$ içinde
- Değişkenlerin ne anlama geldiği (kısa)
- İstersen çok kısa bir örnek
Markdown başlığı, kalın yazı ya da tablo kullanma; düz metin ve LaTeX kullan.
Emin olmadığın formülü uydurma, bilmiyorsan bunu açıkça söyle.
Matematikle ilgisiz sorulara "Ben sadece matematik formülleriyle ilgili yardımcı olabilirim." diye cevap ver.`;

async function yanitAl(env, soru) {
  for (const model of MODELLER) {
    try {
      const sonuc = await env.AI.run(model, {
        messages: [
          { role: 'system', content: SISTEM },
          { role: 'user', content: soru },
        ],
        max_tokens: 600,
      });
      // Modele göre yanıt iki biçimden birinde gelir
      const metin = sonuc.response ?? sonuc.choices?.[0]?.message?.content ?? '';
      if (typeof metin === 'string' && metin.trim()) return metin;
    } catch (hata) {
      // sıradaki modeli dene
    }
  }
  return null;
}

export default {
  async fetch(request, env) {
    const izinliler = (env.IZINLI_SITE || '').split(',').map((s) => s.trim()).filter(Boolean);
    const origin = request.headers.get('Origin') || '';
    const izinli = izinliler.length === 0 || izinliler.includes(origin); // liste boşsa herkese açık

    const cors = {
      'Access-Control-Allow-Origin': izinliler.length === 0 ? '*' : (izinli ? origin : izinliler[0]),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('Sadece POST', { status: 405, headers: cors });
    if (!izinli) return new Response(JSON.stringify({ hata: 'Bu adrese izin verilmedi' }), { status: 403, headers: cors });

    let soru;
    try { ({ soru } = await request.json()); } catch { soru = null; }
    if (typeof soru !== 'string' || !soru.trim() || soru.length > 200) {
      return new Response(JSON.stringify({ hata: 'Geçersiz soru' }), { status: 400, headers: cors });
    }

    const cevap = await yanitAl(env, soru);
    if (!cevap) {
      return new Response(JSON.stringify({ hata: 'Yapay zekâ şu an yanıt veremedi' }), {
        status: 502,
        headers: { ...cors, 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ cevap }), {
      status: 200,
      headers: { ...cors, 'content-type': 'application/json' },
    });
  },
};
