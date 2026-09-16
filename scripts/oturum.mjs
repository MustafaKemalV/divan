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
 * ödenmiş çağrıları ikinci kez ödemektir. Bu, kapıda bekleyen oturum için de ÇÖKEN oturum için de
 * geçerlidir: bir düğüm çöktüyse `--devam` onu tanır ve o düğümden sürdürür (U-14).
 *
 * Varsayılan GERÇEK modellerdir. Sahte koşum için: DIVAN_RUNNER=stub npm run oturum -- fikir.txt
 *
 * KLAVYESİZ koşum (deney kolları, M5 kör değerlendirmesi):
 *
 *   npm run oturum -- fikir.txt --yanit KAPI1=2 --yanit KAPI2="cerceve onaylandi" --yanit KAPI3=karar
 *
 * `--evet` gerçek koşumun onay sorusunu atlar (H-8). Soru YALNIZ klavyeli koşumda sorulur; yazılı
 * yanıtla koşan bir kol zaten TTY'siz olduğu için soruyu hiç görmez.
 *
 * Yanıtı verilen kapı sorulmaz. Yanıtı OLMAYAN kapıda stdin bir TTY ise sorulur; değilse oturum
 * güvenli durur (çıkış kodu 3) ve `--devam` ile sürdürülür. Sessizce varsayılan uydurulmaz.
 *
 * Hangi config ile koşulacağı `DIVAN_CONFIG` ile seçilir (deney kolları: `eval/`).
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
// Ilk konumsal argüman fikir dosyasidir; bayrak gelirse kullanim hatasi (sessiz "dosya bos"
// hatasiyla ugrastirmaktansa dogrudan soyle).
if (dosya && dosya.startsWith("--")) {
  console.error(`Fikir dosyasi bekleniyordu, bayrak geldi: ${dosya}\n  npm run oturum -- <fikir-dosyasi> [--ek <dosya>] [--yanit KAPI=metin]`);
  process.exit(2);
}
// Yazili kapi yanitlari: --yanit KAPI1=2 --yanit KAPI2="cerceve onaylandi" --yanit BUTCE=40
//
// Neden var: deney kollari ve M5'in kor degerlendirmesi ayni fikri birden cok kez kosar; her
// kosumda ayni kapilari elle cevaplamak hem yorucu hem de KOLLARI KIYASLANAMAZ yapar (Sah iki
// kolda farkli cumleler yazarsa fark kadrodan mi cevaptan mi gelir bilinmez). Yazili yanit
// kollarin girdisini AYNI tutar.
//
// Yaniti olmayan kapi asla varsayilanla doldurulmaz: TTY varsa sorulur, yoksa guvenli durus.
const yaziliYanitlar = new Map();
process.argv.forEach((arg, i) => {
  if (arg !== "--yanit") return;
  const ham = process.argv[i + 1] ?? "";
  const esit = ham.indexOf("=");
  if (esit <= 0) {
    console.error(`Gecersiz --yanit: "${ham}". Bicim: --yanit KAPI1=2 (kapi=metin)`);
    process.exit(2);
  }
  yaziliYanitlar.set(ham.slice(0, esit).trim().toUpperCase(), ham.slice(esit + 1));
});

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
 * Terk edilen dalın maliyeti (C-7). Re-table checkpoint'i geri sarar; state.callCount ve
 * state.costNanoUsd o dalı GÖRMEZ, ama para harcanmıştır. 9 Eylül koşumunda künye $1.250261
 * diyordu, gerçek harcama $1.387532'ydi ve aradaki $0.137271 künyede hiç görünmüyordu.
 *
 * Hesap `eval/karsilastir.mjs` ile AYNI yöntemi kullanır: re-table olayından ÖNCE, o düğümün
 * fazında kaydedilmiş çağrılar atılmıştır. İki yerde iki farklı sayı çıkmasın diye ölçüt aynı.
 */
function terkEdilenDal() {
  try {
    const olaylar = readFileSync(gunlukYolu, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    const reTable = olaylar.filter((e) => e.type === "re-table");
    if (reTable.length === 0) return null;
    const cagrilar = olaylar.flatMap((e) => (e.calls ?? []).map((c) => ({ ...c, t: e.t })));
    const atilan = [];
    for (const r of reTable) {
      const faz = String(r.dugum).replace(/^f(\d)s?_/, (_m, n) => `F${n}:`).toLowerCase();
      const an = new Date(r.t).getTime();
      for (const c of cagrilar) {
        if (!c.phase.toLowerCase().startsWith(faz)) continue;
        if (new Date(c.t).getTime() < an && !atilan.includes(c)) atilan.push(c);
      }
    }
    if (atilan.length === 0) return null;
    return { cagri: atilan.length, nano: atilan.reduce((n, c) => n + (c.costNanoUsd ?? 0), 0) };
  } catch {
    return null; // günlük okunamazsa künye eksilmez, yalnız bu satır düşer
  }
}

/**
 * Kadro istisnası beyanı (DESIGN §4), SUNUCUDAN. Dosyayı ikinci kez okumuyoruz: 9 Eylül
 * koşumunda config oturumun ortasında değişti, ve künye oturumun gerçekten koştuğu kadroyu
 * söylemeli, dosyanın son halini değil. Oturum başında state'e yazılır, buradan geri okunur.
 */
let kadroIstisnasiBeyani = null;
async function kadroIstisnasiniSunucudanOku(threadId) {
  try {
    const st = await (await fetch(`${BASE}/api/council?threadId=${threadId}`)).json();
    kadroIstisnasiBeyani = String(st.values?.kadroIstisnasi ?? "").trim() || null;
  } catch {
    kadroIstisnasiBeyani = null;
  }
  return kadroIstisnasiBeyani;
}
const kadroIstisnasiOku = () => kadroIstisnasiBeyani;

/**
 * Beyanı oturum state'inden okur ve BİR KEZ basar. Oturum başladıktan sonra çağrılır, çünkü
 * state ilk POST ile doğar; daha erken basmak dosyayı okumak demekti ve o, oturumun koştuğu
 * kadroyu değil dosyanın son halini gösterirdi.
 */
let istisnaBasildi = false;
async function kadroIstisnasiniBas(threadId) {
  const istisna = await kadroIstisnasiniSunucudanOku(threadId);
  if (!istisna || istisnaBasildi) return;
  istisnaBasildi = true;
  console.log(`\n  KADRO ISTISNASI (DESIGN §4, bilerek beyan edilmis):`);
  for (const satir of istisna.match(/.{1,88}(\s|$)/g) ?? [istisna]) console.log(`    ${satir.trim()}`);
  gunlukYaz({ type: "kadro-istisnasi", beyan: istisna });
  console.log("");
}

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
/**
 * ÇIKIŞ KODU SÖZLEŞMESİ (C-6). Bir koşumun nasıl bittiği kabuktan okunabilir olmalı:
 *   0  temiz bitiş
 *   1  düğüm çöktü (`error` olayı) ya da sürücü hata aldı
 *   3  yanıtsız kapı (TTY yok, --yanit verilmedi): güvenli duruş, --devam ile sürer
 *   4  sebepli duruş (`done.reason` dolu): omurga sustu, kapı iptali, sözleşme dışı yanıt
 *   5  gerçek koşum onaylanmadı (H-8 korkuluğu): hiç çağrı yapılmadı, hiç para harcanmadı
 * Önceden çöken oturum da sebepli duruş da 0 ile çıkıyordu, yani "her şey yolunda" diyordu.
 */
let hataOlayi = false;
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
      if (e.type === "error") {
        console.log(`   ! hata: ${e.message}`);
        // C-6: cokme SESSIZ gecmez, cikis kodunda gorunur. Otomasyon (deney kollari, M5 kor
        // degerlendirmesi) cikis koduna bakar; coken bir kosumu basarili saymasi yanlis veri uretir.
        hataOlayi = true;
      }
      if (e.type === "gate" || e.type === "done") durak = e;
    }
  }
  sure.modelMs += Date.now() - t0;
  return durak;
}

const fmtListe = (x) => (Array.isArray(x) && x.length ? x.map((v) => `      - ${v}`).join("\n") : "      (yok)");

/** Kapıyı okunabilir basar ve Şah'ın yanıtını alır. */
/**
 * Şah'ın yanıtını kapının beklediği tipe çevirir. TEK yerdedir, çünkü yanıt iki yoldan gelebilir:
 * klavyeden ya da `--yanit` ile. İkisi farklı çevrilirse yazılı koşum, elle koşumdan başka bir
 * oturum olur ve kollar kıyaslanamaz.
 */
function yanitiCoz(gate, metin, p) {
  const t = String(metin).trim();
  if (gate === "KAPI1") {
    const n = Number(t);
    const secenekler = p.options ?? [];
    return Number.isInteger(n) && n >= 1 && n <= secenekler.length ? secenekler[n - 1] : t;
  }
  if (gate === "BUTCE") {
    const n = Number(t);
    return Number.isFinite(n) && n > 0 ? n : t;
  }
  return t;
}

/**
 * Kapıyı okunur basar ve sorulacak soruyu döndürür. Sormaz: yanıtsız kapıda güvenli duruş da
 * aynı çıktıyı basmak zorunda, yoksa Şah neyin beklendiğini görmeden durmuş olur.
 */
function kapiyiBas(e) {
  const p = e.payload ?? {};
  console.log(`\n${"=".repeat(72)}\nKAPI: ${e.gate}\n${"=".repeat(72)}`);

  if (e.gate === "KAPI1") {
    console.log(`Kurul boyutu onerisi: ${p.councilMode}`);
    if (p.councilModeNote) console.log(`  (${p.councilModeNote})`);
    console.log("\nHMW secenekleri:");
    (p.options ?? []).forEach((o, i) => console.log(`  ${i + 1}) ${o}`));
    return "\nSecimin (numara ya da kendi cumlen): ";
  }

  if (e.gate === "KAPI2") {
    console.log(`Denetci'nin cerceve itirazi:\n\n${p.frameObjection}\n`);
    return "Cerceveyi onayla ya da duzelt: ";
  }

  if (e.gate === "KAPI3") {
    console.log("Siralamalar:");
    console.log(fmtListe(p.rankings));
    console.log(`\nMuhalefet notu (Denetci'nin HAM metni):\n${p.dissentNote || "      (blocking muhalefet yok)"}`);
    console.log(`\nRevizyonla dusen itirazlar:\n${fmtListe(p.droppedObjections)}`);
    console.log(`\nDenetim mekanik sartlari: ${p.auditComplete ? "tam" : `EKSIK -> ${p.auditIssue}`}`);
    console.log(`Susan koltuklar:\n${fmtListe(p.silentSeats)}`);
    console.log(`\nBuraya kadar: ${p.callCount} cagri, $${p.costUsd} (maliyeti bilinmeyen ${p.costUnknownCalls} cagri)`);
    if (p.failedAttempts) console.log(`Basarisiz deneme: ${p.failedAttempts} (karsiliksiz harcanan $${p.failedCostUsd})`);
    if (p.searchCalls) {
      console.log(
        `Arama: ${p.searchCalls} sorgu, ${p.searchResults ?? 0} sonuc, $${p.searchCostUsd} (toplam maliyete DAHIL)` +
          (p.searchResults === 0 ? "  <- SONUC YOK: bu denetimde rozet hak edilemez" : ""),
      );
    }
    // Topraklama notlari KARAR ANINDA gorunur: "bu denetimin dis kaynagi yok" iddialarin nasil
    // okunacagini degistirir, ve Sah karari verirken bunu bilmek zorunda.
    if ((p.groundingNotes ?? []).length) {
      console.log(`Topraklama notlari:\n${fmtListe(p.groundingNotes)}`);
    }
    return "\nKararin: ";
  }

  if (e.gate === "BUTCE") {
    console.log(`Faz: ${p.at}`);
    console.log(`KESIN  : kosan ${p.kesin.kosanCagri} + faz ${p.kesin.fazCagriSayisi} > tavan ${p.kesin.tavan}`);
    console.log(`KESTIRIM: ~$${p.kestirim.fazMaliyetiUsd} (${p.kestirim.etiket})`);
    console.log(`          gozlenen ${p.kestirim.gozlenenKoltuk} koltuk, gozlemsiz ${p.kestirim.gozlemsizKoltuk}`);
    console.log(`          oturum su ana kadar: $${p.kestirim.oturumMaliyetiUsd}`);
    if (p.hata) console.log(`HATA: ${p.hata}`);
    return `\nYanit (${(p.kabulEdilen ?? []).join(" | ")}): `;
  }

  // Olay-tetikli kapılar (T3-3). Hepsi kabul listesini İLAN EDER; sözleşme dışı yanıt akışı
  // sürdürmez, sebebi yazılı bir duruş üretir.
  if (e.gate === "ERKEN_BRIFING") {
    console.log("Hukum turunda BLOCKING 'karsilanmadi' kalan maddeler (Denetci'nin ham metni):");
    console.log(fmtListe(p.blocking));
    console.log(`\nre-table icin dugum adi yazin, ornek: re-table:f2_ideation`);
  } else if (e.gate === "DENETIM_EKSIK") {
    console.log(`Denetim mekanik sartlari tasimiyor: ${p.reason}`);
    console.log(`Iade sayisi: ${p.retries} (§6: tek iade hakki kullanildi)`);
    // "Rozet hak edilemedi" ile "arama patladigi icin rozet hak edilemedi" ayni karari gerektirmez.
    if ((p.groundingNotes ?? []).length) {
      console.log(`Topraklama notlari:\n${fmtListe(p.groundingNotes)}`);
    }
  } else if (e.gate === "HUKUM_EKSIK") {
    console.log(`Hukum turu eksik: ${p.judgmentCount} madde, yeniden kosum ${p.retries}`);
    console.log(`Hukum tamamlandi mi: ${p.judgmentComplete}`);
  } else {
    console.log(JSON.stringify(p, null, 2));
  }
  if (p.kurtarma) console.log(`\n${p.kurtarma}`);
  const kabul = (p.kabulEdilen ?? []).join(" | ");
  return `\nYanit${kabul ? ` (${kabul})` : "in"}: `;
}

/** Kapıyı basar, klavyeden yanıt alır ve kapının beklediği tipe çevirir. */
async function kapiyiSor(e) {
  const soru = kapiyiBas(e);
  const c = await rl.question(soru);
  return yanitiCoz(e.gate, c, e.payload ?? {});
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
    ...(kadroIstisnasiOku() ? [`- **KADRO ISTISNASI (DESIGN §4):** ${kadroIstisnasiOku()}`] : []),
    `- Kurul: ${v.councilMode ?? "-"} | Cagri: ${v.callCount ?? 0}`,
    `- Sure: ${(sureMs / 1000).toFixed(0)} sn toplam = model ${(sureKirilim.modelMs / 1000).toFixed(0)} sn + kapida bekleme ${(sureKirilim.kapiMs / 1000).toFixed(0)} sn`,
    `- Faz sureleri: ${[...sureKirilim.dugum.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, ms]) => `${n} ${(ms / 1000).toFixed(0)}sn`).join(", ")}`,
    `- Maliyet: $${usd.toFixed(6)} (maliyeti bilinmeyen ${v.costUnknownCalls ?? 0} cagri, ${v.totalTokens ?? 0} token)`,
    `- Basarisiz deneme: ${v.failedAttempts ?? 0} (karsiliksiz harcanan $${((v.failedCostNanoUsd ?? 0) / 1e9).toFixed(6)})`,
    `- Arama: ${v.searchCalls ?? 0} sorgu, ${v.searchResults ?? 0} sonuc, ` +
      `$${((v.searchCostNanoUsd ?? 0) / 1e9).toFixed(6)} (toplam maliyete DAHIL, ikinci kez eklenmez)` +
      (v.searchCalls > 0 && (v.searchResults ?? 0) === 0 ? " **SONUC YOK: topraklama olmadi**" : ""),
    ...(terkEdilenDal()
      ? [
          `- **Terk edilen dal (olay gunlugunden):** ${terkEdilenDal().cagri} cagri, ` +
            `$${(terkEdilenDal().nano / 1e9).toFixed(6)}. Re-table checkpoint'i geri sardigi icin ` +
            `yukaridaki "Maliyet" satiri bu parayi GORMEZ; harcanmistir.`,
        ]
      : []),
    ...((v.groundingNotes ?? []).length
      ? [`- **Topraklama notlari:** ${(v.groundingNotes ?? []).join(" | ")}`]
      : []),
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
    ...(v.droppedObjections ?? []).map((d) => `- ${d}`),
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

  // GERÇEK KOŞUM KORKULUĞU (H-8). Şart İKİ TANE: runner gerçek VE stdin bir TTY. TTY şartı,
  // otomasyonu (e2e, --yanit kolları) hiç dokunmadan geçirmek için: orada soru sorulamaz zaten,
  // sorulsaydı koşum sessizce kilitlenirdi.
  //
  // Neden var: bu korkuluk olmadan `npm run oturum` stub sanılıp koşuldu ve gerçek runner çalıştı
  // (2026-09-16). O sefer bakiye bos oldugu icin iki cagri da 400 dondu ve maliyet sifir kaldi;
  // bakiye dolu olsaydi izinsiz bir capstone baslamis olacakti. Varsayilanin GERCEK olmasi dogru
  // (sahte kosum acikca istenir), ama varsayilanin pahali olmasi bir onay sorusunu hak eder.
  const gercekRunner = (process.env.DIVAN_RUNNER ?? "openrouter") !== "stub";
  if (gercekRunner && stdin.isTTY && !process.argv.includes("--evet")) {
    const c = (await rl.question("\nGERCEK KOSUM, para harcar. Devam? [e/h]: ")).trim().toLowerCase();
    if (c !== "e" && c !== "evet") {
      // Sunucu daha BASLAMADI ve hicbir cagri yapilmadi: burada durmak bedava.
      console.log("Iptal edildi: hic cagri yapilmadi, hic para harcanmadi.");
      rl.close();
      process.exit(5);
    }
  }

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
    await kadroIstisnasiniBas(threadId);
    const bekleyenDugum = (st.next ?? [])[0];
    if (st.bekleyenKapi) {
      console.log(`  bekleyen kapi : ${st.bekleyenKapi.gate}\n`);
      durak = { type: "gate", gate: st.bekleyenKapi.gate, payload: st.bekleyenKapi.payload, threadId };
    } else if (bekleyenDugum) {
      // ÇÖKMÜŞ OTURUM (U-14). Bekleyen kapı yok ama graf bir düğümde duruyor: o düğüm çöktü.
      // Buraya kadar bu durum "oturum bitmiş" sayılıyordu ve ödenmiş çağrılar çöpe gidiyordu.
      // Checkpoint zaten sağlam; re-table o düğümün ÖNCESİNDEN sürdürür, yani tamamlanmış
      // düğümler yeniden koşmaz ve yeniden faturalanmaz.
      console.log(`  durum         : bekleyen kapi YOK, graf "${bekleyenDugum}" dugumunde duruyor`);
      console.log(`                  -> oturum orada COKTU`);
      console.log(`  kurtarma      : o dugumden surduruluyor; odenmis ${v.callCount ?? 0} cagri yeniden faturalanmaz\n`);
      gunlukYaz({ type: "cokme-kurtarma", dugum: bekleyenDugum, cagri: v.callCount ?? 0 });
      durak = await gonder({ threadId, reTableToNode: bekleyenDugum });
    } else {
      console.log(`\n  Bu oturum tamamlanmis: bekleyen kapi da bekleyen dugum de yok.`);
      const yol = ciktiYaz(threadId, st, st.runnerMode, 0, sure);
      console.log(`  cikti      : ${yol}`);
      return;
    }
  } else {
    durak = await gonder({ threadId, idea: fikir, attachments: ekler });
    await kadroIstisnasiniBas(threadId);
  }

  while (durak && durak.type === "gate") {
    const kapiBaslangic = Date.now();
    let yanit;
    if (yaziliYanitlar.has(durak.gate)) {
      // Yazılı yanıt: kapı BASILIR ama sorulmaz. Basılır, çünkü koşumun kaydı ne sorulduğunu da
      // içermeli; sorulmaz, çünkü yanıt zaten verilmiş.
      kapiyiBas(durak);
      yanit = yanitiCoz(durak.gate, yaziliYanitlar.get(durak.gate), durak.payload ?? {});
      console.log(`\n  [--yanit] ${durak.gate} = ${JSON.stringify(yanit)}`);
    } else if (stdin.isTTY) {
      yanit = await kapiyiSor(durak);
    } else {
      // GÜVENLİ DURUŞ: yanıtı olmayan bir kapı, sorulacak kimse de yokken SESSİZCE
      // varsayılanla doldurulamaz. Bir kapı Şah'ın karar noktasıdır; onu koşum kolaylığı için
      // uydurmak, Divan'ın tek insan kararını sahtelemek olur. Oturum kapanmaz: checkpoint
      // duruyor, --devam ile aynı yerden sürer.
      kapiyiBas(durak);
      console.log(`\n  YANITSIZ KAPI: "${durak.gate}" icin --yanit verilmedi ve stdin bir TTY degil.`);
      console.log(`  Oturum SESSIZCE varsayilanla doldurulmadi; checkpoint korundu.`);
      console.log(`  Surdurmek icin:  npm run oturum -- --devam ${threadId} --yanit ${durak.gate}=<yanit>`);
      gunlukYaz({ type: "yanitsiz-kapi", gate: durak.gate });
      process.exitCode = 3;
      return;
    }
    sure.kapiMs += Date.now() - kapiBaslangic;
    // Şah'ın yanıtı da kayda girer: kapıda ne sorulduğu kadar ne cevaplandığı da replay'in parçası.
    gunlukYaz({ type: "sah-yaniti", gate: durak.gate, yanit, bekleyisMs: Date.now() - kapiBaslangic });
    console.log("");
    // "re-table:<düğüm>" bir RESUME değildir: checkpoint geçmişinden çatallanma ayrı bir istektir
    // ve graf içinden yapılmaz (T3-3). Sürücü yanıtı burada o isteğe çevirir.
    const reTable = /^re-table:(.+)$/i.exec(String(yanit));
    if (reTable) {
      const hedef = reTable[1].trim();
      console.log(`  re-table: "${hedef}" dugumunden yeniden kosuluyor; onceki cagrilar korunur\n`);
      gunlukYaz({ type: "re-table", gate: durak.gate, dugum: hedef });
      durak = await gonder({ threadId, reTableToNode: hedef });
      continue;
    }
    durak = await gonder({ threadId, resume: yanit });
  }

  const sureMs = Date.now() - t0;
  const yavaslar = [...sure.dugum.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (durak?.type === "done") {
    console.log(`\n${"=".repeat(72)}\nOTURUM BITTI`);
    console.log(`  mod        : ${durak.runnerMode}`);
    console.log(`  cagri      : ${durak.metrics.callCount}`);
    console.log(`  maliyet    : $${durak.metrics.costUsd} (bilinmeyen ${durak.metrics.costUnknownCalls} cagri)`);
    console.log(`  basarisiz  : ${durak.metrics.failedAttempts} deneme, karsiliksiz $${(durak.metrics.failedCostNanoUsd / 1e9).toFixed(6)}`);
    console.log(
      `  arama      : ${durak.metrics.searchCalls} sorgu, ${durak.metrics.searchResults ?? 0} sonuc, ` +
        `$${(durak.metrics.searchCostNanoUsd / 1e9).toFixed(6)} (toplama dahil)`,
    );
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

  // Çıkış kodu sözleşmesi (C-6): çökme 1, sebepli duruş 4, temiz bitiş 0.
  if (hataOlayi) {
    console.log(`  cikis      : 1 (dugum coktu; --devam ile kurtarilabilir)`);
    process.exitCode = 1;
  } else if (durak?.type === "done" && durak.reason) {
    console.log(`  cikis      : 4 (sebepli durus)`);
    process.exitCode = 4;
  }
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
