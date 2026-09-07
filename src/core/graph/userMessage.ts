// Kullanıcı mesajının kuruluşu (DESIGN §7 D-1, §5 D-2). Saf ve MÜHÜRSÜZ: `server-only` taşımaz,
// çünkü sağlayıcıya bağlı hiçbir işi yok. Buraya taşınmasının sebebi de bu: fonksiyon
// `openrouterRunner` içindeyken bir birim testi onu import EDEMİYORDU, zincir `gateway` üzerinden
// `server-only` mührüne çarpıyordu. Kuruluşu doğrulanamayan bir sıra, kuralı olmayan bir sıradır.
//
// Sıra sabittir ve SABİTTEN OYNAĞA doğrudur:
//
//   1. OTURUM ZARFI   her çağrıda aynı, KAPI 2'den sonra donar (D-2)
//   2. FİKİR          oturum boyunca değişmez
//   3. EK BELGE       tam metin yalnız izinli fazlarda, diğerlerinde özeti (§5)
//   4. BAĞLAM         her çağrıda değişen tek blok (önceki faz özeti, tur bilgisi)
//
// Sıranın iki gerekçesi var. Birincisi tasarım: "bütün müzakere seçilen çerçevede yürür" cümlesi,
// çerçeve modelin okuduğu İLK şey olmadıkça bir temenni olarak kalır. İkincisi ölçüm: sabit
// katmanlar başta durursa sağlayıcı önbelleği onları yakalayabilir (§7); etkisi tahmin edilmez,
// çağrı kaydındaki `cachedTokens` ile ölçülür.

import type { SeatRunInput } from "./seatRunner.ts";

/** Kullanıcı mesajı: zarf + fikir + ek (tam metin ya da özet) + dinamik bağlam. Ham transkript BURADAN geçmez. */
export function buildUserMessage(input: SeatRunInput): string {
  const parts: string[] = [];
  // OTURUM ZARFI ilk blok: çerçeve her çağrıya gider (DESIGN §5 D-2).
  if (input.envelope?.trim()) parts.push(input.envelope.trim());
  parts.push(`FİKİR:\n${input.idea}`);
  // Ek belgeler: TAM METİN yalnız verildiği fazlarda; diğer fazlar özet görür (DESIGN §5).
  for (const ek of input.attachments ?? []) {
    parts.push(`EK BELGE (${ek.name}):\n${ek.content}`);
  }
  if (!input.attachments?.length && input.attachmentSummary?.trim()) {
    parts.push(`EK BELGELERİN ÖZETİ:\n${input.attachmentSummary.trim()}`);
  }
  if (input.context && input.context.trim()) {
    parts.push(`BAĞLAM (önceki fazın özeti veya bu faz içi metin):\n${input.context.trim()}`);
  }
  if (input.seats?.length) parts.push(`BU FAZDA KONUŞAN KOLTUKLAR: ${input.seats.join(", ")}`);
  if (input.round && input.round > 0) parts.push(`REVİZYON TURU: ${input.round}`);
  if (input.retry && input.retry > 0) parts.push(`YENİDEN KOŞUM: ${input.retry}`);
  return parts.join("\n\n");
}
