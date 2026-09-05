// Faz özeti kotası (DESIGN §6, beyan bütünlüğü). Saf fonksiyonlar, izole test edilir.
//
// Neden var: fazlar arası taşınan tek şey BD'nin özetidir. Özete girmeyen bir görüş, sonraki
// fazlar için hiç var olmamıştır. Bu, muhalefeti gömmenin en sessiz yoludur, çünkü kimse bir şey
// silmez; sadece özetlemez. Kota bunu yapısal olarak imkansızlaştırır: konuşan her koltuk için
// en az bir madde zorunludur.
//
// Baş Danışman yorumlar, sıralar, ağırlıklandırır. Yok edemez.

export interface SummaryPoint {
  seatId: string;
  point: string;
}

export interface SummaryOutput {
  summary: string;
  points: SummaryPoint[];
}

export type SummaryCheck =
  | { ok: true; value: SummaryOutput }
  | { ok: false; reason: string };

/** Susan koltuk kotadan muaftır: olmayan bir katkı özetlenemez. */
export const SILENT_MARK = "[KOLTUK SUSTU";

/** O fazda gerçekten KONUŞMUŞ koltuklar (susanlar hariç), kanonik sırada ve tekrarsız. */
export function speakingSeats(
  entries: readonly { phase: string; seatId: string; content: string }[],
  phasePrefix: string,
): string[] {
  const out: string[] = [];
  for (const e of entries) {
    if (!e.phase.startsWith(phasePrefix)) continue;
    if (e.content.startsWith(SILENT_MARK)) continue;
    if (!out.includes(e.seatId)) out.push(e.seatId);
  }
  return out;
}

export function validateSummary(data: unknown, expectedSeats: readonly string[]): SummaryCheck {
  if (!data || typeof data !== "object") return { ok: false, reason: "özet çıktısı şemaya uymadı" };
  const d = data as Record<string, unknown>;

  const summary = typeof d.summary === "string" ? d.summary.trim() : "";
  if (!summary) return { ok: false, reason: "özet metni boş" };

  if (!Array.isArray(d.points)) return { ok: false, reason: "özet maddeleri yok" };
  const points: SummaryPoint[] = [];
  for (const raw of d.points) {
    const pRaw = raw as Record<string, unknown>;
    if (typeof pRaw?.seatId !== "string" || typeof pRaw?.point !== "string" || !pRaw.point.trim()) {
      return { ok: false, reason: "özet maddesi koltuk kimliği veya içerik taşımıyor" };
    }
    points.push({ seatId: pRaw.seatId, point: pRaw.point });
  }

  // KOTA: konuşan her koltuk en az bir maddeyle temsil edilmeli.
  const kapsanan = new Set(points.map((p) => p.seatId));
  const eksik = expectedSeats.filter((s) => !kapsanan.has(s));
  if (eksik.length > 0) {
    return {
      ok: false,
      reason: `özet kotası karşılanmadı: ${eksik.join(", ")} koltuğunun katkısı özete girmemiş (§6 özet kotası)`,
    };
  }

  return { ok: true, value: { summary, points } };
}

/**
 * İleri taşınan metin: KİMLİKSİZ (§6.1). Kota denetlenebilirlik için koltuk etiketi ister,
 * anonimlik kuralı ise sonraki fazların kimlik görmemesini ister; ikisi çelişmez çünkü etiket
 * KAYITTA kalır, taşınan metinde kalmaz.
 *
 * Etiketi kaldırmak TEK BAŞINA yetmez: özetin metni de "Vizyoner şunu dedi" diyebilir. Bu yüzden
 * bilinen koltuk adları metin içinde de maskelenir. Kalan risk (dolaylı tanıma: üslup, konu,
 * "önceki turda ben demiştim" gibi imalar) M2-C anonimleştirme katmanının işidir ve envanterde
 * borç olarak durur.
 */
export function anonymizeSummary(value: SummaryOutput, seatLabels: readonly string[] = []): string {
  const maskele = (metin: string) =>
    seatLabels.reduce((acc, etiket) => {
      if (!etiket) return acc;
      const kacisli = etiket.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // HARF SINIRI. Düz bir arama sözcük içini bozar: "Mimari kararlar" -> "bir koltuki kararlar",
      // "marketing" -> "bir koltuking". JavaScript'in \b sınırı Türkçe harflerde güvenilmez
      // (ı, İ, ş, ğ ASCII sözcük karakteri sayılmaz), bu yüzden Unicode harf/rakam çevresi
      // lookbehind/lookahead ile kontrol edilir.
      //
      // Bilinen sınır: "market" koltuk kimliği aynı zamanda sıradan bir kelime; tek başına geçen
      // bir "market" sözcüğü de maskelenir. Doğru çözüm koltuğa maskelemede kullanılacak ayrı bir
      // ad vermektir ve M2-B "kadro = veri" işine borçtur.
      return acc.replace(new RegExp(`(?<![\\p{L}\\p{N}])${kacisli}(?![\\p{L}\\p{N}])`, "giu"), "bir koltuk");
    }, metin);
  const satirlar = value.points.map((p, i) => `- Görüş ${i + 1}: ${maskele(p.point)}`);
  return [maskele(value.summary), "", ...satirlar].join("\n");
}
