// =========================================
// YAPAY ZEKÂ SUNUCUSU (Cloudflare Worker örneği)
// API anahtarın tarayıcıya ASLA yazılmaz; sadece burada, gizli değişken olarak durur.
// Kurulum (Cloudflare Workers'ta):
//   1) Yeni Worker oluştur, bu kodu yapıştır.
//   2) Settings > Variables bölümünde gizli (secret) değişken ekle:
//        ANTHROPIC_API_KEY = (Anthropic Console'dan aldığın anahtar)
//      ve normal değişken:
//        IZINLI_SITE = https://siteadresin.com   (sadece senin sitenin kullanması için)
//   3) Worker'ın adresini formuller.js içindeki AI_ADRESI satırına yaz.
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
    const cors = {
      'Access-Control-Allow-Origin': env.IZINLI_SITE || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('Sadece POST', { status: 405, headers: cors });

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
