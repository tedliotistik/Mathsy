// =========================================
// YAPAY ZEKÂ SUNUCUSU (Cloudflare Worker)
// API anahtarı sadece burada, gizli değişken (Secret) olarak durur; tarayıcıya hiç gitmez.
//
// Cloudflare'de iki değişken tanımlanır:
//   ANTHROPIC_API_KEY  (tür: Secret) → Anthropic Console'dan aldığın anahtar
//   IZINLI_SITE        (tür: Text)   → siteni açan adresler, virgülle ayrılmış
//                                      örn: https://mathsy.net,https://www.mathsy.net
// =========================================

const SISTEM = `Sen 5, 6 ve 7. sınıf (MEB müfredatı) öğrencilerine formül anlatan bir matematik yardımcısısın.
Kurallar:
- Türkçe, çok sade ve kısa yaz; 5. sınıf öğrencisi anlayabilmeli.
- Formülü harflerle değil KELİMELERLE yaz. LaTeX içinde \\text{...} kullan. Örnek: $$\\text{Alan} = \\text{taban} \\times \\text{yükseklik}$$
- x, y, z, a, b, c gibi harfleri ve α, θ, σ, Σ gibi Yunan harflerini KULLANMA. Bilinmeyen sayı için □ (kutu) ya da "bilinmeyen sayı" yaz. Toplam için Σ yerine "hepsini topla" de. Açı için "açı" yaz.
- Tek istisna π: sadece çember konusunda kullan ve "yaklaşık 3,14" diye açıkla.
- Cevabın yapısı: 1) Formülün adı (tek satır). 2) Formül ($$ ... $$ içinde, kelimelerle). 3) "Nasıl kullanılır?" başlığıyla 2-3 kısa cümle. 4) Küçük sayılarla bir örnek.
- Konu 5-7. sınıf müfredatından çok ileriyse (türev, trigonometri, logaritma gibi) "Bu konu 5-7. sınıfta yok, ileride göreceksin." de ve varsa daha basit önceki halini anlat.
- Markdown başlığı, kalın yazı ya da tablo kullanma. Emin olmadığın formülü uydurma.
- Matematikle ilgisiz sorulara "Ben sadece matematik formülleriyle ilgili yardımcı olabilirim." diye cevap ver.`;

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
