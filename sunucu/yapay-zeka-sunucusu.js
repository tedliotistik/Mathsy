// =========================================
// YAPAY ZEKÂ SUNUCUSU (Cloudflare Worker)
// API anahtarı sadece burada, gizli değişken (Secret) olarak durur; tarayıcıya hiç gitmez.
//
// Cloudflare'de iki değişken tanımlanır:
//   ANTHROPIC_API_KEY  (tür: Secret) → Anthropic Console'dan aldığın anahtar
//   IZINLI_SITE        (tür: Text)   → siteni açan adresler, virgülle ayrılmış
//                                      örn: https://mathsy.net,https://www.mathsy.net
// =========================================

const SISTEM = `Sen bir matematik formül asistanısın. Kullanıcı bir formül ya da konu yazar.
Türkçe, kısa ve doğru cevap ver:
- Formülün adı (tek satır)
- Formülün kendisi: LaTeX ile, $$ ... $$ içinde
- Değişkenlerin ne anlama geldiği (kısa)
- İstersen çok kısa bir örnek
Markdown başlığı, kalın yazı ya da tablo kullanma; düz metin ve LaTeX kullan.
Matematikle ilgisiz sorulara "Ben sadece matematik formülleriyle ilgili yardımcı olabilirim." diye cevap ver.`;

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

    const yanit = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-5-5', // daha güçlü model için değiştirebilirsin
        max_tokens: 600,
        system: SISTEM,
        messages: [{ role: 'user', content: soru }],
      }),
    });

    const veri = await yanit.json();
    const cevap = (veri.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    return new Response(JSON.stringify({ cevap }), {
      status: yanit.ok ? 200 : 502,
      headers: { ...cors, 'content-type': 'application/json' },
    });
  },
};
