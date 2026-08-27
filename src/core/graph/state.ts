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

export const DivanState = Annotation.Root({
  // --- girdi + kapı seçimleri (üzerine yazılır) ---
  idea: Annotation<string>(),
  hmwOptions: Annotation<string[]>(),
  selectedHmw: Annotation<string | null>({
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
