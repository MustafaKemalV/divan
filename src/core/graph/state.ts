// Divan graf state'i (DESIGN §5 + §7). Annotation = kanal plumbing; reducer'lar üç davranışı
// ayırır: BİRİKEN (transcript append, audit için ham), ÜZERİNE-YAZAN (selectedHmw), SAYAÇ (callCount).
// Bağlam mimarisi (§5): ham transcript state'te durur (audit) ama fazlar arası İLERİ taşınmaz;
// ileriye yalnız token-kapaklı BD faz özetleri (phaseSummaries) gider. Framework-bağımsız.

import { Annotation } from "@langchain/langgraph";

export interface TranscriptEntry {
  phase: string;
  seatId: string;
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

  // --- SAYAÇ: model çağrı sayısı (bütçe tavanı için); add reducer ---
  callCount: Annotation<number>({
    reducer: (prev, next) => prev + next,
    default: () => 0,
  }),
});

export type DivanStateType = typeof DivanState.State;
