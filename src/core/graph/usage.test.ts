// Maliyet sayacı birim testi (DESIGN §7). Node native TS ile:
//   node src/core/graph/usage.test.ts
// Bekçi görevi: "bilinmeyen maliyeti tahmin etme" kuralı gevşetilirse burada düşer.

import assert from "node:assert";
import { usageOf } from "./usage.ts";

// 1) bildirilen maliyetler toplanır
const a = usageOf([
  { usage: { totalTokens: 1027, cost: 0.003926 } },
  { usage: { totalTokens: 1505, cost: 0.002648802 } },
]);
// kayan nokta: toplam bit-birebir esit olmayabilir, yakinlik kontrolu yapilir
assert.ok(Math.abs(a.costUsd - 0.006574802) < 1e-12, `beklenen ~0.006574802, gelen ${a.costUsd}`);
assert.strictEqual(a.totalTokens, 2532);
assert.strictEqual(a.costUnknownCalls, 0);

// 2) maliyeti bildirilmeyen çağrı TAHMİN EDİLMEZ, sayılır
const b = usageOf([{ usage: { totalTokens: 900 } }, { usage: { totalTokens: 100, cost: 0.001 } }, {}]);
assert.strictEqual(b.costUsd, 0.001, "bilinmeyen maliyet toplama katilmamali");
assert.strictEqual(b.totalTokens, 1000);
assert.strictEqual(b.costUnknownCalls, 2, "iki cagrinin maliyeti bilinmiyor olarak sayilmali");

// 3) cost 0 ile cost yok AYRI şeylerdir (bedava çağrı bilinmeyen değildir)
const c = usageOf([{ usage: { cost: 0 } }]);
assert.strictEqual(c.costUnknownCalls, 0, "cost=0 bildirilmis bir degerdir, bilinmeyen degil");

// 4) boş koşum
const d = usageOf([]);
assert.deepStrictEqual(d, { costUsd: 0, totalTokens: 0, costUnknownCalls: 0 });

console.log("USAGE_TEST_OK: bildirilen toplanir + bilinmeyen tahmin edilmez, sayilir + cost=0 bilinmeyen degil");
