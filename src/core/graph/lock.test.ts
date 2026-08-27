// Erken-uzlaşı kilidi birim testi (DESIGN §6.3). Node native TS ile koşar:
//   node src/core/graph/lock.test.ts
// Kilidin hem izin (hüküm tam + blocking listeli) hem BLOK (tamamlanmamış / listelenmemiş) dallarını
// doğrular. Router saf fonksiyon; canlı akışta tetiklenemeyen blok dalı burada kanıtlanır.

import assert from "node:assert";
import { earlyConsensusLockRouter } from "./lock.ts";

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

// 1) hüküm turu tamam + blocking listeli -> F5 açılır
assert.strictEqual(
  earlyConsensusLockRouter({ judgmentComplete: true, judgment: [blockingItem] }),
  "f5_ranking",
);
// 2) hüküm turu tamamlanmadı -> F5 BLOKLU
assert.strictEqual(
  earlyConsensusLockRouter({ judgmentComplete: false, judgment: [okItem] }),
  "judgment_incomplete",
);
// 3) hüküm turu boş (blocking listelenmemiş) -> F5 BLOKLU
assert.strictEqual(
  earlyConsensusLockRouter({ judgmentComplete: true, judgment: [] }),
  "judgment_incomplete",
);

console.log("LOCK_TEST_OK: izin (tam+listeli) + blok (tamamlanmamis) + blok (listelenmemis)");
