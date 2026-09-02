// Maliyet sayacı birim testi (DESIGN §7). Node native TS ile:
//   node src/core/graph/usage.test.ts
// İki bekçi görevi: "bilinmeyen maliyeti tahmin etme" ve "para float olarak yaşamaz"
// kurallarından biri gevşetilirse burada düşer.

import assert from "node:assert";
import { usageOf, toNanoUsd, formatUsd, NANO_PER_USD } from "./usage.ts";

// 1) bildirilen maliyetler TAMSAYI nano-USD'de toplanır, bit-birebir
const a = usageOf([
  { usage: { totalTokens: 1027, cost: 0.003926 } },
  { usage: { totalTokens: 1505, cost: 0.002648802 } },
]);
assert.strictEqual(a.costNanoUsd, 3_926_000 + 2_648_802);
assert.strictEqual(a.totalTokens, 2532);
assert.strictEqual(a.costUnknownCalls, 0);
assert.strictEqual(formatUsd(a.costNanoUsd), "0.006575");

// 2) SÜRÜKLENME YOK: float toplama sapar, tamsayı toplama sapmaz.
//    (Bu iki satır kuralın gerekçesidir; klasik 0.1+0.2 örneği.)
assert.notStrictEqual(0.1 + 0.2, 0.3);
const drift = usageOf([{ usage: { cost: 0.1 } }, { usage: { cost: 0.2 } }]);
assert.strictEqual(drift.costNanoUsd, toNanoUsd(0.3), "tamsayi toplama surumlemeli DEGIL");
assert.strictEqual(formatUsd(drift.costNanoUsd, 1), "0.3");

// 3) maliyeti bildirilmeyen çağrı TAHMİN EDİLMEZ, sayılır
const b = usageOf([{ usage: { totalTokens: 900 } }, { usage: { totalTokens: 100, cost: 0.001 } }, {}]);
assert.strictEqual(b.costNanoUsd, 1_000_000, "bilinmeyen maliyet toplama katilmamali");
assert.strictEqual(b.totalTokens, 1000);
assert.strictEqual(b.costUnknownCalls, 2, "iki cagrinin maliyeti bilinmiyor olarak sayilmali");

// 4) cost 0 ile cost yok AYRI şeylerdir (bedava çağrı bilinmeyen değildir)
assert.strictEqual(usageOf([{ usage: { cost: 0 } }]).costUnknownCalls, 0);

// 5) boş koşum
assert.deepStrictEqual(usageOf([]), { costNanoUsd: 0, totalTokens: 0, costUnknownCalls: 0 });

// 6) dönüşüm tek noktada ve tersinir
assert.strictEqual(toNanoUsd(1), NANO_PER_USD);
assert.strictEqual(formatUsd(NANO_PER_USD, 2), "1.00");

console.log("USAGE_TEST_OK: tamsayi nano-USD (surukleme yok) + bilinmeyen tahmin edilmez + cost=0 bilinmeyen degil");
