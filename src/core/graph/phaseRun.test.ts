// Faz içi koşum birim testi (DESIGN §7). Node native TS ile:
//   node src/core/graph/phaseRun.test.ts
// Bekçi görevleri: (a) kanonik sıra, tamamlanma sırası bozulsa bile; (b) eksik ses sessiz
// geçilmez, tek yeniden deneme yapılır; (c) zaman aşımı bir başarısızlıktır.

import assert from "node:assert";
import { runPhaseSeats, withTimeout, SeatTimeoutError } from "./phaseRun.ts";
import type { SeatRunInput } from "./seatRunner.ts";

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

// 6) İPTAL (M2-A3 T4-3, U-9). Zaman aşımı bugüne kadar yalnız BEKLEMEYİ bırakıyordu; istek
//    arka planda koşmaya devam ediyor, geç cevabı tampona düşüyor ve deneme numarasını bozuyordu.
//    7 Eylül koşumunda tam olarak bu oldu: terk edilen istek kesilerek döndü, $0.015950
//    faturalandı ve iki deneme de "deneme 1" diye kaydedildi.
//
//    GEREKÇE-KANITI: önce iptalsiz halin tamponu bozduğu gösterilir, sonra iptalin düzelttiği.
{
  /**
   * Graf'taki `run` sarmalayıcısının modeli, GERÇEK ZİNCİR DERİNLİĞİYLE.
   *
   * Derinlik burada süs değil, bulgunun kendisi: gerçek zincir `run -> callModel -> chatRaw ->
   * fetch`. İptal en dipte reddedince hata yukarı katman katman çıkar ve başarısız kayıt tampona
   * birkaç microtask SONRA düşer. `runPhaseSeats` o arada ikinci denemeyi başlatmış olur, ikinci
   * deneme de numarasını tampondan sayar ve kendini yine birinci sanır. Tek katmanlı bir sahte
   * runner bunu gizler: hata bir microtask'ta döner, kayıt zamanında düşer ve numara doğru görünür.
   */
  function tamponluRun(iptalDinlensinMi: boolean, numarayiCagirandanAl = true) {
    const tampon: { seatId: string; phase: string; attempt: number; gec?: boolean }[] = [];
    let cagriNo = 0;

    // En dip katman: fetch. İptal sinyalini burası dinler, tıpkı gerçeğinde olduğu gibi.
    const fetchSim = (inp: SeatRunInput) =>
      new Promise<string>((cozum, red) => {
        const t = setTimeout(() => cozum("gec gelen cevap"), 120);
        if (iptalDinlensinMi) {
          inp.signal?.addEventListener("abort", () => {
            clearTimeout(t);
            red(new Error("istek iptal edildi"));
          });
        }
      });
    // Ara katman: callModel. Hata buradan geçerek yukarı çıkar.
    const callModelSim = async (inp: SeatRunInput) => {
      const ham = await fetchSim(inp);
      return { content: ham };
    };

    const run = async (seatId: string, inp: SeatRunInput) => {
      // ESKI hesap: numarayı TAMPONDAN say. YENI hesap: çağıranın söylediği numarayı kullan.
      const tampondan = tampon.filter((b) => b.seatId === seatId && b.phase === inp.phase).length + 1;
      const attempt = numarayiCagirandanAl ? (inp.attempt ?? tampondan) : tampondan;
      const benimNoum = ++cagriNo;
      if (benimNoum === 1) {
        try {
          const out = await callModelSim(inp);
          tampon.push({ seatId, phase: inp.phase, attempt, gec: true });
          return out;
        } catch (e) {
          tampon.push({ seatId, phase: inp.phase, attempt });
          throw e;
        }
      }
      tampon.push({ seatId, phase: inp.phase, attempt });
      return { content: "ikinci deneme" };
    };
    return { run, tampon };
  }

  // KIRMIZI 1: iptal dinlenmiyor -> geç cevap tampona düşüyor.
  // KIRMIZI 2: numara TAMPONDAN sayılıyor -> gerçek zincir derinliğinde iki kayıt da "deneme 1".
  {
    const { run, tampon } = tamponluRun(false, false);
    const outcomes = await runPhaseSeats(run, ["auditor"], input, 20);
    assert.strictEqual(outcomes[0].out?.content, "ikinci deneme", "ikinci deneme donmeli");
    await sleep(180); // terk edilen istek arka planda bitsin
    assert.strictEqual(tampon.length, 2, "terk edilen istek yine de tampona dustu");
    assert.ok(tampon.some((b) => b.gec), "gec cevap tampona dustu (kirmizinin kendisi)");
    assert.deepStrictEqual(
      tampon.map((b) => b.attempt).sort(),
      [1, 1],
      "tampondan sayinca iki deneme de 'deneme 1' oluyor (C-3'un kendisi)",
    );
  }

  // YEŞİL: iptal dinleniyor. İlk istek zaman aşımında DÜŞER, tamponu hemen yazar, ikinci deneme
  // kendini ikinci sayar ve geç cevap diye bir şey kalmaz.
  {
    const { run, tampon } = tamponluRun(true);
    const outcomes = await runPhaseSeats(run, ["auditor"], input, 20);
    assert.strictEqual(outcomes[0].out?.content, "ikinci deneme");
    await sleep(180);
    assert.strictEqual(tampon.length, 2, "iki deneme de kayitli (basarisiz deneme de bir cagridir)");
    assert.ok(!tampon.some((b) => b.gec), "iptal edilen istegin gec cevabi tampona DUSMEZ");
    assert.deepStrictEqual(
      tampon.map((b) => b.attempt).sort(),
      [1, 2],
      "cagiran soyleyince numaralar dogru: bir birinci, bir ikinci deneme",
    );
  }
}

// 7) withTimeout iptal sinyalini tetikler: sure dolunca istek de iptal edilir, yalnız beklemekle
//    kalmaz. İptal edilmeyen bir istek parayı harcamaya devam eder.
{
  const kontrol = new AbortController();
  await assert.rejects(() => withTimeout(sleep(100), 10, "t", () => kontrol.abort()), SeatTimeoutError);
  assert.strictEqual(kontrol.signal.aborted, true, "zaman asimi istegi IPTAL etmeli");
}

console.log("PHASE_RUN_TEST_OK: kanonik sira (tamamlanma bozulsa da) + tek yeniden deneme + koltuk sustu + zaman asimi + IPTAL (gec cevap tampona dusmez)");
