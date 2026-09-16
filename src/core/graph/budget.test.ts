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

// F4'ÜN FAZ MALİYETİ (H-4). `isOverBudget` saf bir karşılaştırmadır; asıl mekanizma ona VERİLEN
// sayıdır. Eksik beyan edilen bir faz maliyeti, kapıyı "aşılacak mı" mantığından "aşıldı mı"
// mantığına düşürür: kapı açılmaz, faz koşar, tavan koşum ORTASINDA aşılır.
//
// GEREKÇE-KANITI: önce topraklama öncesi beyanın (7) fazı geçirdiği, sonra gerçek maliyetin (11)
// durdurduğu gösterilir. Ölçülen gerçek: F4 fazı stub koşumunda 8 çağrı harcıyor (iki sorgu
// üretildi); kap üç sorguya izin verdiği için en kötü hal 11'dir ve kapı en kötü hali beyan eder.
{
  const eskiBeyan = 3 + 1 + 2 + 1; // fizibilite + denetim + savunma + hüküm
  const yeniBeyan = 3 + 1 + 3 + 1 + 2 + 1; // + sorgu turu + kap(3) arama
  assert.strictEqual(eskiBeyan, 7, "eski beyan 7 idi");
  assert.strictEqual(yeniBeyan, 11, "yeni beyan 11");

  // 20 tavanında 10 çağrı koşmuşken: eski beyan fazı GEÇİRİR (10 + 7 = 17), yeni beyan DURDURUR
  // (10 + 11 = 21). Aradaki fark tam olarak topraklamanın dört çağrısı.
  const durum = { callCount: 10, maxCalls: 20 };
  assert.strictEqual(isOverBudget(durum, eskiBeyan), false, "eski beyan fazi geciriyordu (kirmizinin kendisi)");
  assert.strictEqual(isOverBudget(durum, yeniBeyan), true, "gercek maliyet kapiyi acmali");

  // Küçük kurul: sabit 3 idi, gerçek 1 + 1 + kap + 1 + 1 = 7.
  const kucukEski = 3;
  const kucukYeni = 1 + 1 + 3 + 1 + 1;
  const kucukDurum = { callCount: 8, maxCalls: 13 };
  assert.strictEqual(isOverBudget(kucukDurum, kucukEski), false, "kucuk kurulda eski beyan geciriyordu");
  assert.strictEqual(isOverBudget(kucukDurum, kucukYeni), true, "kucuk kurulda gercek maliyet durdurmali");
}

console.log("BUDGET_TEST_OK: asilacak-mi semantigi (sinir, tasma, erken durdurma) + F4 faz maliyeti");
