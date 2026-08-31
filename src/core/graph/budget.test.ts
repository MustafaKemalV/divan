// Bütçe kapısı birim testi (DESIGN §5 dönüş a). Node native TS ile:
//   node src/core/graph/budget.test.ts

import assert from "node:assert";
import { isOverBudget } from "./budget.ts";

// tam sığıyor -> geçer (13 + 6 = 19 <= 20)
assert.strictEqual(isOverBudget({ callCount: 13, maxCalls: 20 }, 6), false);
// bir çağrı taşıyor -> faz BAŞLAMADAN durur (13 + 8 = 21 > 20)
assert.strictEqual(isOverBudget({ callCount: 13, maxCalls: 20 }, 8), true);
// sınır: tavana tam oturmak taşma değildir
assert.strictEqual(isOverBudget({ callCount: 24, maxCalls: 30 }, 6), false);
assert.strictEqual(isOverBudget({ callCount: 25, maxCalls: 30 }, 6), true);
// "aşıldı mı" mantığı olsaydı bu geçerdi; "aşılacak mı" mantığı durduruyor
assert.strictEqual(isOverBudget({ callCount: 3, maxCalls: 5 }, 4), true);

console.log("BUDGET_TEST_OK: asilacak-mi semantigi (sinir, tasma, erken durdurma)");
