// Bağlam seçicileri birim testi (M2-A3 U-6). Node native TS ile:
//   node src/core/graph/context.test.ts
// Bekçi görevi: özet zinciri bir daha kendi kuyruğunu yemesin.

import assert from "node:assert";
import { latestSummary, rawOfPhase, isSummaryRecord } from "./context.ts";

// 1) GEREKÇE-KANITI: hüküm turu yeniden koşunca aynı faz için İKİ özet olur.
//    Kırmızı hal ilkini okuyordu, yani F5 sıralaması geçersizleşmiş bilgiyle yapılıyordu.
const ozetler = [
  { phase: "F2", summary: "F2 ozeti" },
  { phase: "F4", summary: "ILK F4 ozeti (hukum bos gelmeden once)" },
  { phase: "F4", summary: "IKINCI F4 ozeti (yeniden kosumdan sonra)" },
];
assert.strictEqual(latestSummary(ozetler, "F4"), "IKINCI F4 ozeti (yeniden kosumdan sonra)");
assert.notStrictEqual(latestSummary(ozetler, "F4"), ozetler[1].summary, "ilk ozet BAYAT'tir");
assert.strictEqual(latestSummary(ozetler, "F2"), "F2 ozeti");
assert.strictEqual(latestSummary(ozetler, "F3"), "", "olmayan faz bos doner");

// 2) GEREKÇE-KANITI: "F4:" öneki "F4:summary" ile de eşleşiyordu; ikinci özet çağrısında
//    Baş Danışman KENDİ önceki özetini ham bağlam olarak alıyordu.
const kayitlar = [
  { phase: "F4:feasibility", seatId: "engineer1", content: "fizibilite" },
  { phase: "F4:audit", seatId: "auditor", content: "denetim" },
  { phase: "F4:summary", seatId: "chiefAdvisor", content: "BD kendi ozeti" },
  { phase: "F5:ranking", seatId: "market", content: "baska faz" },
];
const ham = rawOfPhase(kayitlar, "F4:");
assert.ok(ham.includes("fizibilite") && ham.includes("denetim"), "faz kayitlari girmeli");
assert.ok(!ham.includes("BD kendi ozeti"), "OZET KAYDI ham baglama girmemeli");
assert.ok(!ham.includes("baska faz"), "baska fazin kaydi girmemeli");

// 3) özet kaydı tanınması
assert.strictEqual(isSummaryRecord("F4:summary"), true);
assert.strictEqual(isSummaryRecord("F2s:summary"), true);
assert.strictEqual(isSummaryRecord("F4:audit"), false);

console.log("CONTEXT_TEST_OK: son ozet okunur (bayat degil) + ozet kaydi ham baglama girmez");
