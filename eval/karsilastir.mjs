#!/usr/bin/env node
/**
 * Deney kolu karşılaştırma aracı (ÖLÇÜM ARACI, mekanizma değil).
 *
 *   node eval/karsilastir.mjs oturum-ciktisi/<kol-a>.jsonl oturum-ciktisi/<kol-b>.jsonl
 *
 * Neden var: iki kolu "şuna baktım, bu daha iyi görünüyor" diye kıyaslamak ölçüm değildir. Bu
 * araç ham olay günlüğünden (JSONL) tekrar edilebilir sayılar çıkarır: koltuk başına maliyet,
 * faz içi görüş benzerliği, denetimin kanıt etiketleri, hüküm sayımı, ve kayda GİRMEYEN çağrılar.
 * Aynı dosyayla iki kez koşarsa aynı sonucu verir; bir iddia buradan çıkmadıysa ölçülmemiştir.
 *
 * Sınırları açıkça yazılı, çünkü ölçüm aracının kendisi de kanıt disiplinine tabidir:
 *
 *  - BENZERLİK KOSİNÜS BENZERLİĞİDİR (kelime frekans vektörleri, Türkçe küçük harf, noktalama
 *    atılır). Anlamı değil KELİME ÖRTÜŞMESİNİ ölçer: aynı konuda yazan iki koltuk zaten yüksek
 *    çıkar. Kollar arası KARŞILAŞTIRMA için anlamlıdır, mutlak bir "konformite" eşiği olarak
 *    değil. Ölçünün seçimi sonucun büyüklüğünü değiştirir (Jaccard aynı veride üç kat düşük
 *    sayılar verir); bu yüzden bir sayı yazılırken hangi ölçü olduğu da yazılmalıdır.
 *  - n=1. İki koşum bir eğilim göstermez, bir gözlem verir.
 *  - Terk edilen dallar (re-table'dan önce koşup atılan çağrılar) HEM ayrı gösterilir HEM de
 *    benzerlik hesabından çıkarılır: atılmış bir görüş kurulun görüşü değildir.
 */

import { readFileSync } from "node:fs";

const dosyalar = process.argv.slice(2);
if (dosyalar.length === 0) {
  console.error("Kullanim: node eval/karsilastir.mjs <oturum.jsonl> [<oturum.jsonl> ...]");
  process.exit(2);
}

const usd = (nano) => `$${(nano / 1e9).toFixed(6)}`;
const yuzde = (pay, toplam) => (toplam ? `${((pay / toplam) * 100).toFixed(1)}%` : "-");

/** Kelime frekans vektörü. Türkçe küçük harf, noktalama atılır, sayılar kalır. */
function vektor(metin) {
  const v = new Map();
  for (const w of String(metin).toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/)) {
    if (w) v.set(w, (v.get(w) ?? 0) + 1);
  }
  return v;
}

function kosinus(a, b) {
  let nokta = 0;
  let na = 0;
  let nb = 0;
  for (const [k, x] of a) {
    na += x * x;
    const y = b.get(k);
    if (y) nokta += x * y;
  }
  for (const [, y] of b) nb += y * y;
  return na && nb ? nokta / Math.sqrt(na * nb) : 0;
}

function oku(yol) {
  const olaylar = readFileSync(yol, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  // Her çağrıya, kaydedildiği olayın zaman damgası iliştirilir: terk edilen dalı ancak zamanla
  // ayırt edebiliriz (re-table'dan ÖNCE koşan çağrılar atılmıştır).
  const cagrilar = olaylar.flatMap((e) => (e.calls ?? []).map((c) => ({ ...c, t: e.t })));
  const kayitlar = olaylar.flatMap((e) => e.entries ?? []);
  return { yol, olaylar, cagrilar, kayitlar };
}

/**
 * Terk edilen dal: re-table sonrası aynı fazın yeniden koşması, önceki çağrıları GEÇERSİZ kılar
 * ama faturayı silmez. Ayırt etme ölçütü ZAMAN: re-table olayından önce kaydedilmiş çağrılar
 * atılmıştır. (Sayı tahminiyle ayırmak denenmişti; iki dalganın kayıt sayısı tesadüfen eşit
 * olduğunda doğru sonuç veriyordu, yani doğru olduğu için değil şanslı olduğu için çalışıyordu.)
 */
function terkEdilen(o) {
  const reTable = o.olaylar.filter((e) => e.type === "re-table");
  if (reTable.length === 0) return { cagrilar: [], nano: 0, dugumler: [] };
  // Re-table hedef düğümün ÖNCESİNDEN sürer: o düğümün fazında, re-table anından ÖNCE kaydedilmiş
  // her çağrı atılmıştır. Zaman damgasına bakmak, sayı tahmininden sağlamdır.
  const atilan = [];
  const dugumler = [];
  for (const r of reTable) {
    const dugum = String(r.dugum);
    dugumler.push(dugum);
    const faz = dugum.replace(/^f(\d)s?_/, (_m, n) => `F${n}:`).toLowerCase();
    const an = new Date(r.t).getTime();
    for (const c of o.cagrilar) {
      if (!c.phase.toLowerCase().startsWith(faz)) continue;
      if (new Date(c.t).getTime() < an && !atilan.includes(c)) atilan.push(c);
    }
  }
  return { cagrilar: atilan, nano: atilan.reduce((n, c) => n + (c.costNanoUsd ?? 0), 0), dugumler };
}

function kunye(o) {
  const done = [...o.olaylar].reverse().find((e) => e.type === "done");
  const bitti = [...o.olaylar].reverse().find((e) => e.type === "oturum-bitti");
  const nano = o.cagrilar.reduce((n, c) => n + (c.costNanoUsd ?? 0), 0);
  const token = o.cagrilar.reduce((n, c) => n + (c.promptTokens ?? 0) + (c.completionTokens ?? 0), 0);
  const cache = o.cagrilar.reduce((n, c) => n + (c.cachedTokens ?? 0), 0);
  const cacheWrite = o.cagrilar.reduce((n, c) => n + (c.cacheWriteTokens ?? 0), 0);
  // Arama: yalnız eklenti istenen çağrılarda kayıt var (searchCostNanoUsd tanımlıysa).
  const aramali = o.cagrilar.filter((c) => c.searchCostNanoUsd !== undefined);
  const aramaNano = aramali.reduce((n, c) => n + (c.searchCostNanoUsd ?? 0), 0);
  const aramaSonuc = aramali.reduce((n, c) => n + (c.searchResultCount ?? 0), 0);
  return { done, bitti, nano, token, cache, cacheWrite, aramaCagri: aramali.length, aramaNano, aramaSonuc };
}

/** Cevabı gelmemiş ya da kesilmiş deneme: servedModel yok, ama fatura var. */
const basarisizlar = (o) => o.cagrilar.filter((c) => !c.servedModel);

function denetimEtiketleri(o) {
  const den = o.kayitlar.filter((k) => k.phase.endsWith(":audit"));
  const satirlar = den.flatMap((d) => String(d.content).split("\n")).filter((l) => /^-\s+\w[\w-]*\s+\|/.test(l));
  const sayim = {};
  let urlli = 0;
  for (const l of satirlar) {
    const [, etiket] = /^-\s+([\w-]+)\s+\|/.exec(l);
    sayim[etiket] = (sayim[etiket] ?? 0) + 1;
    if (/https?:\/\//.test(l)) urlli++;
  }
  return { toplam: satirlar.length, sayim, urlli, denetimSayisi: den.length };
}

function hukumSayimi(o) {
  const turlar = o.kayitlar.filter((k) => k.phase.endsWith(":judgment"));
  const son = turlar.at(-1);
  const satirlar = String(son?.content ?? "").split("\n").filter((l) => /^-\s+.+:\s+(karsilandi|kismen|karsilanmadi)/.test(l));
  const sayim = { karsilandi: 0, kismen: 0, karsilanmadi: 0, blocking: 0 };
  for (const l of satirlar) {
    const [, durum] = /:\s+(karsilandi|kismen|karsilanmadi)/.exec(l);
    sayim[durum]++;
    if (l.includes("[BLOCKING]")) sayim.blocking++;
  }
  return { turSayisi: turlar.length, kriter: satirlar.length, sayim };
}

function benzerlik(o, faz) {
  let grup = o.kayitlar.filter((k) => k.phase === faz);
  // Terk edilen dal benzerliğe GİRMEZ: atılmış bir görüş kurulun görüşü değildir. Bir fazda aynı
  // koltuk birden çok kez görünüyorsa son dalga geçerli olandır.
  const beklenen = new Set(grup.map((g) => g.seatId)).size;
  if (grup.length > beklenen) grup = grup.slice(-beklenen);
  const ciftler = [];
  for (let i = 0; i < grup.length; i++) {
    for (let j = i + 1; j < grup.length; j++) {
      ciftler.push([`${grup[i].seatId}/${grup[j].seatId}`, kosinus(vektor(grup[i].content), vektor(grup[j].content))]);
    }
  }
  const ortalama = ciftler.length ? ciftler.reduce((a, [, v]) => a + v, 0) / ciftler.length : 0;
  ciftler.sort((a, b) => b[1] - a[1]);
  return { n: grup.length, ortalama, ciftler };
}

function rapor(o) {
  const k = kunye(o);
  const terk = terkEdilen(o);
  console.log(`\n${"=".repeat(78)}\n${o.yol}\n${"=".repeat(78)}`);
  console.log(`Kayitli (state)   : ${k.done?.metrics.callCount ?? "-"} cagri, $${k.done?.metrics.costUsd ?? "-"}, ${k.done?.metrics.totalTokens ?? "-"} token`);
  console.log(`Olay gunlugu      : ${o.cagrilar.length} cagri, ${usd(k.nano)}, ${k.token} token`);
  if (terk.cagrilar.length) {
    console.log(`Terk edilen dal   : ${terk.cagrilar.length} cagri, ${usd(terk.nano)} (re-table: ${terk.dugumler.join(", ")}) -> STATE'E GIRMEDI`);
  }
  console.log(`Onbellek         : okunan ${k.cache} token, yazilan ${k.cacheWrite} token`);
  if (k.aramaCagri) {
    console.log(`Arama            : ${k.aramaCagri} sorgu, ${k.aramaSonuc} sonuc, ${usd(k.aramaNano)} (toplam maliyete DAHIL)`);
  }
  if (k.bitti) {
    console.log(`Sure              : toplam ${Math.round(k.bitti.sureMs / 1000)} sn = model ${Math.round(k.bitti.modelMs / 1000)} + kapida ${Math.round(k.bitti.kapiMs / 1000)}`);
  }
  console.log(`Revizyon turu     : ${k.done?.metrics.revisionRounds ?? "-"} | denetim tam: ${k.done?.metrics.auditComplete ?? "-"} | susan: ${(k.done?.silentSeats ?? []).join(",") || "yok"}`);

  const bas = basarisizlar(o);
  if (bas.length) {
    console.log(`\nCEVAPSIZ/KESILEN DENEME (servedModel yok, fatura VAR):`);
    for (const c of bas) {
      console.log(`  ${c.phase.padEnd(14)} ${c.seatId.padEnd(13)} deneme ${c.attempt}  ${usd(c.costNanoUsd ?? 0)}  cikti ${c.completionTokens} token`);
    }
  }

  console.log(`\nKOLTUK BASINA:`);
  const koltuk = new Map();
  for (const c of o.cagrilar) {
    const g = koltuk.get(c.seatId) ?? { cagri: 0, nano: 0, model: c.servedModel };
    g.cagri++;
    g.nano += c.costNanoUsd ?? 0;
    if (c.servedModel) g.model = c.servedModel;
    koltuk.set(c.seatId, g);
  }
  for (const [id, g] of [...koltuk].sort((a, b) => b[1].nano - a[1].nano)) {
    console.log(`  ${id.padEnd(13)} ${String(g.cagri).padStart(2)} cagri  ${usd(g.nano).padStart(11)}  ${yuzde(g.nano, k.nano).padStart(6)}  ${g.model ?? "-"}`);
  }

  const d = denetimEtiketleri(o);
  console.log(`\nDENETIM (${d.denetimSayisi} kayit): ${d.toplam} sinanmis iddia, ${d.urlli} tanesi URL'li`);
  for (const [e, n] of Object.entries(d.sayim)) console.log(`  ${e.padEnd(15)} ${n}`);

  const h = hukumSayimi(o);
  console.log(`\nHUKUM (${h.turSayisi} tur, son turda ${h.kriter} kriter): karsilandi ${h.sayim.karsilandi}, kismen ${h.sayim.kismen}, karsilanmadi ${h.sayim.karsilanmadi}, blocking ${h.sayim.blocking}`);

  console.log(`\nFAZ ICI BENZERLIK (kosinus; kelime ortusmesi, anlam degil):`);
  const benzer = {};
  for (const faz of ["F2:idea", "F3:cross", "F5:ranking"]) {
    const b = benzerlik(o, faz);
    if (!b.n) continue;
    benzer[faz] = b;
    console.log(`  ${faz.padEnd(11)} n=${b.n}  ortalama ${b.ortalama.toFixed(3)}  en yuksek ${b.ciftler[0][0]} ${b.ciftler[0][1].toFixed(2)}  en dusuk ${b.ciftler.at(-1)[0]} ${b.ciftler.at(-1)[1].toFixed(2)}`);
  }
  return { kunye: k, benzer, koltuk };
}

const sonuclar = dosyalar.map((f) => ({ yol: f, ...rapor(oku(f)) }));

if (sonuclar.length === 2) {
  const [a, b] = sonuclar;
  console.log(`\n${"=".repeat(78)}\nKARSILASTIRMA\n${"=".repeat(78)}`);
  console.log(`Maliyet (olay gunlugu): ${usd(a.kunye.nano)} -> ${usd(b.kunye.nano)}  (${((b.kunye.nano / a.kunye.nano - 1) * 100).toFixed(0)}%)`);
  console.log(`Token                 : ${a.kunye.token} -> ${b.kunye.token}`);
  console.log(`Onbellek okunan/yazilan: ${a.kunye.cache}/${a.kunye.cacheWrite} -> ${b.kunye.cache}/${b.kunye.cacheWrite}`);
  console.log(`Arama ucreti          : ${usd(a.kunye.aramaNano)} -> ${usd(b.kunye.aramaNano)}`);
  console.log(`\nFaz ici benzerlik (kosinus):`);
  for (const faz of ["F2:idea", "F3:cross", "F5:ranking"]) {
    if (!a.benzer[faz] || !b.benzer[faz]) continue;
    const fark = b.benzer[faz].ortalama - a.benzer[faz].ortalama;
    console.log(`  ${faz.padEnd(11)} ${a.benzer[faz].ortalama.toFixed(3)} -> ${b.benzer[faz].ortalama.toFixed(3)}  (${fark >= 0 ? "+" : ""}${fark.toFixed(3)})`);
  }
  console.log(`\nUYARI: n=1. Bu bir egilim degil, iki gozlem. Kollar arasinda kadro DISINDA degisen`);
  console.log(`her sey (tavan, re-table, kapi yanitlari) bir karistiricidir ve rapora yazilmalidir.`);
}
