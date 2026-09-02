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
  server = spawn("node_modules/.bin/next", ["dev", "--port", String(PORT)], {
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

  // S08: bütçe kapısı faz BAŞLAMADAN açılır; Şah tavanı yükseltir
  await scenario("S08", "Butce kapisi faz baslamadan + Sah tavani yukseltir", async () => {
    await post({ threadId: "e2e-s08", idea: LONG, maxCalls: 5 });
    await post({ threadId: "e2e-s08", resume: "hmw" });
    let s = stopEvent(await post({ threadId: "e2e-s08", resume: "cerceve onaylandi" }));
    check(s.gate === "BUTCE", `BUTCE bekleniyordu: ${s.gate ?? s.type}`);
    check(s.payload.at === "F2", `kapi F2 girisinde acilmaliydi: ${s.payload.at}`);
    check(s.payload.callCount === 3 && s.payload.nextCost === 4, "kosan/maliyet sayilari beklenenden farkli");
    check(s.payload.callCount + s.payload.nextCost > s.payload.maxCalls, "kapi 'asilacak mi' mantigiyla acilmali");
    s = stopEvent(await post({ threadId: "e2e-s08", resume: 40 }));
    check(s.gate === "KAPI3", "tavan yukseltilince akis tamamlanmaliydi");
    s = stopEvent(await post({ threadId: "e2e-s08", resume: "karar" }));
    check(s.metrics.callCount === 27, `27 cagri bekleniyordu: ${s.metrics.callCount}`);
    console.log(`  kanit: kapi F2 girisinde (3+4>5), tavan 40'a cikti, toplam ${s.metrics.callCount}`);
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
    check(s.gate === "KAPI3", `KAPI3 bekleniyordu: ${s.gate ?? s.type}`);
    check(s.payload.auditComplete === false, "premortemsiz denetim tam sayilmamaliydi");
    check(
      String(s.payload.auditIssue).includes("premortem"),
      `eksiklik sebebi premortem olmaliydi: ${s.payload.auditIssue}`,
    );
    console.log(`  kanit: KAPI3'te auditComplete=false, sebep: ${s.payload.auditIssue}`);
    s = stopEvent(await post({ threadId: "e2e-s11", resume: "karar" }));
    check(s.metrics.auditComplete === false, "done olayinda da eksiklik gorunmeli");
  });

  // S12: §6.2 rozet kuralı, URL'siz "dogrulanmis" iddia denetimi geçersiz kılar
  await scenario("S12", "URL'siz \"dogrulanmis\" rozet reddedilir (§6.2)", async () => {
    await post({ threadId: "e2e-s12", idea: `${LONG} [TEST:badurl]` });
    await post({ threadId: "e2e-s12", resume: "hmw" });
    const s = stopEvent(await post({ threadId: "e2e-s12", resume: "cerceve onaylandi" }));
    check(s.gate === "KAPI3", `KAPI3 bekleniyordu: ${s.gate ?? s.type}`);
    check(s.payload.auditComplete === false, "URL'siz dogrulanmis iddia denetimi gecersiz kilmaliydi");
    check(
      String(s.payload.auditIssue).includes("URL'siz"),
      `sebep §6.2 rozet kurali olmaliydi: ${s.payload.auditIssue}`,
    );
    console.log(`  kanit: ${s.payload.auditIssue}`);
  });

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
        calls.push({ seatId, phase: input.phase, context: input.context ?? "", output: out.content });
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
    const { loadPrompt, promptFileName } = await import("../src/core/prompts/load.ts");
    const pairs = new Map();
    for (const c of spyCalls) pairs.set(`${c.seatId}|${c.phase}`, c);
    const missing = [];
    for (const c of pairs.values()) {
      try {
        loadPrompt(c.seatId, c.phase);
      } catch {
        missing.push(`${promptFileName(c.seatId, c.phase)}  (koltuk ${c.seatId}, faz ${c.phase})`);
      }
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
