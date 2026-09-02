// Faz maliyeti kestirimi birim testi. Node native TS ile:
//   node src/core/graph/estimate.test.ts
// Bekçi görevi: "gözlemsiz koltuk için tahmin üretme" kuralı gevşetilirse burada düşer.

import assert from "node:assert";
import { estimatePhaseCost } from "./estimate.ts";

const costs = { visionary: 4_000_000, engineer1: 1_000_000 }; // toplam nano-USD
const calls = { visionary: 2, engineer1: 4 }; // ortalama: 2_000_000 ve 250_000

// 1) gözlenen koltuklar ortalamalarıyla toplanır
const a = estimatePhaseCost(["visionary", "engineer1"], costs, calls);
assert.strictEqual(a.nanoUsd, 2_000_000 + 250_000);
assert.strictEqual(a.observedSeats, 2);
assert.strictEqual(a.unobservedSeats, 0);

// 2) GEREKÇE-KANITI: koltuk bazlı kestirim ile düz ortalama AYNI SONUCU VERMEZ.
//    Düz ortalama (toplam/çağrı = 5.000.000/6 = 833.333) iki koltuk için 1.666.666 derdi;
//    gerçek dağılım 2.250.000. Fiyat farkı büyükse düz ortalama yanıltır, kural bu yüzden var.
const duzOrtalama = Math.round((4_000_000 + 1_000_000) / (2 + 4)) * 2;
assert.notStrictEqual(a.nanoUsd, duzOrtalama, "koltuk bazli kestirim duz ortalamadan ayrismali");

// 3) hiç konuşmamış koltuk için TAHMİN ÜRETİLMEZ, ayrıca sayılır
const b = estimatePhaseCost(["visionary", "auditor"], costs, calls);
assert.strictEqual(b.nanoUsd, 2_000_000, "gozlemsiz koltuk icin tahmin eklenmemeli");
assert.strictEqual(b.observedSeats, 1);
assert.strictEqual(b.unobservedSeats, 1, "gozlemsizlik gorunur olmali");

// 4) maliyeti bildirilmemiş koltuk (çağrı var, maliyet yok) gözlemsiz sayılır
const c = estimatePhaseCost(["market"], {}, { market: 3 });
assert.strictEqual(c.nanoUsd, 0);
assert.strictEqual(c.unobservedSeats, 1);

// 5) boş faz
assert.deepStrictEqual(estimatePhaseCost([], costs, calls), {
  nanoUsd: 0,
  observedSeats: 0,
  unobservedSeats: 0,
});

console.log("ESTIMATE_TEST_OK: koltuk bazli kestirim + gozlemsiz koltuk tahmin edilmez, sayilir");
