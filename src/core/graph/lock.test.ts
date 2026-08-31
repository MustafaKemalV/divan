// Erken-uzlaşı kilidi birim testi (DESIGN §6.3 + §5 olay-tetikli dönüş c). Node native TS ile:
//   node src/core/graph/lock.test.ts
// Kilidin dört dalını da doğrular: izin (tam kurul), izin (küçük kurul), blok-1 (yeniden koşum),
// blok-2 (Şah kapısı). Canlı akışta zor tetiklenen blok dalları burada kanıtlanır.

import assert from "node:assert";
import { earlyConsensusLockRouter, isJudgmentComplete } from "./lock.ts";

const blockingItem = {
  criterion: "birim ekonomisi",
  status: "karsilanmadi" as const,
  blocking: true,
  rawText: "karşılanmadı, blocking",
};
const okItem = {
  criterion: "fizibilite",
  status: "karsilandi" as const,
  blocking: false,
  rawText: "makul",
};

// 1) hüküm turu tamam + blocking listeli -> F5 açılır (tam kurul)
assert.strictEqual(
  earlyConsensusLockRouter({
    judgmentComplete: true,
    judgment: [blockingItem],
    councilMode: "full",
    judgmentRetries: 0,
  }),
  "f5_ranking",
);
// 2) aynı koşul, küçük kurul -> küçük kurul sıralamasına gider
assert.strictEqual(
  earlyConsensusLockRouter({
    judgmentComplete: true,
    judgment: [okItem],
    councilMode: "small",
    judgmentRetries: 0,
  }),
  "f5s_ranking",
);
// 3) hüküm turu tamamlanmadı, ilk kez -> F5 BLOKLU, hüküm turu yeniden koşar
assert.strictEqual(
  earlyConsensusLockRouter({
    judgmentComplete: false,
    judgment: [okItem],
    councilMode: "full",
    judgmentRetries: 0,
  }),
  "judgment_retry",
);
// 4) hüküm turu boş (madde listelenmemiş), ilk kez -> yeniden koşum
assert.strictEqual(
  earlyConsensusLockRouter({
    judgmentComplete: true,
    judgment: [],
    councilMode: "full",
    judgmentRetries: 0,
  }),
  "judgment_retry",
);
// 5) yeniden koşumdan sonra hâlâ eksik -> SESSİZ BİTİŞ YOK, Şah kapısı açılır
assert.strictEqual(
  earlyConsensusLockRouter({
    judgmentComplete: true,
    judgment: [],
    councilMode: "small",
    judgmentRetries: 1,
  }),
  "gate_judgment_missing",
);
// 6) yardımcı: kilit yalnız iki koşul birlikte sağlanınca açılır
assert.strictEqual(isJudgmentComplete({ judgmentComplete: true, judgment: [okItem] }), true);
assert.strictEqual(isJudgmentComplete({ judgmentComplete: true, judgment: [] }), false);
assert.strictEqual(isJudgmentComplete({ judgmentComplete: false, judgment: [okItem] }), false);

console.log("LOCK_TEST_OK: izin(tam) + izin(kucuk) + blok1(retry x2) + blok2(Sah kapisi) + yardimci");
