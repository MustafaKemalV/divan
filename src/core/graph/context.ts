// Bağlam seçicileri (DESIGN §5). Saf fonksiyonlar, izole test edilir.
//
// İkisi de bir arızadan sonra buraya taşındı: hüküm turu yeniden koşulduğunda aynı faz için
// ikinci bir özet üretiliyor, F5 ilkini okuyor ve BAYAT bilgiyle sıralama yapıyordu; ayrıca
// "F4:" öneki "F4:summary" ile de eşleştiği için Baş Danışman ikinci özet çağrısında KENDİ
// önceki özetini ham bağlam olarak alıyordu.

export interface TranscriptLike {
  phase: string;
  seatId: string;
  content: string;
}

export interface SummaryLike {
  phase: string;
  summary: string;
}

/** Bir faz kaydı özet kaydı mı? Özet kaydı hiçbir zaman özet GİRDİSİ olmaz. */
export function isSummaryRecord(phase: string): boolean {
  return phase.endsWith(":summary");
}

/**
 * O fazın SON özeti. İlkini okumak, hüküm turu yeniden koşulduğunda geçersizleşmiş bir özeti
 * ileri taşımak demektir.
 *
 * `phaseSummaries` append kanalı olarak KALIYOR (üzerine yazan bir yapıya çevrilmedi), çünkü
 * özetin kaç kez ve neden yeniden üretildiği denetim değeri taşıyan bir izdir; üzerine yazmak
 * o izi siler ve "özet iki kez üretilmiş" bilgisi kaybolur.
 */
export function latestSummary(summaries: readonly SummaryLike[], phase: string): string {
  for (let i = summaries.length - 1; i >= 0; i--) {
    if (summaries[i].phase === phase) return summaries[i].summary;
  }
  return "";
}

/** Bir fazın ham metni: "koltuk: içerik" satırları. Özet kayıtları DIŞLANIR. */
export function rawOfPhase(entries: readonly TranscriptLike[], phasePrefix: string): string {
  return entries
    .filter((t) => t.phase.startsWith(phasePrefix) && !isSummaryRecord(t.phase))
    .map((t) => `${t.seatId}: ${t.content}`)
    .join("\n");
}
