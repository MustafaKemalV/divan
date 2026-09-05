#!/usr/bin/env node
/**
 * Divan oturum sürücüsü. Şah'ın gerçek bir fikri kurula götürmesi için:
 *
 *   npm run oturum -- fikir.txt
 *
 * Ne yapar: dev sunucusunu başlatır, fikri KELİMESİ KELİMESİNE gönderir (özetlemek Baş
 * Danışman'ın F0 işidir, sürücü ona karışmaz), akışı canlı gösterir, kapılarda durup Şah'a sorar,
 * oturum bitince transkripti ve künyeyi bir dosyaya yazar.
 *
 * Yarım kalan bir oturumu sürdürmek için:
 *
 *   npm run oturum -- --devam <threadId>
 *
 * Yarım oturum yanmış para demektir: checkpointer durumu zaten tutuyor, tekrar baştan koşmak
 * ödenmiş çağrıları ikinci kez ödemektir.
 *
 * Varsayılan GERÇEK modellerdir. Sahte koşum için: DIVAN_RUNNER=stub npm run oturum -- fikir.txt
 */

import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { stdin, stdout } from "node:process";

const PORT = Number(process.env.DIVAN_PORT ?? 3200);
const BASE = `http://127.0.0.1:${PORT}`;
const CIKTI_DIR = join(process.cwd(), "oturum-ciktisi");

const devamIdx = process.argv.indexOf("--devam");
const devamThread = devamIdx >= 0 ? process.argv[devamIdx + 1] : null;
const dosya = devamThread ? null : process.argv[2];

if (!devamThread && !dosya) {
  console.error("Kullanim:\n  npm run oturum -- <fikir-dosyasi>\n  npm run oturum -- --devam <threadId>");
  process.exit(2);
}
if (devamThread && !/^[\w.-]+$/.test(devamThread)) {
  console.error(`Gecersiz threadId: ${devamThread}`);
  process.exit(2);
}
// Ek belgeler: fikrin yanina ilistirilen dosyalar (README, sema, ornek kod).
// npm run oturum -- fikir.txt --ek README.md --ek baska.md
const ekYollari = process.argv.reduce((acc, arg, i) => (arg === "--ek" && process.argv[i + 1] ? [...acc, process.argv[i + 1]] : acc), []);
const ekler = ekYollari.map((y) => ({ name: basename(y), content: readFileSync(y, "utf8") }));

const fikir = dosya ? readFileSync(dosya, "utf8").trim() : "";
if (dosya && !fikir) {
  console.error(`Fikir dosyasi bos: ${dosya}`);
  process.exit(2);
}

const rl = createInterface({ input: stdin, output: stdout });

/**
 * HAM olay günlüğü (JSONL). Markdown çıktısı insan içindir; bu dosya makine içindir ve üç işe
 * yarar: kayıttan-oynatma demosu (DESIGN §10), M4'te odanın olay akışını beslemek, ve gerçek
 * oturumlardan bir regresyon korpusu biriktirmek. Her satır bir olay, üstünde alındığı an.
 */
let gunlukYolu = null;
function gunlukYaz(kayit) {
  if (!gunlukYolu) return;
  try {
    appendFileSync(gunlukYolu, JSON.stringify({ t: new Date().toISOString(), ...kayit }) + "\n", "utf8");
  } catch {
    // Günlük yazılamazsa oturum durmaz: kayıt bir kolaylıktır, akışın şartı değil.
  }
}

/**
 * Süre kırılımı. Toplam süre tek başına yanıltıcıdır: içinde hem modellerin çalıştığı zaman hem
 * Şah'ın kapıda düşündüğü zaman vardır ve ikisi apayrı şeylerdir. Model süresi bir performans
 * ölçüsüdür (paralellik onu düşürür); kapı beklemesi bir kullanım ölçüsüdür.
 */
const sure = { modelMs: 0, kapiMs: 0, dugum: new Map() };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let server = null;

async function startServer() {
  const env = { ...process.env, PORT: String(PORT) };
  // AĞ SINIRI (DESIGN §10): yalnız yerel arayüz. Host verilmezse Next bütün arayüzlere
  // bağlanır ve aynı ağdaki herkes /api/council ile Şah'ın anahtarını harcayabilir,
  // GET ile transkript okuyabilir. Anahtar VE harcama yetkisi makineden çıkmaz.
  server = spawn("node_modules/.bin/next", ["dev", "--hostname", "127.0.0.1", "--port", String(PORT)], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", () => {});
  server.stderr.on("data", () => {});
  process.stdout.write("sunucu baslatiliyor");
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(BASE, { signal: AbortSignal.timeout(2000) });
      if (r.ok || r.status < 500) {
        console.log(" hazir.\n");
        return;
      }
    } catch {
      /* henuz ayakta degil */
    }
    process.stdout.write(".");
    await sleep(500);
  }
  throw new Error(`sunucu ${PORT} portunda ayaga kalkmadi`);
}

function stopServer() {
  if (server) server.kill("SIGTERM");
  server = null;
}

/** POST /api/council -> olaylari CANLI gosterir, duraklama olayini dondurur. */
async function gonder(body) {
  const t0 = Date.now();
  let sonOlay = t0;
  const res = await fetch(`${BASE}/api/council`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(1_800_000),
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let tampon = "";
  let durak = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    tampon += decoder.decode(value, { stream: true });
    const satirlar = tampon.split("\n");
    tampon = satirlar.pop() ?? "";
    for (const satir of satirlar) {
      if (!satir.startsWith("data: ")) continue;
      const e = JSON.parse(satir.slice(6));
      gunlukYaz(e);
      if (e.type === "node-update") {
        // Düğümler sırayla akar; iki olay arası geçen süre o düğümün süresidir.
        const gecen = Date.now() - sonOlay;
        sonOlay = Date.now();
        sure.dugum.set(e.node, (sure.dugum.get(e.node) ?? 0) + gecen);
        console.log(`   . ${e.node}  (${(gecen / 1000).toFixed(1)} sn)`);
        // Dalga tamamlandığında koltuk çıktıları TAM METİN ve kanonik sırada basılır.
        for (const k of e.entries ?? []) {
          console.log(`\n   ${"-".repeat(66)}`);
          console.log(`   ${k.seatId}  [${k.phase}]`);
          console.log(`   ${"-".repeat(66)}`);
          for (const satir of String(k.content).split("\n")) console.log(`   ${satir}`);
        }
        if ((e.entries ?? []).length) console.log("");
      }
      if (e.type === "error") console.log(`   ! hata: ${e.message}`);
      if (e.type === "gate" || e.type === "done") durak = e;
    }
  }
  sure.modelMs += Date.now() - t0;
  return durak;
}

const fmtListe = (x) => (Array.isArray(x) && x.length ? x.map((v) => `      - ${v}`).join("\n") : "      (yok)");

/** Kapıyı okunabilir basar ve Şah'ın yanıtını alır. */
async function kapiyiSor(e) {
  const p = e.payload ?? {};
  console.log(`\n${"=".repeat(72)}\nKAPI: ${e.gate}\n${"=".repeat(72)}`);

  if (e.gate === "KAPI1") {
    console.log(`Kurul boyutu onerisi: ${p.councilMode}`);
    if (p.councilModeNote) console.log(`  (${p.councilModeNote})`);
    console.log("\nHMW secenekleri:");
    (p.options ?? []).forEach((o, i) => console.log(`  ${i + 1}) ${o}`));
    const c = (await rl.question("\nSecimin (numara ya da kendi cumlen): ")).trim();
    const n = Number(c);
    return Number.isInteger(n) && n >= 1 && n <= (p.options ?? []).length ? p.options[n - 1] : c;
  }

  if (e.gate === "KAPI2") {
    console.log(`Denetci'nin cerceve itirazi:\n\n${p.frameObjection}\n`);
    return (await rl.question("Cerceveyi onayla ya da duzelt: ")).trim();
  }

  if (e.gate === "KAPI3") {
    console.log("Siralamalar:");
    console.log(fmtListe(p.rankings));
    console.log(`\nMuhalefet notu (Denetci'nin HAM metni):\n${p.dissentNote || "      (blocking muhalefet yok)"}`);
    console.log(`\nRevizyonla dusen itirazlar:\n${fmtListe(p.droppedObjections)}`);
    console.log(`\nDenetim mekanik sartlari: ${p.auditComplete ? "tam" : `EKSIK -> ${p.auditIssue}`}`);
    console.log(`Susan koltuklar:\n${fmtListe(p.silentSeats)}`);
    console.log(`\nBuraya kadar: ${p.callCount} cagri, $${p.costUsd} (maliyeti bilinmeyen ${p.costUnknownCalls} cagri)`);
    return (await rl.question("\nKararin: ")).trim();
  }

  if (e.gate === "BUTCE") {
    console.log(`Faz: ${p.at}`);
    console.log(`KESIN  : kosan ${p.kesin.kosanCagri} + faz ${p.kesin.fazCagriSayisi} > tavan ${p.kesin.tavan}`);
    console.log(`KESTIRIM: ~$${p.kestirim.fazMaliyetiUsd} (${p.kestirim.etiket})`);
    console.log(`          gozlenen ${p.kestirim.gozlenenKoltuk} koltuk, gozlemsiz ${p.kestirim.gozlemsizKoltuk}`);
    console.log(`          oturum su ana kadar: $${p.kestirim.oturumMaliyetiUsd}`);
    if (p.hata) console.log(`HATA: ${p.hata}`);
    const c = (await rl.question(`\nYanit (${(p.kabulEdilen ?? []).join(" | ")}): `)).trim();
    const n = Number(c);
    return Number.isFinite(n) && n > 0 ? n : c;
  }

  console.log(JSON.stringify(p, null, 2));
  return (await rl.question("\nYanitin: ")).trim();
}

function ciktiYaz(threadId, state, runnerMode, sureMs, sureKirilim) {
  mkdirSync(CIKTI_DIR, { recursive: true });
  const v = state.values ?? {};
  const fazlar = new Map();
  for (const t of v.transcript ?? []) {
    if (!fazlar.has(t.phase)) fazlar.set(t.phase, []);
    fazlar.get(t.phase).push(t);
  }
  const usd = (v.costNanoUsd ?? 0) / 1e9;
  const satirlar = [
    `# Divan oturumu: ${threadId}`,
    "",
    `- Kosum modu: **${runnerMode}**${runnerMode === "stub" ? " (SAHTE OTURUM, gercek sanilamaz)" : ""}`,
    `- Kurul: ${v.councilMode ?? "-"} | Cagri: ${v.callCount ?? 0}`,
    `- Sure: ${(sureMs / 1000).toFixed(0)} sn toplam = model ${(sureKirilim.modelMs / 1000).toFixed(0)} sn + kapida bekleme ${(sureKirilim.kapiMs / 1000).toFixed(0)} sn`,
    `- Faz sureleri: ${[...sureKirilim.dugum.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, ms]) => `${n} ${(ms / 1000).toFixed(0)}sn`).join(", ")}`,
    `- Maliyet: $${usd.toFixed(6)} (maliyeti bilinmeyen ${v.costUnknownCalls ?? 0} cagri, ${v.totalTokens ?? 0} token)`,
    `- Revizyon turu: ${v.revisionRounds ?? 0} | Hukum yeniden kosumu: ${v.judgmentRetries ?? 0} | Denetim iadesi: ${v.auditRetries ?? 0}`,
    `- Denetim mekanik sartlari: ${v.auditComplete ? "tam" : `EKSIK (${v.auditIssue})`}`,
    `- Susan koltuklar: ${(v.silentSeats ?? []).join(", ") || "yok"}`,
    v.endReason ? `- Bitis sebebi: ${v.endReason}` : "",
    "",
    "## Fikir (kelimesi kelimesine)",
    "",
    v.idea ?? "",
    "",
    `## Secilen HMW\n\n${v.selectedHmw ?? "-"}`,
    "",
    `## Onaylanan cerceve\n\n${v.approvedFrame ?? "-"}`,
    "",
    "## Siralamalar",
    "",
    ...(v.rankings ?? []).map((r) => `- ${r}`),
    "",
    "## Muhalefet notu (degistirilemez)",
    "",
    v.dissentNote || "(blocking muhalefet yok)",
    "",
    "## Revizyonla dusen itirazlar",
    "",
    ...((v.droppedObjections ?? []).map((d) => `- ${d}`) || []),
    "",
    "## Karar",
    "",
    v.decision ?? "-",
    "",
    "## Transkript",
    "",
  ];
  for (const [faz, kayitlar] of fazlar) {
    satirlar.push(`### ${faz}`, "");
    for (const k of kayitlar) satirlar.push(`**${k.seatId}**`, "", k.content, "");
  }
  const yol = join(CIKTI_DIR, `${threadId}.md`);
  writeFileSync(yol, satirlar.join("\n"), "utf8");
  return yol;
}

async function main() {
  const threadId = devamThread ?? `oturum-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  mkdirSync(CIKTI_DIR, { recursive: true });
  gunlukYolu = join(CIKTI_DIR, `${threadId}.jsonl`);
  console.log(
    devamThread
      ? `Divan oturumu (DEVAM)\n  yarim oturum surduruluyor; odenmis cagrilar tekrar odenmez`
      : `Divan oturumu\n  fikir dosyasi : ${dosya} (${fikir.length} karakter, kelimesi kelimesine gonderilecek)`,
  );
  console.log(`  thread        : ${threadId}`);
  console.log(`  runner        : ${process.env.DIVAN_RUNNER ?? "openrouter (gercek)"}`);
  if (ekler.length) {
    const toplam = ekler.reduce((n, e) => n + e.content.length, 0);
    console.log(`  ek belgeler   : ${ekler.map((e) => e.name).join(", ")} (toplam ${toplam} karakter)`);
    console.log(`                  tam metin yalniz F0-BD ve F4'e gider; diger fazlar ozet gorur`);
  }
  console.log(`  olay gunlugu  : ${gunlukYolu}\n`);
  gunlukYaz({
    type: devamThread ? "oturum-devam" : "oturum-basladi",
    threadId,
    fikirDosyasi: dosya,
    fikirUzunlugu: fikir.length,
  });

  await startServer();
  const t0 = Date.now();
  let durak;

  if (devamThread) {
    // Durumu oku: oturum nerede kalmış, bekleyen bir kapı var mı?
    const st = await (await fetch(`${BASE}/api/council?threadId=${threadId}`)).json();
    const v = st.values ?? {};
    if (!v.idea) {
      console.error(`Bu threadId'de kayitli oturum yok: ${threadId}`);
      return;
    }
    console.log(`  su ana kadar  : ${v.callCount ?? 0} cagri, $${((v.costNanoUsd ?? 0) / 1e9).toFixed(6)}`);
    if (!st.bekleyenKapi) {
      console.log(`\n  Bu oturumda bekleyen kapi yok (durum: ${(st.next ?? []).join(",") || "tamamlanmis"}).`);
      const yol = ciktiYaz(threadId, st, st.runnerMode, 0, sure);
      console.log(`  cikti      : ${yol}`);
      return;
    }
    console.log(`  bekleyen kapi : ${st.bekleyenKapi.gate}\n`);
    durak = { type: "gate", gate: st.bekleyenKapi.gate, payload: st.bekleyenKapi.payload, threadId };
  } else {
    durak = await gonder({ threadId, idea: fikir, attachments: ekler });
  }

  while (durak && durak.type === "gate") {
    const kapiBaslangic = Date.now();
    const yanit = await kapiyiSor(durak);
    sure.kapiMs += Date.now() - kapiBaslangic;
    // Şah'ın yanıtı da kayda girer: kapıda ne sorulduğu kadar ne cevaplandığı da replay'in parçası.
    gunlukYaz({ type: "sah-yaniti", gate: durak.gate, yanit, bekleyisMs: Date.now() - kapiBaslangic });
    console.log("");
    durak = await gonder({ threadId, resume: yanit });
  }

  const sureMs = Date.now() - t0;
  const yavaslar = [...sure.dugum.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (durak?.type === "done") {
    console.log(`\n${"=".repeat(72)}\nOTURUM BITTI`);
    console.log(`  mod        : ${durak.runnerMode}`);
    console.log(`  cagri      : ${durak.metrics.callCount}`);
    console.log(`  maliyet    : $${durak.metrics.costUsd} (bilinmeyen ${durak.metrics.costUnknownCalls} cagri)`);
    console.log(`  token      : ${durak.metrics.totalTokens}`);
    console.log(`  sure       : ${(sureMs / 1000).toFixed(0)} sn toplam`);
    console.log(`               model ${(sure.modelMs / 1000).toFixed(0)} sn | kapida bekleme ${(sure.kapiMs / 1000).toFixed(0)} sn`);
    console.log(`  en yavas   : ${yavaslar.map(([n, ms]) => `${n} ${(ms / 1000).toFixed(0)}sn`).join(", ")}`);
    console.log(`  susan      : ${(durak.silentSeats ?? []).join(", ") || "yok"}`);
    if (durak.reason) console.log(`  bitis      : ${durak.reason}`);
  }

  const st = await (await fetch(`${BASE}/api/council?threadId=${threadId}`)).json();
  gunlukYaz({ type: "oturum-bitti", sureMs, modelMs: sure.modelMs, kapiMs: sure.kapiMs });
  const yol = ciktiYaz(threadId, st, st.runnerMode, sureMs, sure);
  console.log(`\n  cikti      : ${yol}`);
  console.log(`  olay gunlugu: ${gunlukYolu}`);
}

try {
  await main();
} catch (e) {
  console.error(`\nOTURUM HATASI: ${e.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
  stopServer();
  await sleep(500);
}
