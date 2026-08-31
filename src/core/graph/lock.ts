// Erken-uzlaşı kilidi (DESIGN §6.3): hüküm turu TAMAMLANMADAN ve blocking maddeler
// LİSTELENMEDEN F5'e geçilemez. Bu bir GRAF kenar koşuludur (koşullu kenar router'ı), promptta
// rica DEĞİL. Ayrı dosya + saf fonksiyon: hem grafta kullanılır hem izole test edilir.
// Yalnız state tipine bağlıdır (type-only import) -> sıfır runtime bağımlılık.
//
// Kilit tetiklendiğinde oturum SESSİZCE BİTMEZ (DESIGN §5 olay-tetikli dönüş c): hüküm turu bir
// kez yeniden koşturulur, ikinci kez de eksikse HUKUM_EKSIK kapısıyla Şah'a çıkılır.

import type { DivanStateType } from "./state";

export type LockDecision =
  | "f5_ranking" // izin: tam kurul sıralamasına geç
  | "f5s_ranking" // izin: küçük kurul sıralamasına geç
  | "judgment_retry" // blok, 1. kez: hüküm turunu yeniden koştur
  | "gate_judgment_missing"; // blok, 2. kez: Şah'a çık

/** Kilit tek koşulda açılır: hüküm turu tamamlandı VE en az bir madde listelendi. */
export function isJudgmentComplete(
  state: Pick<DivanStateType, "judgmentComplete" | "judgment">,
): boolean {
  return state.judgmentComplete === true && state.judgment.length > 0;
}

export function earlyConsensusLockRouter(
  state: Pick<DivanStateType, "judgmentComplete" | "judgment" | "councilMode" | "judgmentRetries">,
): LockDecision {
  if (isJudgmentComplete(state)) {
    return state.councilMode === "small" ? "f5s_ranking" : "f5_ranking";
  }
  // Blok dalı: önce bir kez yeniden dene, sonra Şah'a çık. END'e sessizce düşmek YASAK.
  return state.judgmentRetries < 1 ? "judgment_retry" : "gate_judgment_missing";
}
