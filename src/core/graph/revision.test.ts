// F4 revizyon/savunma döngüsü birim testi (DESIGN §5 "mekanik kapanma"). Node native TS ile:
//   node src/core/graph/revision.test.ts
// Döngünün üç kapanma koşulunu ve devam dalını doğrular. Kritik nokta: kapanma kararı SAYILARA
// bağlı; hiçbir ajan beyanı ("çözüldü") girdi değil.

import assert from "node:assert";
import { revisionLoopRouter, countBlockingUnmet, MAX_REVISION_ROUNDS } from "./revision.ts";

const unmetBlocking = {
  criterion: "birim ekonomisi",
  status: "karsilanmadi" as const,
  blocking: true,
  rawText: "karşılanmadı, blocking",
};
const unmetNonBlocking = {
  criterion: "farklılaşma",
  status: "karsilanmadi" as const,
  blocking: false,
  rawText: "karşılanmadı ama blocking değil",
};
const resolved = {
  criterion: "birim ekonomisi",
  status: "kismen" as const,
  blocking: true,
  rawText: "kısmen karşılandı",
};

// sayım: yalnız blocking + karsilanmadi sayılır
assert.strictEqual(countBlockingUnmet([unmetBlocking, unmetNonBlocking, resolved]), 1);
assert.strictEqual(countBlockingUnmet([unmetNonBlocking, resolved]), 0);

// 1) blocking muhalefet kalmadı -> döngü kapanır
assert.strictEqual(
  revisionLoopRouter({ judgment: [resolved], revisionRounds: 1, prevUnmetCount: -1 }),
  "bd_summary_f4",
);
// 2) muhalefet var, ilk ölçüm (prevUnmetCount = -1) -> bir tur daha savunma
assert.strictEqual(
  revisionLoopRouter({ judgment: [unmetBlocking], revisionRounds: 1, prevUnmetCount: -1 }),
  "f4_revision",
);
// 3) muhalefet azaldı (2 -> 1) -> ilerleme var, döngü devam
assert.strictEqual(
  revisionLoopRouter({ judgment: [unmetBlocking], revisionRounds: 1, prevUnmetCount: 2 }),
  "f4_revision",
);
// 4) muhalefet azalmadı (1 -> 1) -> ilerleme yok, döngü kapanır (çağrı israfı engellenir)
assert.strictEqual(
  revisionLoopRouter({ judgment: [unmetBlocking], revisionRounds: 1, prevUnmetCount: 1 }),
  "bd_summary_f4",
);
// 5) tur tavanı doldu (DESIGN: <=3) -> kapanır, muhalefet dursa bile
assert.strictEqual(
  revisionLoopRouter({
    judgment: [unmetBlocking],
    revisionRounds: MAX_REVISION_ROUNDS,
    prevUnmetCount: 99,
  }),
  "bd_summary_f4",
);

console.log("REVISION_TEST_OK: sayim + kapanis(cozuldu/ilerleme-yok/tur-tavani) + devam(ilk olcum, azalma)");
