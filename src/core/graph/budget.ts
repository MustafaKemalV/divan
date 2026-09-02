// Bütçe tavanı (DESIGN §5 olay-tetikli dönüş a). Kritik ayrım: soru "tavan AŞILDI mı" değil,
// "bu faz koşarsa tavan AŞILACAK mı". Kontrol her pahalı fazın girişinde yapılır; faz başlamadan
// Şah'a dönülür, yani tavan gerçekten tavandır. Saf fonksiyon, izole test edilir.

import type { DivanStateType } from "./state.ts";

export function isOverBudget(
  state: Pick<DivanStateType, "callCount" | "maxCalls">,
  nextCost: number,
): boolean {
  return state.callCount + nextCost > state.maxCalls;
}
