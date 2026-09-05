// Bağlam seçicileri birim testi (M2-A3 U-6). Node native TS ile:
//   node src/core/graph/context.test.ts
// Bekçi görevi: özet zinciri bir daha kendi kuyruğunu yemesin.

import assert from "node:assert";
import { buildEnvelope, latestSummary, rawOfPhase, isSummaryRecord } from "./context.ts";

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

// 4) OTURUM ZARFI (M2-A3 U-4). GEREKÇE-KANITI: zarf yokken F2 ve sonrasındaki 19 ajan
//    çağrısının HİÇBİRİ seçilen HMW'yi görmüyordu; ideatörün bütün bağlamı Şah'ın kapıya
//    yazdığı iki kelimeydi. "Bütün müzakere o çerçevede yürür" cümlesi yapısal değildi.
{
  const parcalar = {
    ideaSummary: "fikrin ozeti",
    selectedHmw: "HMW-3: nasil test ederiz?",
    frameObjection: "cerceve gomulu varsayim tasiyor",
    approvedFrame: "Sah: onaylandi",
    attachmentSummary: "README ozeti",
  };
  // F0 brifingi zarfı ÜRETİR, görmez.
  assert.strictEqual(buildEnvelope(parcalar, "F0:briefing"), "");

  // Görünürlük kademeli: parçalar sırayla doğar.
  const hmwTuru = buildEnvelope(parcalar, "F0:hmw");
  assert.ok(hmwTuru.includes("fikrin ozeti"));
  assert.ok(!hmwTuru.includes("HMW-3"), "HMW turu kendi urettigi HMW'yi gormemeli");

  const f1 = buildEnvelope(parcalar, "F1:frame");
  assert.ok(f1.includes("HMW-3"), "F1 secilen cerceveyi gormeli");
  assert.ok(!f1.includes("gomulu varsayim"), "F1 kendi uretecegi itirazi gormemeli");

  const f2 = buildEnvelope(parcalar, "F2:idea");
  for (const beklenen of ["fikrin ozeti", "HMW-3", "gomulu varsayim", "Sah: onaylandi", "README ozeti"]) {
    assert.ok(f2.includes(beklenen), `F2 zarfinda eksik: ${beklenen}`);
  }
  // Zarf KISA ve SABİTTİR: ham transkript taşımaz, bağlam sıkıştırmasını delmez.
  assert.ok(!f2.includes("koltuk:"), "zarf ham transkript tasimamali");
}

// 5) KÜÇÜK KURUL yolu: F1 hiç koşmaz, çerçeve itirazı hiç doğmaz. Zarf yine de kurulmalı.
//    (Kırmızı hal: varsayılansız kanal undefined kalıyor ve zarf kurulumu düğümü düşürüyordu.)
{
  const eksik = buildEnvelope({ ideaSummary: "ozet", selectedHmw: "HMW-1", approvedFrame: null }, "F2s:idea");
  assert.ok(eksik.includes("ozet") && eksik.includes("HMW-1"));
  assert.ok(!eksik.includes("Denetçi"), "olmayan itiraz zarfa girmemeli");
  assert.doesNotThrow(() => buildEnvelope({}, "F5:ranking"), "bos parcalarla da kurulabilmeli");
  assert.strictEqual(buildEnvelope({}, "F5:ranking"), "", "hicbir parca yoksa zarf bos doner");
}

console.log("CONTEXT_TEST_OK: son ozet okunur (bayat degil) + ozet kaydi ham baglama girmez + oturum zarfi kademeli");
