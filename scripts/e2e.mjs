#!/usr/bin/env node
/**
 * Divan M1 uçtan uca kanıt koşusu.
 *
 * Neden var: bir mekaniğin çalıştığını sohbet içinde göstermek kanıt değildir; kanıt REPODA
 * koşulabilir olmalı. Bu dosya M1'in tüm kabul kriterlerini tek komutla yeniden üretir:
 *   npm run e2e
 *
 * Özellikler:
 *  - ANAHTARSIZ: graf StubSeatRunner ile derlenir, hiçbir sağlayıcıya çağrı gitmez, para harcanmaz.
 *    Sunucu OPENROUTER_API_KEY ortam değişkeni SİLİNEREK başlatılır.
 *  - DETERMİNİSTİK: sabit thread id'ler, sıfırdan checkpoint veritabanı, sabit beklenen sayılar.
 *  - Herhangi bir senaryo düşerse çıkış kodu non-zero olur (CI için).
 *
 * Bölümler: 10 senaryo (HTTP + SSE + checkpointer) + bağlam sıkıştırması kanıtı (in-process ölçüm).
 */

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = Number(process.env.E2E_PORT ?? 3131);
const BASE = `http://127.0.0.1:${PORT}`;
const TMP = mkdtempSync(join(tmpdir(), "divan-e2e-"));
const DB = join(TMP, "checkpoints.sqlite");
const CTX_DB = join(TMP, "context.sqlite");

const LONG = "Kurumsal musterilere denetim izi cikaran, cok modelli bir karar konseyi SaaS urunu kurmak";
const SHORT = "Kucuk bir CLI araci";

let server = null;

// ---------------------------------------------------------------- altyapı
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function startServer() {
  const env = {
    ...process.env,
    PORT: String(PORT),
    DIVAN_CHECKPOINT_DB: DB,
    DIVAN_RUNNER: "stub", // sahte koşum AÇIKÇA istenir; varsayılan mod gerçek modellerdir
  };
  delete env.OPENROUTER_API_KEY; // anahtarsız koşum: stub'lar hiçbir sağlayıcıya gitmez
  // AĞ SINIRI (DESIGN §10): yalnız yerel arayüz. Host verilmezse Next bütün arayüzlere
  // bağlanır ve aynı ağdaki herkes /api/council ile Şah'ın anahtarını harcayabilir,
  // GET ile transkript okuyabilir. Anahtar VE harcama yetkisi makineden çıkmaz.
  server = spawn("node_modules/.bin/next", ["dev", "--hostname", "127.0.0.1", "--port", String(PORT)], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", () => {});
  server.stderr.on("data", () => {});
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(BASE, { signal: AbortSignal.timeout(2000) });
      if (r.ok || r.status < 500) return;
    } catch {
      // henüz ayakta değil
    }
    await sleep(500);
  }
  throw new Error(`dev sunucusu ${PORT} portunda ayağa kalkmadı`);
}

async function stopServer() {
  if (!server) return;
  const p = server;
  server = null;
  p.kill("SIGTERM");
  await sleep(700);
}

/** POST /api/council -> SSE olaylarını diziye toplar. */
async function post(body) {
  const res = await fetch(`${BASE}/api/council`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });
  const text = await res.text();
  return text
    .split("\n")
    .filter((l) => l.startsWith("data: "))
    .map((l) => JSON.parse(l.slice(6)));
}

const stopEvent = (ev) => [...ev].reverse().find((e) => ["gate", "done", "error"].includes(e.type));
const nodesOf = (ev) => ev.filter((e) => e.type === "node-update").map((e) => e.node);
const countNode = (ev, name) => nodesOf(ev).filter((n) => n === name).length;

function check(cond, msg) {
  if (!cond) throw new Error(msg);
}

const results = [];
/** casus runner çağrıları; bağlam ölçümü ve prompt kapsamı testi ikisi de bunu okur */
const spyCalls = [];
async function scenario(id, title, fn) {
  console.log(`\n[${id}] ${title}`);
  try {
    await fn();
    results.push({ id, ok: true });
    console.log(`  GECTI`);
  } catch (e) {
    results.push({ id, ok: false, err: e.message });
    console.log(`  DUSTU: ${e.message}`);
  }
}

// ---------------------------------------------------------------- senaryolar
async function run() {
  await startServer();

  // S01: tam kurul uçtan uca, 3 planlı kapı, DESIGN §5 bütçe bandı
  await scenario("S01", "Tam kurul uctan uca (F0-F5, KAPI 1/2/3)", async () => {
    let ev = await post({ threadId: "e2e-s01", idea: LONG });
    let s = stopEvent(ev);
    check(s.gate === "KAPI1", `KAPI1 bekleniyordu: ${s.gate ?? s.type}`);
    check(s.payload.councilMode === "full", "triyaj full olmaliydi");
    check(s.payload.councilModeSource === "model-kanaati", "triyaj KANAAT olarak isaretlenmeli (§5.1 ara donem)");
    check(s.payload.options.length === 5, "tam kurulda 5 HMW bekleniyordu");
    check(nodesOf(ev).join(",") === "f0_briefing,f0_hmw", "F0 iki cagriya ayrilmali (DESIGN §5)");

    s = stopEvent(await post({ threadId: "e2e-s01", resume: s.payload.options[0] }));
    check(s.gate === "KAPI2", `KAPI2 bekleniyordu: ${s.gate ?? s.type}`);

    ev = await post({ threadId: "e2e-s01", resume: "cerceve onaylandi" });
    s = stopEvent(ev);
    check(s.gate === "KAPI3", `KAPI3 bekleniyordu: ${s.gate ?? s.type}`);
    check(nodesOf(ev).includes("f4_revision"), "F4 revizyon turu kosmali");
    check(s.payload.auditComplete === true, "denetim mekanik sartlari tasimaliydi (§6.3.1)");

    s = stopEvent(await post({ threadId: "e2e-s01", resume: "karar: devam" }));
    check(s.type === "done", `done bekleniyordu: ${s.type}`);
    check(s.runnerMode === "stub", `stub kosumu damgalanmali, gelen: ${s.runnerMode}`);
    check(s.metrics.callCount === 27, `27 cagri bekleniyordu, gelen ${s.metrics.callCount}`);
    // Maliyet sayacı: stub sağlayıcı maliyet bildirmez, bu SESSİZ geçilmez.
    check(s.metrics.costNanoUsd === 0, "stub kosumda bildirilmis maliyet olmamali");
    check(s.metrics.costUsd === "0.000000", `maliyet metni bicimlendirilmis gelmeli: ${s.metrics.costUsd}`);
    check(
      s.metrics.costUnknownCalls === s.metrics.callCount,
      `maliyeti bilinmeyen cagri sayisi toplamla esit olmali: ${s.metrics.costUnknownCalls}/${s.metrics.callCount}`,
    );
    console.log(`  kanit: maliyet bilinmeyen ${s.metrics.costUnknownCalls}/${s.metrics.callCount} cagri (stub)`);
    check(s.metrics.callCount >= 26 && s.metrics.callCount <= 28, "DESIGN §5 tipik bant 26-28 disinda");
    console.log(`  kanit: callCount=${s.metrics.callCount}, revizyonTuru=${s.metrics.revisionRounds}`);
  });

  // S02: küçük kurul yolu (F0 triyajı) - F1/F3 ve KAPI2 yok
  await scenario("S02", "Kucuk kurul yolu (triyaj), F1/F3 ve KAPI2 atlanir, Denetci uretimde yok", async () => {
    let ev = await post({ threadId: "e2e-s02", idea: SHORT });
    let s = stopEvent(ev);
    check(s.payload.councilMode === "small", "triyaj small olmaliydi");
    check(s.payload.options.length === 3, "kucuk kurulda 3 HMW bekleniyordu");

    ev = await post({ threadId: "e2e-s02", resume: s.payload.options[0] });
    s = stopEvent(ev);
    check(s.gate === "KAPI3", `kucuk kurulda KAPI2 olmamali, gelen: ${s.gate}`);
    const n = nodesOf(ev);
    check(!n.includes("f1_frame") && !n.includes("f3_cross"), "kucuk kurulda F1/F3 kosmamali");
    check(n.includes("f2s_ideation") && n.includes("f5s_ranking"), "kucuk kurul dugumleri kosmali");

    s = stopEvent(await post({ threadId: "e2e-s02", resume: "karar" }));
    check(s.councilMode === "small", "done olayinda mode small olmali");
    check(s.metrics.callCount === 13, `13 cagri bekleniyordu, gelen ${s.metrics.callCount}`);
    console.log(`  kanit: mode=${s.councilMode}, callCount=${s.metrics.callCount}`);
  });

  // S03: F4 revizyon döngüsü, ısrarcı muhalefet -> mekanik kapanma + erken brifing
  await scenario("S03", "F4 revizyon dongusu (israrci muhalefet) + ERKEN_BRIFING", async () => {
    await post({ threadId: "e2e-s03", idea: `${LONG} [TEST:blocking]` });
    await post({ threadId: "e2e-s03", resume: "hmw" });
    const ev = await post({ threadId: "e2e-s03", resume: "cerceve onaylandi" });
    let s = stopEvent(ev);
    check(s.gate === "ERKEN_BRIFING", `ERKEN_BRIFING bekleniyordu: ${s.gate ?? s.type}`);
    check(countNode(ev, "f4_revision") === 2, "ilerleme durunca dongu 2. turda kapanmaliydi");
    check(countNode(ev, "f4_judgment") === 2, "her revizyon turundan sonra hukum turu kosmali");
    check(String(s.payload.blocking[0]).includes("BLOCKING"), "Denetci ham metni gecmeli");

    s = stopEvent(await post({ threadId: "e2e-s03", resume: "devam" }));
    check(s.gate === "KAPI3", "erken brifing sonrasi KAPI3 gelmeli");
    check(s.payload.dissentNote.includes("BLOCKING"), "muhalefet notu HAM metni tasimali");

    s = stopEvent(await post({ threadId: "e2e-s03", resume: "karar" }));
    check(s.metrics.revisionRounds === 2, `2 tur bekleniyordu, gelen ${s.metrics.revisionRounds}`);
    console.log(`  kanit: revizyonTuru=${s.metrics.revisionRounds}, callCount=${s.metrics.callCount}`);
  });

  // S04: revizyonla düşen itiraz iz bırakır (DESIGN §6.4)
  await scenario("S04", "Revizyonla dusen itiraz iz birakir (§6.4)", async () => {
    await post({ threadId: "e2e-s04", idea: `${LONG} [TEST:drop]` });
    await post({ threadId: "e2e-s04", resume: "hmw" });
    let s = stopEvent(await post({ threadId: "e2e-s04", resume: "cerceve onaylandi" }));
    check(s.gate === "KAPI3", `KAPI3 bekleniyordu: ${s.gate ?? s.type}`);
    check(s.payload.dissentNote === "", "son turda blocking kalmamaliydi");
    check(s.payload.droppedObjections.length === 1, "dusen itiraz izi BOS: muhalefet buharlasti");
    check(s.payload.droppedObjections[0].startsWith("[tur 1]"), "iz hangi turda isaretlendigini tasimali");
    check(s.payload.droppedObjections[0].includes("BLOCKING"), "iz Denetci'nin HAM metnini tasimali");
    console.log(`  kanit: ${s.payload.droppedObjections[0].slice(0, 72)}...`);
  });

  // S05: erken-uzlaşı kilidi, blok dalı 1 -> hüküm turu yeniden koşar
  await scenario("S05", "Erken-uzlasi kilidi: bos hukum -> yeniden kosum", async () => {
    await post({ threadId: "e2e-s05", idea: `${LONG} [TEST:nojudgment]` });
    await post({ threadId: "e2e-s05", resume: "hmw" });
    const ev = await post({ threadId: "e2e-s05", resume: "cerceve onaylandi" });
    let s = stopEvent(ev);
    check(nodesOf(ev).includes("judgment_retry"), "kilit yeniden kosum dali tetiklenmedi");
    check(countNode(ev, "f4_judgment") === 2, "hukum turu bir kez yeniden kosmaliydi");
    check(s.gate === "KAPI3", "yeniden kosum sonrasi F5 acilmaliydi");
    s = stopEvent(await post({ threadId: "e2e-s05", resume: "karar" }));
    check(s.metrics.judgmentRetries === 1, `judgmentRetries 1 bekleniyordu: ${s.metrics.judgmentRetries}`);
    console.log(`  kanit: judgmentRetries=${s.metrics.judgmentRetries}, callCount=${s.metrics.callCount}`);
  });

  // S06: kilit blok dalı 2 -> Şah kapısı, SESSİZ BİTİŞ YOK
  await scenario("S06", "Erken-uzlasi kilidi: HUKUM_EKSIK kapisi (sessiz bitis yok)", async () => {
    await post({ threadId: "e2e-s06", idea: `${LONG} [TEST:nojudgment:always]` });
    await post({ threadId: "e2e-s06", resume: "hmw" });
    let ev = await post({ threadId: "e2e-s06", resume: "cerceve onaylandi" });
    let s = stopEvent(ev);
    check(s.gate === "HUKUM_EKSIK", `HUKUM_EKSIK bekleniyordu: ${s.gate ?? s.type}`);
    check(s.payload.judgmentCount === 0 && s.payload.retries === 1, "kapi payload'i eksik");
    ev = await post({ threadId: "e2e-s06", resume: "abort" });
    s = stopEvent(ev);
    check(s.type === "done", "Sah abort dediginde oturum kapanmali");
    check(!nodesOf(ev).some((n) => n.startsWith("f5")), "kilit acilmadan F5 KOSMAMALI");
    console.log(`  kanit: kapi acildi, F5 kosmadi, oturum Sah kararyla kapandi`);
  });

  // S07: küçük kurulda da blocking muhalefet Şah'a çıkar
  await scenario("S07", "Kucuk kurul + israrci blocking -> ERKEN_BRIFING", async () => {
    let s = stopEvent(await post({ threadId: "e2e-s07", idea: `${SHORT} [TEST:blocking]` }));
    check(s.payload.councilMode === "small", "triyaj small olmaliydi");
    s = stopEvent(await post({ threadId: "e2e-s07", resume: "hmw" }));
    check(s.gate === "ERKEN_BRIFING", `ERKEN_BRIFING bekleniyordu: ${s.gate ?? s.type}`);
    s = stopEvent(await post({ threadId: "e2e-s07", resume: "devam" }));
    check(s.payload.dissentNote.includes("BLOCKING"), "muhalefet notu HAM olmali");
    s = stopEvent(await post({ threadId: "e2e-s07", resume: "karar" }));
    check(s.metrics.callCount === 13, `13 cagri bekleniyordu: ${s.metrics.callCount}`);
    console.log(`  kanit: mode=${s.councilMode}, callCount=${s.metrics.callCount}`);
  });

  // S08: bütçe sözleşmesi -> kapı faz BAŞLAMADAN açılır, "devam" tavanı değiştirmez, sayı yükseltir
  await scenario("S08", "Butce sozlesmesi: kesin+kestirim payload, devam ve sayi", async () => {
    await post({ threadId: "e2e-s08", idea: LONG, maxCalls: 5 });
    await post({ threadId: "e2e-s08", resume: "hmw" });
    let s = stopEvent(await post({ threadId: "e2e-s08", resume: "cerceve onaylandi" }));
    check(s.gate === "BUTCE", `BUTCE bekleniyordu: ${s.gate ?? s.type}`);
    check(s.payload.at === "F2", `kapi F2 girisinde acilmaliydi: ${s.payload.at}`);
    // sözleşme payload'da ilan edilir
    check(
      Array.isArray(s.payload.kabulEdilen) && s.payload.kabulEdilen.includes("iptal"),
      "kabul edilen yanitlar payload'da listelenmeli",
    );
    // kesin ve kestirim AYRI bloklar, kestirim etiketli
    check(s.payload.kesin.kosanCagri === 3 && s.payload.kesin.fazCagriSayisi === 4, "kesin sayilar beklenenden farkli");
    check(
      s.payload.kesin.kosanCagri + s.payload.kesin.fazCagriSayisi > s.payload.kesin.tavan,
      "kapi 'asilacak mi' mantigiyla acilmali",
    );
    check(String(s.payload.kestirim.etiket).includes("KESTİRİM"), "kestirim acikca etiketlenmeli");
    check(s.payload.kestirim.gozlemsizKoltuk === 4, `stub'da hicbir koltuk maliyet bildirmez: ${s.payload.kestirim.gozlemsizKoltuk}`);
    console.log(`  kanit: kesin(${s.payload.kesin.kosanCagri}+${s.payload.kesin.fazCagriSayisi}>${s.payload.kesin.tavan}) | kestirim gozlemsiz ${s.payload.kestirim.gozlemsizKoltuk} koltuk`);
    // "devam" tavani DEGISTIRMEZ: bir sonraki pahali fazda kapi yeniden acilir
    s = stopEvent(await post({ threadId: "e2e-s08", resume: "devam" }));
    check(s.gate === "BUTCE" && s.payload.at === "F3", `devam sonrasi F3'te tekrar sorulmali: ${s.gate}/${s.payload?.at}`);
    check(s.payload.kesin.tavan === 5, `devam tavani degistirmemeli: ${s.payload.kesin.tavan}`);
    // sayi tavani yukseltir ve akis tamamlanir
    s = stopEvent(await post({ threadId: "e2e-s08", resume: 40 }));
    check(s.gate === "KAPI3", "tavan yukseltilince akis tamamlanmaliydi");
    s = stopEvent(await post({ threadId: "e2e-s08", resume: "karar" }));
    check(s.metrics.callCount === 27, `27 cagri bekleniyordu: ${s.metrics.callCount}`);
    console.log(`  kanit: devam -> tavan 5 kaldi, sayi -> 40, toplam ${s.metrics.callCount} cagri`);
  });

  // S14: sözleşme dışı yanıt akışı SÜRDÜRMEZ; "iptal" sebepli bitiş üretir
  await scenario("S14", "Sozlesme disi yanit ve iptal: akis surmez, sebep yazilir", async () => {
    await post({ threadId: "e2e-s14", idea: LONG, maxCalls: 5 });
    await post({ threadId: "e2e-s14", resume: "hmw" });
    let s = stopEvent(await post({ threadId: "e2e-s14", resume: "cerceve onaylandi" }));
    check(s.gate === "BUTCE", `BUTCE bekleniyordu: ${s.gate ?? s.type}`);
    // Yazim hatasi bir onay yerine GECEMEZ: akis surmez, oturum sebebi yazili olarak durur.
    let ev = await post({ threadId: "e2e-s14", resume: "devamm" });
    s = stopEvent(ev);
    check(s.type === "done", `sozlesme disi yanit akisi surdurmemeli: ${s.type}`);
    check(String(s.reason).includes("sözleşmeye uymadı"), `sebep yazili olmali: ${s.reason}`);
    // Düğüm çalışır ama kapı ilk satırda olduğu için HİÇ model çağrısı yapılmaz: sayaç sabit kalır.
    check(s.metrics.callCount === 3, `sozlesme disi yanittan sonra cagri yapilmamali: ${s.metrics.callCount}`);
    console.log(`  kanit (taninmayan): cagri ${s.metrics.callCount}'te durdu | ${s.reason}`);

    // Acik "iptal" de ayni sekilde sebepli bitirir
    await post({ threadId: "e2e-s14b", idea: LONG, maxCalls: 5 });
    await post({ threadId: "e2e-s14b", resume: "hmw" });
    s = stopEvent(await post({ threadId: "e2e-s14b", resume: "cerceve onaylandi" }));
    check(s.gate === "BUTCE", `BUTCE bekleniyordu: ${s.gate ?? s.type}`);
    ev = await post({ threadId: "e2e-s14b", resume: "iptal" });
    s = stopEvent(ev);
    check(s.type === "done", `iptal oturumu bitirmeliydi: ${s.type}`);
    check(String(s.reason).includes("iptal"), `bitis sebebi yazili olmali: ${s.reason}`);
    check(s.metrics.callCount === 3, `iptalden sonra cagri yapilmamali: ${s.metrics.callCount}`);
    console.log(`  kanit (iptal): cagri ${s.metrics.callCount}'te durdu | ${s.reason}`);
  });

  // S16: eksik ses sessiz geçilmez -> iki denemede de cevap vermeyen koltuk işaretlenir
  await scenario("S16", "Koltuk sustu: iki deneme, sonra isaretlenir (sessiz gecilmez)", async () => {
    await post({ threadId: "e2e-s16", idea: `${LONG} [TEST:silent:market]` });
    await post({ threadId: "e2e-s16", resume: "hmw" });
    let s = stopEvent(await post({ threadId: "e2e-s16", resume: "cerceve onaylandi" }));
    check(s.gate === "KAPI3", `KAPI3 bekleniyordu: ${s.gate ?? s.type}`);
    check(
      Array.isArray(s.payload.silentSeats) && s.payload.silentSeats.some((x) => x.endsWith("/market")),
      `susan koltuk karar ekraninda gorunmeli: ${JSON.stringify(s.payload.silentSeats)}`,
    );
    // Susan koltuk F5 siralamasinda YOK: eksik ses uydurulmaz
    check(
      !s.payload.rankings.some((r) => r.startsWith("market:")),
      "susan koltuk icin siralama UYDURULMAMALI",
    );
    s = stopEvent(await post({ threadId: "e2e-s16", resume: "karar" }));
    check(s.silentSeats.length > 0, "done olayinda da susan koltuklar gorunmeli");
    // market F2/F3/F5'te 3 kez cagriliyor, her biri 2 deneme: 27 + 3 ek deneme
    check(s.metrics.callCount === 30, `yeniden denemeler sayaca yazilmali: ${s.metrics.callCount}`);
    // Cevapsiz denemenin maliyeti BILINMIYOR, asla sifir
    check(
      s.metrics.costUnknownCalls === s.metrics.callCount,
      `cevapsiz denemeler de bilinmeyen maliyet sayilmali: ${s.metrics.costUnknownCalls}/${s.metrics.callCount}`,
    );
    console.log(`  kanit: susan=${JSON.stringify(s.silentSeats)} | cagri ${s.metrics.callCount} (3 ek deneme) | bilinmeyen maliyet ${s.metrics.costUnknownCalls}`);
  });

  // S17: özet kotası -> özetleyici bir koltuğu düşüremez (§6 beyan bütünlüğü)
  await scenario("S17", "Ozet kotasi: dusen koltuk yakalanir ve gorunur kalir", async () => {
    await post({ threadId: "e2e-s17", idea: `${LONG} [TEST:ozeteksik]` });
    await post({ threadId: "e2e-s17", resume: "hmw" });
    let s = stopEvent(await post({ threadId: "e2e-s17", resume: "cerceve onaylandi" }));
    check(s.gate === "KAPI3", `KAPI3 bekleniyordu: ${s.gate ?? s.type}`);
    check(
      Array.isArray(s.payload.summaryIssues) && s.payload.summaryIssues.length > 0,
      "dusurulen koltuk ozet kotasinda yakalanmaliydi",
    );
    const ilk = String(s.payload.summaryIssues[0]);
    check(ilk.includes("kotası karşılanmadı"), `sebep kota olmali: ${ilk}`);
    console.log(`  kanit: ${ilk.slice(0, 96)}`);
    s = stopEvent(await post({ threadId: "e2e-s17", resume: "karar" }));
    check(s.summaryIssues.length > 0, "done olayinda da gorunmeli");
  });

  // S18: maliyeti BİLİNEN kesilmiş çağrı "maliyeti bilinmeyen" sayılmamalı (M2-A3 U-7)
  await scenario("S18", "Kesilen cagri cift sayilmaz: bilinen maliyet bilinmeyen olmaz", async () => {
    await post({ threadId: "e2e-s18", idea: `${LONG} [TEST:kesik:market]` });
    await post({ threadId: "e2e-s18", resume: "hmw" });
    let s = stopEvent(await post({ threadId: "e2e-s18", resume: "cerceve onaylandi" }));
    check(s.gate === "KAPI3", `KAPI3 bekleniyordu: ${s.gate ?? s.type}`);
    s = stopEvent(await post({ threadId: "e2e-s18", resume: "karar" }));
    // market F2, F3 ve F5'te cagriliyor; kesilme ALTYAPI arizasi oldugu icin yeniden denenmiyor,
    // yani üç kesilmiş cagri, her birinin maliyeti BILINIYOR (0.01).
    const kesilen = 3;
    check(
      s.metrics.costNanoUsd === kesilen * 10_000_000,
      `kesilen cagrilarin maliyeti toplama girmeli: ${s.metrics.costNanoUsd}`,
    );
    // Stub'in basarili cagrilarinda usage yok -> onlar bilinmeyen. Kesilenler bilinmeyen DEGIL.
    check(
      s.metrics.costUnknownCalls === s.metrics.callCount - kesilen,
      `maliyeti bilinen ${kesilen} cagri "bilinmeyen" sayilmamali: ` +
        `${s.metrics.costUnknownCalls} bilinmeyen / ${s.metrics.callCount} cagri`,
    );
    console.log(`  kanit: ${s.metrics.callCount} cagri, ${s.metrics.costUnknownCalls} bilinmeyen, $${s.metrics.costUsd}`);
  });

  // S15: KURTARMA ZİNCİRİ. Güvenli duruş bir çıkmaz sokak olmamalı: ihlal -> sebepli duruş ->
  // re-table -> durum ve sayaç intakt -> devam -> tamamlanma.
  await scenario("S15", "Guvenli durus kurtarilabilir: ihlal -> re-table -> tamamlanma", async () => {
    await post({ threadId: "e2e-s15", idea: LONG, maxCalls: 5 });
    await post({ threadId: "e2e-s15", resume: "hmw" });
    let s = stopEvent(await post({ threadId: "e2e-s15", resume: "cerceve onaylandi" }));
    check(s.gate === "BUTCE", `BUTCE bekleniyordu: ${s.gate ?? s.type}`);
    check(String(s.payload.kurtarma).includes("re-table"), "kapi payload'i kurtarma yolunu ilan etmeli");

    // 1) ihlal -> sebepli durus, kurtarma yolu mesajda
    s = stopEvent(await post({ threadId: "e2e-s15", resume: "gecersiz-yanit" }));
    check(s.type === "done", `ihlal akisi durdurmaliydi: ${s.type}`);
    check(String(s.reason).includes("KURTARMA"), `durus mesaji kurtarma yolunu icermeli: ${s.reason}`);
    check(String(s.reason).includes("f2_ideation"), "kurtarma mesaji hedef dugumu adiyla soylemeli");
    const durusCagri = s.metrics.callCount;
    check(durusCagri === 3, `duruşta cagri sayaci 3 olmali: ${durusCagri}`);
    console.log(`  kanit (durus): cagri ${durusCagri} | ${String(s.reason).slice(0, 80)}...`);

    // 2) re-table -> durum ve sayac INTAKT, kapi yeniden aciliyor
    const ev = await post({ threadId: "e2e-s15", reTableToNode: "f2_ideation" });
    s = stopEvent(ev);
    check(s.gate === "BUTCE", `re-table sonrasi kapi yeniden acilmali: ${s.gate ?? s.type}`);
    check(
      s.payload.kesin.kosanCagri === durusCagri,
      `sayac korunmali: duruşta ${durusCagri}, re-table sonrasi ${s.payload.kesin.kosanCagri}`,
    );
    check(s.payload.kesin.tavan === 5, "tavan korunmali");
    console.log(`  kanit (re-table): sayac ${s.payload.kesin.kosanCagri} intakt, kapi yeniden acildi`);

    // 3) devam -> tamamlanma
    s = stopEvent(await post({ threadId: "e2e-s15", resume: 40 }));
    check(s.gate === "KAPI3", `tavan yukseltilince akis surmeli: ${s.gate ?? s.type}`);
    s = stopEvent(await post({ threadId: "e2e-s15", resume: "karar" }));
    check(s.type === "done", "oturum tamamlanmali");
    check(!s.reason, `tamamlanan oturumda durus sebebi olmamali: ${s.reason}`);
    check(s.metrics.callCount === 27, `tam oturum 27 cagri: ${s.metrics.callCount}`);
    console.log(`  kanit (tamamlanma): ${s.metrics.callCount} cagri, durus sebebi yok`);
  });

  // S09: re-table, checkpoint'ten tek-hedefli yeniden koşum
  await scenario("S09", "Re-table: f1_frame checkpoint'ten yeniden kosar", async () => {
    const ev = await post({ threadId: "e2e-s01", reTableToNode: "f1_frame" });
    const n = nodesOf(ev);
    check(n[0] === "f1_frame", `ilk dugum f1_frame olmaliydi: ${n[0]}`);
    const s = stopEvent(ev);
    check(s.gate === "KAPI2", `re-table sonrasi KAPI2 bekleniyordu: ${s.gate ?? s.type}`);
    console.log(`  kanit: ${n.join(" -> ")} | durak ${s.gate}`);
  });

  // S10: SQLite kalıcılığı, sunucu yeniden başlasa bile aynı thread devam eder
  await scenario("S10", "Cross-process resume: sunucu oldurulur, oturum devam eder", async () => {
    let s = stopEvent(await post({ threadId: "e2e-s10", idea: LONG }));
    check(s.gate === "KAPI1", "KAPI1 bekleniyordu");
    await stopServer();
    await startServer();
    s = stopEvent(await post({ threadId: "e2e-s10", resume: "hmw secildi" }));
    check(s.gate === "KAPI2", `yeni process ayni thread'den devam etmeliydi: ${s.gate ?? s.type}`);
    console.log(`  kanit: sunucu yeniden basladi, e2e-s10 KAPI1'den KAPI2'ye devam etti`);
  });

  // S11: zorunlu premortem şema+kodla zorlanır; eksik denetim SESSİZ geçmez
  await scenario("S11", "Premortem'siz denetim EKSIK isaretlenir (§6.3.1)", async () => {
    await post({ threadId: "e2e-s11", idea: `${LONG} [TEST:noaudit]` });
    await post({ threadId: "e2e-s11", resume: "hmw" });
    let s = stopEvent(await post({ threadId: "e2e-s11", resume: "cerceve onaylandi" }));
    // İade semantiği devreye girer: premortemsiz çıktı bir kez iade edilir, yine gelmezse kapı.
    check(s.gate === "DENETIM_EKSIK", `DENETIM_EKSIK kapisi bekleniyordu: ${s.gate ?? s.type}`);
    check(
      String(s.payload.reason).includes("premortem"),
      `eksiklik sebebi premortem olmaliydi: ${s.payload.reason}`,
    );
    check(s.payload.retries === 1, `bir iade hakki kullanilmaliydi: ${s.payload.retries}`);
    console.log(`  kanit: iade sonrasi kapi, sebep: ${s.payload.reason}`);
    s = stopEvent(await post({ threadId: "e2e-s11", resume: "devam" }));
    check(s.gate === "KAPI3", `devam sonrasi KAPI3 bekleniyordu: ${s.gate ?? s.type}`);
    check(s.payload.auditComplete === false, "eksiklik karar ekranina tasinmali");
    s = stopEvent(await post({ threadId: "e2e-s11", resume: "karar" }));
    check(s.metrics.auditComplete === false, "done olayinda da eksiklik gorunmeli");
  });

  // S12: ZİNCİR KANITI (§6 beyan bütünlüğü) -> red -> gerekçeli iade -> yine red -> Şah kapısı -> ham iz
  await scenario("S12", "Rozet reddi zinciri: red -> iade -> DENETIM_EKSIK kapisi", async () => {
    await post({ threadId: "e2e-s12", idea: `${LONG} [TEST:badurl]` });
    await post({ threadId: "e2e-s12", resume: "hmw" });
    let ev = await post({ threadId: "e2e-s12", resume: "cerceve onaylandi" });
    let s = stopEvent(ev);
    check(s.gate === "DENETIM_EKSIK", `DENETIM_EKSIK kapisi bekleniyordu: ${s.gate ?? s.type}`);
    check(String(s.payload.reason).includes("URL'siz"), `sebep §6.2 olmaliydi: ${s.payload.reason}`);
    check(s.payload.retries === 1, `tam BIR iade hakki kullanilmaliydi: ${s.payload.retries}`);
    check(!nodesOf(ev).includes("f4_revision"), "gecersiz denetimle revizyon turuna GECILMEMELI");
    console.log(`  kanit: red -> iade (retries=${s.payload.retries}) -> kapi | sebep: ${s.payload.reason}`);
    // Şah devam derse akış sürer ama eksiklik karar ekranına kadar taşınır
    s = stopEvent(await post({ threadId: "e2e-s12", resume: "devam" }));
    check(s.gate === "KAPI3", `devam sonrasi KAPI3 bekleniyordu: ${s.gate ?? s.type}`);
    check(s.payload.auditComplete === false, "eksiklik karar ekranina tasinmali");
    s = stopEvent(await post({ threadId: "e2e-s12", resume: "karar" }));
    // iade cagrisi butceye yazilir: normal 27 + 1 iade
    check(s.metrics.callCount === 28, `iade cagrisi butceye yazilmaliydi (28): ${s.metrics.callCount}`);
    console.log(`  kanit: iade butcede sayildi, toplam ${s.metrics.callCount} cagri`);
  });

  // S13: iade semantiğinin mutlu yolu -> ilk çıktı reddedilir, İADE turunda düzelir, akış sürer
  await scenario("S13", "Iade turunda duzelen denetim akisi surdurur (§6 iade semantigi)", async () => {
    await post({ threadId: "e2e-s13", idea: `${LONG} [TEST:badurl1]` });
    await post({ threadId: "e2e-s13", resume: "hmw" });
    const ev = await post({ threadId: "e2e-s13", resume: "cerceve onaylandi" });
    const s = stopEvent(ev);
    check(s.gate === "KAPI3", `KAPI3 bekleniyordu: ${s.gate ?? s.type}`);
    check(s.payload.auditComplete === true, "iade turunda duzelen denetim GECERLI sayilmali");
    check(nodesOf(ev).includes("f4_revision"), "denetim gecerli olunca revizyon turu kosmali");
    const done = stopEvent(await post({ threadId: "e2e-s13", resume: "karar" }));
    check(done.metrics.callCount === 28, `iade cagrisi sayilmaliydi (28): ${done.metrics.callCount}`);
    console.log(`  kanit: auditComplete=true, iade dahil ${done.metrics.callCount} cagri`);
  });

  // ------------------------------------------------ çağrı başına kullanım kaydı (M2-A3 U-8)
  // "Sonra ölçeriz" sözünün aleti bu kayıt. Bekçi görevi iki yönlü: kayıt gerçekten tutuluyor mu,
  // ve stub koşumda uydurma sayı üretiliyor mu? Sağlayıcı bildirmediyse alan BOŞ kalmalı.
  console.log(`\n[KANIT] Cagri basina kullanim kaydi: tutuluyor mu, uyduruluyor mu?`);
  try {
    const ev = await post({ threadId: "e2e-calllog", idea: SHORT });
    const kayitlar = ev.flatMap((e) => (e.type === "node-update" ? (e.calls ?? []) : []));
    check(kayitlar.length > 0, "cagri kaydi hic tutulmamis");
    const ornek = kayitlar[0];
    check(typeof ornek.seatId === "string" && typeof ornek.phase === "string", "kayit koltuk ve faz tasimali");
    check(typeof ornek.attempt === "number", "kayit deneme numarasi tasimali");
    // Stub saglayici token bildirmez: alanlar BOS kalmali, sifir ya da uydurma deger DEGIL.
    const uydurma = kayitlar.filter((k) => k.promptTokens !== undefined || k.costNanoUsd !== undefined);
    console.log(`  kayit sayisi: ${kayitlar.length} | ornek: ${ornek.seatId}/${ornek.phase} deneme ${ornek.attempt}`);
    console.log(`  stub'da token/maliyet alani dolduran kayit: ${uydurma.length}`);
    check(uydurma.length === 0, `stub kosumda uydurma deger uretilmis: ${JSON.stringify(uydurma[0] ?? {})}`);
    results.push({ id: "CAGRI-KAYDI", ok: true });
    console.log(`  GECTI`);
  } catch (e) {
    results.push({ id: "CAGRI-KAYDI", ok: false, err: e.message });
    console.log(`  DUSTU: ${e.message}`);
  }


  await stopServer();

  // ------------------------------------------------ bağlam sıkıştırması kanıtı (in-process ölçüm)
  console.log(`\n[KANIT] Baglam sikistirmasi: gec fazlara giden payload'da ham transkript var mi?`);
  try {
    process.env.DIVAN_CHECKPOINT_DB = CTX_DB;
    const { buildCouncilGraph } = await import("../src/core/graph/graph.ts");
    const { StubSeatRunner } = await import("../src/core/graph/seatRunner.ts");
    const { Command } = await import("@langchain/langgraph");

    const calls = spyCalls;
    const inner = new StubSeatRunner();
    const spy = {
      async run(seatId, input) {
        const out = await inner.run(seatId, input);
        calls.push({
          seatId,
          phase: input.phase,
          context: input.context ?? "",
          output: out.content,
          attachments: input.attachments ?? [],
          attachmentSummary: input.attachmentSummary ?? "",
          envelope: input.envelope ?? "",
        });
        return out;
      },
    };

    const graph = buildCouncilGraph(spy);
    const runPath = async (threadId, idea, resumes) => {
      const cfg = { configurable: { thread_id: threadId } };
      const drain = async (input) => {
        for await (const _ of await graph.stream(input, { ...cfg, streamMode: "updates" })) void _;
      };
      await drain({ idea, maxCalls: 100 });
      for (const r of resumes) await drain(new Command({ resume: r }));
    };
    await runPath("e2e-context", LONG, ["hmw", "cerceve", "karar"]);
    const fullCalls = calls.length;
    // Küçük kurul yolu da koşulur: prompt kapsamı iki yolun TAMAMINI kapsamalı.
    await runPath("e2e-context-small", SHORT, ["hmw", "karar"]);
    console.log(`  (olcum: tam kurul ${fullCalls} cagri, kucuk kurul ${calls.length - fullCalls} cagri)`);

    // Kaba token ölçüsü: boşluğa göre parçalama. Gerçek tokenizer bağımlılığı EKLENMEDİ; sayılar
    // "kaba token" olarak etiketlenir, bir sağlayıcının tokenizer'ıyla birebir eşleşme iddiası yoktur.
    const toks = (t) => t.split(/\s+/).filter(Boolean).length;
    const fullOnly = calls.slice(0, fullCalls);
    const rawOf = (phase) => fullOnly.filter((c) => c.phase === phase).map((c) => c.output).join("\n");

    // Her fazın ham çıktısının parmak izi ve o fazdan SONRAKİ fazlar. Fazlar arası taşınan tek şey
    // BD özetidir; bir sonraki fazın ajan çağrısında bu parmak izi görünürse sıkıştırma delinmiş demektir.
    const FINGERPRINTS = [
      { phase: "F2:idea", mark: "[F2:idea ", later: /^F(3|4|5)/ },
      { phase: "F3:cross", mark: "[F3 ", later: /^F(4|5)/ },
      { phase: "F4:feasibility", mark: "[F4:feasibility ", later: /^F5/ },
    ];
    // BD özet düğümleri ham metni GÖRMEK zorundadır (işleri budur); ölçüm ajan çağrıları üzerinde.
    const agentCalls = fullOnly.filter((c) => !c.phase.endsWith(":summary"));
    let totalLeaks = 0;
    for (const fp of FINGERPRINTS) {
      const raw = rawOf(fp.phase);
      const targets = agentCalls.filter((c) => fp.later.test(c.phase));
      const leaks = targets.filter((c) => c.context.includes(fp.mark));
      totalLeaks += leaks.length;
      console.log(
        `  ${fp.phase.padEnd(16)} ham ${String(raw.length).padStart(4)} krk / ~${String(toks(raw)).padStart(3)} token` +
          ` -> sonraki ${String(targets.length).padStart(2)} ajan cagrisinda sizinti: ${leaks.length}`,
      );
      check(raw.length > 0, `${fp.phase} ham metni olusmadi`);
      check(leaks.length === 0, `ham transkript sizdi (${fp.phase}): ${leaks.map((l) => l.phase).join(",")}`);
    }

    // OTURUM ZARFI: F2 ve sonrasındaki her ajan çağrısı çerçeveyi görmeli (M2-A3 U-4).
    const zarfsiz = fullOnly.filter(
      (c) => /^F[2345]/.test(c.phase) && c.seatId !== "chiefAdvisor" && !String(c.envelope ?? "").includes("OTURUM ZARFI"),
    );
    console.log(`  oturum zarfi olmayan gec faz cagrisi: ${zarfsiz.length}`);
    check(zarfsiz.length === 0, `zarfsiz cagri var: ${zarfsiz.map((c) => c.phase).join(",")}`);

    // F5 GİRDİLERİ (M2-A3 U-5): taslak ve final denetim kör yazılıyordu.
    const taslak = fullOnly.find((c) => c.phase === "F5:draft");
    const final = fullOnly.find((c) => c.phase === "F5:output");
    check(Boolean(taslak?.context), "karar taslagi baglamsiz yazilamaz");
    check(taslak.context.includes("Sıralayıcı 1"), "taslak siralamalari gormeli");
    check(taslak.context.includes("MUHALEFET NOTU"), "taslak muhalefet notunu gormeli");
    check(Boolean(final?.context) && final.context.includes("KARAR TASLAĞI"), "final denetim taslagi gormeli");
    // Sıralamalar KİMLİKSİZ verilir (§6.1): kim dedi değil, ne dendi.
    check(
      !/Sıralayıcı \d+: (market|engineer1|architect|auditor)/.test(taslak.context),
      "siralamalarda koltuk kimligi sizmis",
    );
    console.log(`  F5 girdileri: taslak ${taslak.context.length} krk, final ${final.context.length} krk (kimliksiz)`);

    const f2Raw = rawOf("F2:idea");
    const f3Ctx = fullOnly.find((c) => c.phase === "F3:cross")?.context ?? "";
    console.log(`  ileri tasinan baglam (F3 ajan cagrisi): ${f3Ctx.length} krk / ~${toks(f3Ctx)} kaba token`);

    // Faz İÇİ ham taşıma tasarım gereğidir (denetim kendi fazının çıktısını okur); bunu ayrı raporla
    // ki "en buyuk baglam" sayısı fazlar arası sızıntıyla karıştırılmasın.
    const intraPhase = agentCalls.filter((c) => c.phase === "F4:audit" || c.phase === "F4:judgment");
    const maxIntra = Math.max(0, ...intraPhase.map((c) => c.context.length));
    console.log(`  faz ICI ham (F4 denetim/hukum, ayni faz, tasarim geregi): en buyuk ${maxIntra} krk`);

    check(f3Ctx.length < f2Raw.length, "F3 baglami ham transkriptten kucuk olmali");
    check(totalLeaks === 0, "fazlar arasi ham sizinti var");
    results.push({ id: "KANIT", ok: true });
    console.log(`  GECTI (F2 ham -> F3 baglami sikistirma ~${(f2Raw.length / Math.max(1, f3Ctx.length)).toFixed(1)}x, sizinti 0)`);
  } catch (e) {
    results.push({ id: "KANIT", ok: false, err: e.message });
    console.log(`  DUSTU: ${e.message}`);
  }

  // ------------------------------------------------ paralellik determinizmi (in-process)
  // Faz içi paralellikte tamamlanma sırası değişkendir; transkript DEĞİLDİR. Bu kanıt, gecikme
  // işaretiyle tamamlanma sırasını bilerek bozar ve transkriptin kanonik koltuk sırasında
  // kaldığını, aynı girdinin bayt-özdeş transkript ürettiğini gösterir.
  console.log(`\n[KANIT] Paralellik determinizmi: tamamlanma sirasi bozuldugunda transkript ne oluyor?`);
  try {
    const { buildCouncilGraph } = await import("../src/core/graph/graph.ts");
    const { StubSeatRunner } = await import("../src/core/graph/seatRunner.ts");
    const { Command } = await import("@langchain/langgraph");
    const KANONIK = ["visionary", "market", "engineer1", "architect"];

    const kosum = async (threadId, idea) => {
      const graph = buildCouncilGraph(new StubSeatRunner());
      const cfg = { configurable: { thread_id: threadId } };
      const drain = async (input) => {
        for await (const _ of await graph.stream(input, { ...cfg, streamMode: "updates" })) void _;
      };
      await drain({ idea, maxCalls: 100 });
      await drain(new Command({ resume: "hmw" }));
      await drain(new Command({ resume: "cerceve" }));
      const st = await graph.getState(cfg);
      return st.values.transcript.filter((t) => t.phase === "F2:idea");
    };

    // Gecikme HER İKİ koşumda farklı koltukta: tamamlanma sırası iki kez, iki farklı biçimde bozulur.
    const a = await kosum("det-a", `${LONG} [TEST:slow:visionary]`);
    const b = await kosum("det-b", `${LONG} [TEST:slow:architect]`);
    const siraA = a.map((t) => t.seatId);
    const siraB = b.map((t) => t.seatId);
    console.log(`  gecikme visionary'de -> transkript sirasi: ${siraA.join(",")}`);
    console.log(`  gecikme architect'te  -> transkript sirasi: ${siraB.join(",")}`);
    check(JSON.stringify(siraA) === JSON.stringify(KANONIK), "transkript kanonik sirada olmali (A)");
    check(JSON.stringify(siraB) === JSON.stringify(KANONIK), "transkript kanonik sirada olmali (B)");

    // Aynı girdi -> BAYT-ÖZDEŞ transkript
    const c1 = await kosum("det-c1", `${LONG} [TEST:slow:market]`);
    const c2 = await kosum("det-c2", `${LONG} [TEST:slow:market]`);
    check(JSON.stringify(c1) === JSON.stringify(c2), "ayni girdi bayt-ozdes transkript uretmeli");
    console.log(`  ayni girdi iki kez -> transkript bayt-ozdes (${JSON.stringify(c1).length} bayt)`);
    results.push({ id: "PARALEL", ok: true });
    console.log(`  GECTI`);
  } catch (e) {
    results.push({ id: "PARALEL", ok: false, err: e.message });
    console.log(`  DUSTU: ${e.message}`);
  }

  // ------------------------------------------------ ek bağlam: bütçe bilinçli enjeksiyon
  // DESIGN §5: ek belgelerin TAM METNİ yalnız F0'da Baş Danışman'a ve F4'te değerlendirenler ile
  // Denetçi'ye gider; diğer bütün fazlar BD'nin ek ÖZETİ üzerinden görür. Bu blok, ham metnin
  // gitmemesi gereken yere gitmediğini parmak iziyle kanıtlar.
  console.log(`\n[KANIT] Ek baglam: tam metin nereye gidiyor, ozet nereye?`);
  try {
    const { buildCouncilGraph } = await import("../src/core/graph/graph.ts");
    const { StubSeatRunner } = await import("../src/core/graph/seatRunner.ts");
    const { Command } = await import("@langchain/langgraph");
    const PARMAK_IZI = "BENZERSIZ_EK_ICERIGI_9F3A";
    const ek = { name: "test-readme.md", content: `# Test\n\n${PARMAK_IZI}\n\nBu bir ek belgedir.` };

    const izler = [];
    const inner = new StubSeatRunner();
    const spy = {
      async run(seatId, input) {
        izler.push({
          seatId,
          phase: input.phase,
          tamMetin: (input.attachments ?? []).length > 0,
          ozet: Boolean(input.attachmentSummary),
        });
        return inner.run(seatId, input);
      },
    };
    const graph = buildCouncilGraph(spy);
    const cfg = { configurable: { thread_id: "ek-baglam" } };
    const drain = async (input) => {
      for await (const _ of await graph.stream(input, { ...cfg, streamMode: "updates" })) void _;
    };
    await drain({ idea: LONG, maxCalls: 100, attachments: [ek] });
    await drain(new Command({ resume: "hmw" }));
    await drain(new Command({ resume: "cerceve" }));

    const tamMetinAlanlar = izler.filter((i) => i.tamMetin).map((i) => i.phase);
    const IZINLI = ["F0:briefing", "F4:feasibility", "F4:audit"];
    const izinsiz = tamMetinAlanlar.filter((p) => !IZINLI.includes(p));
    const ozetAlanlar = izler.filter((i) => i.ozet && !i.tamMetin).map((i) => i.phase);

    console.log(`  TAM METIN goren fazlar : ${[...new Set(tamMetinAlanlar)].join(", ")}`);
    console.log(`  OZET goren fazlar      : ${[...new Set(ozetAlanlar)].join(", ")}`);
    console.log(`  izinsiz tam metin      : ${izinsiz.length}`);
    check(tamMetinAlanlar.includes("F0:briefing"), "BD brifingi tam metni gormeli");
    check(tamMetinAlanlar.includes("F4:feasibility"), "fizibilite tam metni gormeli");
    check(tamMetinAlanlar.includes("F4:audit"), "denetim tam metni gormeli");
    check(izinsiz.length === 0, `tam metin izinsiz faza sizdi: ${izinsiz.join(",")}`);
    check(ozetAlanlar.length > 0, "diger fazlar ek ozetini gormeli");
    results.push({ id: "EK-BAGLAM", ok: true });
    console.log(`  GECTI`);
  } catch (e) {
    results.push({ id: "EK-BAGLAM", ok: false, err: e.message });
    console.log(`  DUSTU: ${e.message}`);
  }

  // ------------------------------------------------ prompt kapsamı (mekanizma testi)
  // Promptların düzenlenmesi Şah onayı gerektirmez (DESIGN §7); güvence burada: grafın çağırdığı
  // HER koltuk-faz çiftinin bir prompt dosyası olmalı. Silinen ya da unutulan prompt bu testi düşürür,
  // yani gerçek koşumda hiçbir koltuk sessiz bir varsayılanla konuşamaz.
  //
  // BU TEST AYNI ZAMANDA BİR MEKANİZMA BEKÇİSİDİR. Çağrılan çift kümesi, kadronun hangi fazda kimi
  // konuşturduğunun tam listesidir; beklenmedik bir çift buraya düşerse eksik prompt olarak görünür.
  // İlk yakaladığı sapma bu oldu: küçük kurulda Denetçi üretim turuna sokulmuştu ve §3'teki
  // "erken eleştiri üretimi bastırır" mekanizması o yolda sessizce kapanıyordu (M2-A, düzeltildi).
  // Yani buradaki "eksik dosya" hatası çoğu zaman eksik dosya değil, yanlış kadro demektir.
  console.log(`\n[KANIT] Prompt kapsami: grafin cagirdigi her koltuk-faz cifti dosyada var mi?`);
  try {
    const { loadPrompt, loadIdentity, buildSystemPrompt, promptFileName } = await import(
      "../src/core/prompts/load.ts"
    );
    const pairs = new Map();
    for (const c of spyCalls) pairs.set(`${c.seatId}|${c.phase}`, c);
    const missing = [];
    for (const c of pairs.values()) {
      try {
        loadPrompt(c.seatId, c.phase);
      } catch {
        missing.push(`${promptFileName(c.seatId, c.phase)}  (koltuk ${c.seatId}, faz ${c.phase})`);
      }
      // KİMLİK katmanı da kapsama dahil: kimliksiz bir koltuk, F3 ve F5'te kim olduğunu bilmez.
      try {
        loadIdentity(c.seatId);
      } catch {
        missing.push(`${c.seatId}-kimlik.md  (koltuk ${c.seatId})`);
      }
    }
    // F3 ve F5'te kimlik gerçekten sistem promptunda mı? (Bu iki fazın talimat dosyaları
    // koltuktan koltuğa neredeyse aynıydı; kimlik tek taşıyıcı.)
    for (const [seat, faz] of [
      ["visionary", "F3:cross"],
      ["market", "F5:ranking"],
      ["architect", "F5:ranking"],
    ]) {
      const sistem = buildSystemPrompt(seat, faz);
      const kimlik = loadIdentity(seat);
      if (!sistem.startsWith(kimlik.slice(0, 40))) missing.push(`${seat} kimligi ${faz} sistem promptunda yok`);
    }
    console.log(`  cagrilan benzersiz cift: ${pairs.size} | eksik prompt: ${missing.length}`);
    for (const m of missing) console.log(`    EKSIK: ${m}`);
    check(pairs.size > 0, "hic cagri toplanmadi");
    check(missing.length === 0, `${missing.length} koltuk-faz cifti icin prompt dosyasi yok`);
    results.push({ id: "PROMPT", ok: true });
    console.log(`  GECTI`);
  } catch (e) {
    results.push({ id: "PROMPT", ok: false, err: e.message });
    console.log(`  DUSTU: ${e.message}`);
  }
}

// ---------------------------------------------------------------- giriş
try {
  await run();
} catch (e) {
  console.error(`\nKOSU HATASI: ${e.message}`);
  results.push({ id: "KOSU", ok: false, err: e.message });
} finally {
  await stopServer();
  rmSync(TMP, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${"=".repeat(70)}`);
console.log(`SONUC: ${results.length - failed.length}/${results.length} gecti`);
for (const f of failed) console.log(`  DUSEN: ${f.id} -> ${f.err}`);
process.exit(failed.length === 0 ? 0 : 1);
