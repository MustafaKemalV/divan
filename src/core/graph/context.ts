// Bağlam seçicileri (DESIGN §5). Saf fonksiyonlar, izole test edilir.
//
// İkisi de bir arızadan sonra buraya taşındı: hüküm turu yeniden koşulduğunda aynı faz için
// ikinci bir özet üretiliyor, F5 ilkini okuyor ve BAYAT bilgiyle sıralama yapıyordu; ayrıca
// "F4:" öneki "F4:summary" ile de eşleştiği için Baş Danışman ikinci özet çağrısında KENDİ
// önceki özetini ham bağlam olarak alıyordu.

/**
 * OTURUM ZARFI (DESIGN §5 D-2). Kod tarafından kurulur, her koltuk çağrısına gider ve KAPI 2'den
 * sonra DONAR; onu yalnız re-table değiştirir.
 *
 * Neden var: "bütün müzakere seçilen çerçevede yürür" cümlesi, çerçeve her çağrıya gerçekten
 * gitmedikçe doğru değildi. Ölçüm bunu açıkça gösterdi: F2 ve sonrasındaki 19 ajan çağrısının
 * HİÇBİRİ seçilen HMW'yi görmüyordu; F2 ideatörünün bütün bağlamı Şah'ın kapıya yazdığı iki
 * kelimeydi.
 */
export interface EnvelopeParts {
  ideaSummary?: string;
  selectedHmw?: string | null;
  /** küçük kurul yolunda F1 koşmaz, bu alan hiç doğmaz */
  frameObjection?: string;
  approvedFrame?: string | null;
  attachmentSummary?: string;
}

/**
 * Zarfın o fazda görünen kısmı. Görünürlük kademelidir çünkü zarfın parçaları sırayla doğar:
 * F0 brifingi zarfı ÜRETİR (zarf görmez), HMW turu yalnız fikir özetini görür, F1 özet ve seçilen
 * HMW'yi görür, F2 ve sonrası zarfın tamamını görür.
 */
export function buildEnvelope(parts: EnvelopeParts, phase: string): string {
  if (phase === "F0:briefing") return "";

  // Parçalar sırayla doğar ve bazıları HİÇ doğmayabilir: küçük kurul yolunda F1 koşmaz, yani
  // çerçeve itirazı hiç yazılmaz. Zarf eksik parçayla da kurulabilmeli, çünkü zarfın işi
  // bilinenleri taşımak; bilinmeyeni beklemek değil.
  const metin = (v: string | null | undefined) => (typeof v === "string" ? v.trim() : "");
  const satirlar: string[] = [];
  if (metin(parts.ideaSummary)) satirlar.push(`Fikrin özeti: ${metin(parts.ideaSummary)}`);
  if (metin(parts.attachmentSummary)) satirlar.push(`Ek belgeler: ${metin(parts.attachmentSummary)}`);
  if (phase === "F0:hmw") return satirlar.length ? blok(satirlar) : "";

  if (metin(parts.selectedHmw)) satirlar.push(`Şah'ın seçtiği çerçeve sorusu: ${metin(parts.selectedHmw)}`);
  if (phase === "F1:frame") return satirlar.length ? blok(satirlar) : "";

  if (metin(parts.frameObjection)) satirlar.push(`Denetçi'nin çerçeve itirazı: ${metin(parts.frameObjection)}`);
  if (parts.approvedFrame) satirlar.push(`Şah'ın çerçeve kararı: ${parts.approvedFrame}`);
  return satirlar.length ? blok(satirlar) : "";
}

function blok(satirlar: readonly string[]): string {
  return ["OTURUM ZARFI (bütün müzakere bu çerçevede yürür):", ...satirlar.map((s) => `- ${s}`)].join("\n");
}

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
