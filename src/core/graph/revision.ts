// F4 revizyon/savunma döngüsü (DESIGN §5, "mekanik kapanma"). Denetimden sonra savunma turu
// koşar, ardından hüküm turu YENİDEN alınır; döngünün kapanıp kapanmayacağına hüküm turunun
// ŞEMA çıktısındaki sayılar karar verir.
//
// Neden böyle: kapanmayı Denetçi'ye "itirazlar çözüldü mü" diye sormak, mekanizmayı modelin
// beyanına bağlardı; yağcılık/yumuşama tam da orada sızar. Burada Denetçi'nin hiçbir cümlesi
// kapıyı açamaz, yalnız blocking "karsilanmadi" SAYISI konuşur. Saf fonksiyon, izole test edilir.

import type { DivanStateType, JudgmentItem } from "./state";

/** DESIGN §5: revizyon/savunma en fazla 3 tur. */
export const MAX_REVISION_ROUNDS = 3;

export type RevisionDecision = "f4_revision" | "bd_summary_f4";

/** Muhalefetin ölçüsü: blocking işaretli + "karsilanmadi" madde sayısı (§6.4 kaynağı). */
export function countBlockingUnmet(judgment: JudgmentItem[]): number {
  return judgment.filter((j) => j.blocking && j.status === "karsilanmadi").length;
}

export function revisionLoopRouter(
  state: Pick<DivanStateType, "judgment" | "revisionRounds" | "prevUnmetCount">,
): RevisionDecision {
  const unmet = countBlockingUnmet(state.judgment);
  // 1) blocking muhalefet kalmadı -> döngü amacına ulaştı
  if (unmet === 0) return "bd_summary_f4";
  // 2) tur tavanı (DESIGN: <=3)
  if (state.revisionRounds >= MAX_REVISION_ROUNDS) return "bd_summary_f4";
  // 3) ilerleme yok: sayı bir önceki tura göre azalmadı -> dönmeye devam etmek çağrı israfı
  if (state.prevUnmetCount >= 0 && unmet >= state.prevUnmetCount) return "bd_summary_f4";
  return "f4_revision";
}
