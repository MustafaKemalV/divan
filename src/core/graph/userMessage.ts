// Kullanıcı mesajının kuruluşu (DESIGN §7 D-1, §5 D-2). Saf ve MÜHÜRSÜZ: `server-only` taşımaz,
// çünkü sağlayıcıya bağlı hiçbir işi yok. Buraya taşınmasının sebebi de bu: fonksiyon
// `openrouterRunner` içindeyken bir birim testi onu import EDEMİYORDU, zincir `gateway` üzerinden
// `server-only` mührüne çarpıyordu. Kuruluşu doğrulanamayan bir sıra, kuralı olmayan bir sıradır.
//
// M2-C-5 (Şah kararı 2026-09-12, SEÇENEK A) ile SABİT katmanlar SİSTEM mesajına taşındı. Burada
// kalan tek şey DİNAMİK BAĞLAM, yani D-1'in (4). katmanı:
//
//   1. EK BELGE tam metni   yalnız izinli fazlarda (F0 BD, F4); §5 bütçe bilinçli enjeksiyon
//   2. BAĞLAM               önceki faz özeti ya da faz içi metin
//   3. konuşan koltuklar, revizyon turu, yeniden koşum
//
// Zarf, fikir ve ek ÖZETİ artık sistem mesajındadır (`requestBuilder.buildSystemContent`).
// Gerekçe ölçümdür: eski sırada bir koltuğun fazları arasındaki ortak ön ek yalnız kimlik
// metniydi ve önbellek eşiğinin altında kalıyordu. Yeni sırada ön ek kimlik + zarf + fikir + ek
// özetidir ve ancak faz talimatında ayrışır.

import type { SeatRunInput } from "./seatRunner.ts";

/**
 * SİSTEM mesajının sabit orta bloğu: oturum zarfı + fikir + ek belgelerin ÖZETİ. Bir koltuğun
 * bütün fazlarında birebir aynıdır; önbelleklenebilir ön ekin gövdesi budur.
 *
 * Ek belgelerin TAM METNİ buraya girmez: yalnız izinli fazlara gider (§5) ve fazdan fazda
 * değişir, yani ön eki bozar. Özet her fazda aynıdır.
 */
export function buildSystemEnvelope(input: SeatRunInput): string {
  const parts: string[] = [];
  if (input.envelope?.trim()) parts.push(input.envelope.trim());
  parts.push(`FİKİR:\n${input.idea}`);
  if (input.attachmentSummary?.trim()) {
    parts.push(`EK BELGELERİN ÖZETİ:\n${input.attachmentSummary.trim()}`);
  }
  return parts.join("\n\n");
}

/** Kullanıcı mesajı: DİNAMİK bağlam (ek tam metni, faz özeti, tur bilgisi). Ham transkript BURADAN geçmez. */
export function buildUserMessage(input: SeatRunInput): string {
  const parts: string[] = [];
  // Ek belgeler: TAM METİN yalnız verildiği fazlarda (DESIGN §5). Fazdan faza değiştiği için
  // dinamik bağlamdadır, sistem mesajındaki sabit ön ekin parçası değildir.
  for (const ek of input.attachments ?? []) {
    parts.push(`EK BELGE (${ek.name}):\n${ek.content}`);
  }
  if (input.context && input.context.trim()) {
    parts.push(`BAĞLAM (önceki fazın özeti veya bu faz içi metin):\n${input.context.trim()}`);
  }
  if (input.seats?.length) parts.push(`BU FAZDA KONUŞAN KOLTUKLAR: ${input.seats.join(", ")}`);
  if (input.round && input.round > 0) parts.push(`REVİZYON TURU: ${input.round}`);
  if (input.retry && input.retry > 0) parts.push(`YENİDEN KOŞUM: ${input.retry}`);
  return parts.join("\n\n");
}
