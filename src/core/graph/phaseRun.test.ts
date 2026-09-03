// Faz içi koşum birim testi (DESIGN §7). Node native TS ile:
//   node src/core/graph/phaseRun.test.ts
// Bekçi görevleri: (a) kanonik sıra, tamamlanma sırası bozulsa bile; (b) eksik ses sessiz
// geçilmez, tek yeniden deneme yapılır; (c) zaman aşımı bir başarısızlıktır.

import assert from "node:assert";
import { runPhaseSeats, withTimeout, SeatTimeoutError } from "./phaseRun.ts";

const seats = ["visionary", "market", "engineer1", "architect"];
const input = () => ({ phase: "F2:idea", idea: "x" });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 1) GEREKÇE-KANITI: tamamlanma sırası BİLEREK ters çevrilir, çıktı yine de kanonik sırada gelir.
{
  const bitisSirasi: string[] = [];
  const gecikme: Record<string, number> = { visionary: 40, market: 30, engineer1: 20, architect: 5 };
  const run = async (seatId: string) => {
    await sleep(gecikme[seatId]);
    bitisSirasi.push(seatId);
    return { content: `${seatId} cikti` };
  };
  const outcomes = await runPhaseSeats(run, seats, input, 1000);
  assert.deepStrictEqual(bitisSirasi, ["architect", "engineer1", "market", "visionary"], "tamamlanma sirasi ters olmali");
  assert.deepStrictEqual(
    outcomes.map((o) => o.seatId),
    seats,
    "tamamlanma sirasi ters olsa da cikti KANONIK sirada olmali",
  );
  assert.ok(outcomes.every((o) => !o.silent && o.attempts === 1));
}

// 2) Eksik ses: ilk deneme düşer, İKİNCİ deneme tutar (tek yeniden deneme hakkı)
{
  let denemeler = 0;
  const run = async (seatId: string) => {
    denemeler += 1;
    if (seatId === "market" && denemeler <= 2) throw new Error("gecici ariza");
    return { content: `${seatId} cikti` };
  };
  const outcomes = await runPhaseSeats(run, ["visionary", "market"], input, 1000);
  const market = outcomes.find((o) => o.seatId === "market");
  assert.strictEqual(market?.silent, false, "ikinci denemede donen koltuk susmus sayilmaz");
  assert.strictEqual(market?.attempts, 2, "tam bir yeniden deneme hakki kullanilmali");
}

// 3) İki denemede de gelmezse KOLTUK SUSTU: sessiz geçilmez, işaretlenir
{
  const run = async (seatId: string) => {
    if (seatId === "auditor") throw new Error("kalici ariza");
    return { content: "ok" };
  };
  const outcomes = await runPhaseSeats(run, ["visionary", "auditor"], input, 1000);
  const auditor = outcomes.find((o) => o.seatId === "auditor");
  assert.strictEqual(auditor?.silent, true, "cevapsiz koltuk sustu olarak isaretlenmeli");
  assert.strictEqual(auditor?.attempts, 2);
  assert.strictEqual(auditor?.out, undefined, "susan koltuktan cikti UYDURULMAZ");
  assert.ok(String(auditor?.reason).includes("kalici ariza"), "sebep tasinmali");
}

// 4) Zaman aşımı bir başarısızlıktır (asılı üye asılı oturum demektir)
{
  const run = async () => {
    await sleep(200);
    return { content: "gec geldi" };
  };
  const outcomes = await runPhaseSeats(run, ["visionary"], input, 20);
  assert.strictEqual(outcomes[0].silent, true, "zaman asimi susma olarak sonuclanmali");
  assert.ok(String(outcomes[0].reason).includes("zaman aşımı"));
}

// 5) withTimeout: süre içinde dönen söz aynen geçer
assert.strictEqual(await withTimeout(Promise.resolve(7), 50, "t"), 7);
await assert.rejects(() => withTimeout(sleep(100), 10, "t"), SeatTimeoutError);

console.log("PHASE_RUN_TEST_OK: kanonik sira (tamamlanma bozulsa da) + tek yeniden deneme + koltuk sustu + zaman asimi");
