// Erken-uzlaşı kilidi (DESIGN §6.3): hüküm turu TAMAMLANMADAN ve blocking maddeler
// LİSTELENMEDEN F5'e geçilemez. Bu bir GRAF kenar koşuludur (koşullu kenar router'ı), promptta
// rica DEĞİL. Ayrı dosya + saf fonksiyon: hem grafta kullanılır hem izole test edilir.
// Yalnız state tipine bağlıdır (type-only import) -> sıfır runtime bağımlılık.

import type { DivanStateType } from "./state";

export type LockDecision = "f5_ranking" | "judgment_incomplete";

export function earlyConsensusLockRouter(
  state: Pick<DivanStateType, "judgmentComplete" | "judgment">,
): LockDecision {
  const complete = state.judgmentComplete === true;
  const blockingListed = state.judgment.length > 0; // hüküm turu maddeleri (blocking bayraklı) sayıldı mı
  return complete && blockingListed ? "f5_ranking" : "judgment_incomplete";
}
