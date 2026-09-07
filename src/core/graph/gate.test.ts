// Muhafız (M2-A3 T3-3): kapı sözleşmesi. Yazım hatası bir onay yerine geçemez.
//
// GEREKÇE-KANITI: önce sözleşmesiz kabulün (bütçe kapısı dışındaki üç kapının bugüne kadarki
// hali) neyi kabul ettiği gösterilir, sonra sözleşmenin onu reddettiği. Kural bir gün gevşetilmek
// istenirse gerekçesi burada durur.

import assert from "node:assert";
import { cancelReason, contractViolation, matchGateAnswer } from "./gate.ts";

// 1) KIRMIZI: sözleşmesiz kabuller. İkisi de gerçek koddu.
{
  // DENETIM_EKSIK: "iptal" değilse devam. Yazım hatası akışı SÜRDÜRÜYORDU.
  const eskiDenetim = (a: unknown) => (String(a).trim().toLowerCase() === "iptal" ? "abort" : "devam");
  assert.strictEqual(eskiDenetim("devamm"), "devam", "kirmizinin kendisi: yazim hatasi devam sayiliyordu");
  assert.strictEqual(eskiDenetim(""), "devam", "bos yanit bile devam sayiliyordu");

  // HUKUM_EKSIK: "retry" değilse sessizce bitir. SEBEP yazılmıyordu.
  const eskiHukum = (a: unknown) => (String(a).trim().toLowerCase() === "retry" ? "devam" : "abort");
  assert.strictEqual(eskiHukum("abort"), "abort", "taninmayan yanit sessizce bitiriyordu");
}

// 2) YEŞİL: tanınan yanıtlar kanonik hale gelir, tanınmayan null döner.
{
  assert.strictEqual(matchGateAnswer("devam", ["devam", "iptal"]), "devam");
  assert.strictEqual(matchGateAnswer("  IPTAL  ", ["devam", "iptal"]), "iptal", "bosluk ve buyuk harf onemsiz");
  assert.strictEqual(matchGateAnswer("devamm", ["devam", "iptal"]), null, "yazim hatasi ONAY DEGILDIR");
  assert.strictEqual(matchGateAnswer("", ["devam", "iptal"]), null, "bos yanit onay degildir");
  assert.strictEqual(matchGateAnswer(null, ["devam", "iptal"]), null);
  assert.strictEqual(matchGateAnswer("retry", ["retry", "iptal"]), "retry");
  // Bir kapının kabul etmediği kelime, başka kapıda geçerli diye kabul edilmez.
  assert.strictEqual(matchGateAnswer("retry", ["devam", "iptal"]), null, "kapi kendi listesini okur");
}

// 3) Parametreli kabul: "re-table:<düğüm>" ön ekle eşleşir, argüman korunur.
{
  const KABUL = ["devam", "re-table:<düğüm>", "iptal"];
  assert.strictEqual(matchGateAnswer("re-table:f2_ideation", KABUL), "re-table:f2_ideation");
  assert.strictEqual(matchGateAnswer("RE-TABLE:F2_ideation", KABUL), "re-table:f2_ideation");
  // Argümansız hali kabul DEĞİL: hedefsiz bir re-table hangi düğüme döneceğini söylemiyor.
  assert.strictEqual(matchGateAnswer("re-table:", KABUL), null, "hedefsiz re-table kabul edilemez");
  assert.strictEqual(matchGateAnswer("re-table", KABUL), null);
}

// 4) Sebepli duruş metni: ne yazıldığını, neyin kabul edildiğini ve kurtarma yolunu söyler.
{
  const m = contractViolation("HUKUM_EKSIK", "abort", ["retry", "iptal"], "gate_judgment_missing");
  assert.ok(m.includes('"abort"'), "yanit metniyle gorunmeli");
  assert.ok(m.includes("retry | iptal"), "kabul listesi gorunmeli");
  assert.ok(m.includes("gate_judgment_missing"), "kurtarma hedefi dugum adiyla soylenmeli");
  assert.ok(m.includes("kapanmadı"), "oturumun kapanmadigi soylenmeli");

  const c = cancelReason("ERKEN_BRIFING", "blocking_check");
  assert.ok(c.includes("ERKEN_BRIFING") && c.includes("iptal etti"), "iptal sebebi kapiyi adiyla anmali");
  assert.ok(c.includes("blocking_check"), "iptal de kurtarma yolunu soylemeli");
}

console.log("GATE_TEST_OK: taninmayan yanit onay degildir, her durus sebeplidir");
