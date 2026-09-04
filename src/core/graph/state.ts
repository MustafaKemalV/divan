// Divan graf state'i (DESIGN §5 + §7). Annotation = kanal plumbing; reducer'lar üç davranışı
// ayırır: BİRİKEN (transcript append, audit için ham), ÜZERİNE-YAZAN (selectedHmw), SAYAÇ (callCount).
// Bağlam mimarisi (§5): ham transcript state'te durur (audit) ama fazlar arası İLERİ taşınmaz;
// ileriye yalnız token-kapaklı BD faz özetleri (phaseSummaries) gider. Framework-bağımsız.

import { Annotation } from "@langchain/langgraph";

/** Koltuk bazlı sayaçları toplayarak birleştirir (reducer yardımcısı). */
function mergeAdd(prev: Record<string, number>, next: Record<string, number>): Record<string, number> {
  const out = { ...prev };
  for (const [k, v] of Object.entries(next)) out[k] = (out[k] ?? 0) + v;
  return out;
}

export interface TranscriptEntry {
  phase: string;
  seatId: string;
  content: string;
}

/** Şah'ın fikre iliştirdiği ek belge (README, şema, örnek kod). */
export interface Attachment {
  name: string;
  content: string;
}

export interface PhaseSummary {
  phase: string;
  summary: string;
}

// F4 hüküm turu maddesi (DESIGN §6.3/§6.4). blocking + "karsilanmadi" olanlar muhalefet notuna
// Denetçi'nin HAM metniyle girer, hiçbir model yumuşatamaz.
export interface JudgmentItem {
  criterion: string;
  status: "karsilandi" | "kismen" | "karsilanmadi";
  blocking: boolean;
  rawText: string;
}

export const DivanState = Annotation.Root({
  // --- girdi + kapı seçimleri (üzerine yazılır) ---
  idea: Annotation<string>(),
  // bütçe tavanı (config §5'ten; olay-tetikli bütçe dönüşü girdisi)
  maxCalls: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 30,
  }),
  // F0 triyajı (DESIGN §5): karmaşıklık sınıfı. "small" -> küçük kurul yolu (3 ajan, F1/F3 yok).
  councilMode: Annotation<"full" | "small">({
    reducer: (_prev, next) => next,
    default: () => "full",
  }),
  // Çağrı zaman aşımı (DESIGN §7): config'ten gelir, faz-içi paralelliğin ön koşuludur.
  perCallTimeoutMs: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 120_000,
  }),
  // Özet kotası karşılanmayan fazlar (§6): özet yine taşınır ama EKSİK olduğu görünür kalır.
  summaryIssues: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  // ALTYAPI arızaları (tavan/kesilme gibi): koltuğun şema disiplini siciline YAZILMAZ, ayrı tutulur.
  infraFailures: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  // İki denemede de cevap vermeyen koltuklar, "faz/koltuk" biçiminde. Eksik ses sessiz geçilmez:
  // transkripte "koltuk sustu" olarak yazılır ve Şah'ın görünürlüğüne çıkar.
  silentSeats: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  /**
    * Ek belgeler (DESIGN §5 ek bağlam). TAM METİN yalnız F0 (BD) ve F4'te (değerlendirenler +
    * Denetçi) kullanılır; diğer fazlar `attachmentSummary` üzerinden görür.
    */
  attachments: Annotation<Attachment[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  attachmentSummary: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  hmwOptions: Annotation<string[]>(),
  selectedHmw: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  // F1 Denetçi çerçeve itirazı (üzerine yazılır) + KAPI 2'de Şah'ın onayladığı çerçeve
  frameObjection: Annotation<string>(),
  approvedFrame: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  // F4 hüküm turu: kriter bazlı hüküm + tamamlanma bayrağı (erken-uzlaşı kilidi §6.3 girdisi)
  judgment: Annotation<JudgmentItem[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  judgmentComplete: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),

  // Denetimin mekanik şartları karşılandı mı (§6.3.1: premortem + >=3 etiketli iddia).
  // Eksik denetim sessizce geçmez: bayrak KAPI 3'te ve done olayında görünür.
  auditComplete: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),
  auditIssue: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  // §6 iade semantiği: şema reddi TEK iade hakkı doğurur. Sayaç, iadenin gerçekten bir kez
  // kullanıldığını ve bütçeye yazıldığını görünür kılar.
  auditRetries: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  auditGateAction: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  // BİRİKEN: her hüküm turunun tam çıktısı (§6.4). Son tur `judgment`e yazılır, geçmiş burada
  // durur; revizyonla DÜŞEN itiraz ancak bu iz sayesinde görünür kalabilir.
  judgmentHistory: Annotation<JudgmentItem[][]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  // Bir turda blocking "karsilanmadi" işaretlenip sonraki turda düşen maddeler (§6.4 ham metinle).
  droppedObjections: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  // F4 revizyon/savunma döngüsü (DESIGN §5, mekanik kapanma). revisionRounds = SAYAÇ (koşan tur),
  // prevUnmetCount = bir ÖNCEKİ hüküm turunun blocking "karsilanmadi" sayısı; -1 = henüz ölçüm yok.
  // Döngünün kapanması bu iki sayının karşılaştırmasıyla belirlenir, hiçbir ajanın beyanıyla değil.
  revisionRounds: Annotation<number>({
    reducer: (prev, next) => prev + next,
    default: () => 0,
  }),
  prevUnmetCount: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => -1,
  }),

  // Erken-uzlaşı kilidi (§6.3) ihlali: hüküm turu bir kez yeniden koşturulur (judgmentRetries),
  // ikinci kez de eksikse HUKUM_EKSIK kapısı açılır ve Şah'ın yanıtı buraya yazılır.
  judgmentRetries: Annotation<number>({
    reducer: (prev, next) => prev + next,
    default: () => 0,
  }),
  judgmentGateAction: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  // F5 çıktıları (M1 stub; gerçek içerik M3). dissentNote = blocking "karsilanmadi" ham metni (§6.4).
  rankings: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  dissentNote: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  decision: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  // --- BİRİKEN: ham transcript (audit). Append reducer; ileri taşınmaz, state'te durur. ---
  transcript: Annotation<TranscriptEntry[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // --- İLERİ taşınan tek şey: BD'nin token-kapaklı faz özetleri (append) ---
  phaseSummaries: Annotation<PhaseSummary[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // --- SAYAÇ: maliyet (DESIGN §7). Toplama TAMSAYI nano-USD'de yapılır (para float yaşamaz;
  // maliyet M3'te karar.json'a girecek, orada kayan nokta sürüklenmesi yasak).
  // costUnknownCalls: maliyeti BİLDİRİLMEYEN çağrı sayısı. Tahmin yapılmaz; bilinmeyen, bilinmiyor
  // olarak sayılır (uydurma rakam, rakam olmamasından kötüdür).
  costNanoUsd: Annotation<number>({
    reducer: (prev, next) => prev + next,
    default: () => 0,
  }),
  totalTokens: Annotation<number>({
    reducer: (prev, next) => prev + next,
    default: () => 0,
  }),
  costUnknownCalls: Annotation<number>({
    reducer: (prev, next) => prev + next,
    default: () => 0,
  }),
  // Koltuk bazlı birikim: bütçe kapısındaki KESTİRİM bundan türetilir (koltuk fiyatları 21 kata
  // varan farklar gösteriyor, düz ortalama yanıltır; docs/M2-OLCUMLER.md).
  seatCostNano: Annotation<Record<string, number>>({
    reducer: (prev, next) => mergeAdd(prev, next),
    default: () => ({}),
  }),
  seatCalls: Annotation<Record<string, number>>({
    reducer: (prev, next) => mergeAdd(prev, next),
    default: () => ({}),
  }),
  // Oturum neden bitti: normal akış mı, Şah'ın açık iptali mi (§5 bütçe sözleşmesi).
  endReason: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),

  // --- SAYAÇ: model çağrı sayısı (bütçe tavanı için); add reducer ---
  callCount: Annotation<number>({
    reducer: (prev, next) => prev + next,
    default: () => 0,
  }),
});

export type DivanStateType = typeof DivanState.State;
