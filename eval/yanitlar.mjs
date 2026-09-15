#!/usr/bin/env node
/**
 * Bir koşumun KAPI YANITLARINI kabuk için hazır basar (ÖLÇÜM ARACI, para harcamaz).
 *
 *   node eval/yanitlar.mjs oturum-ciktisi/<oturum>.jsonl
 *
 * Neden var: iki kolu karşılaştırmanın ön şartı, kapı yanıtlarının BİREBİR aynı olmasıdır. Aksi
 * halde kollar arasındaki fark kadrodan mı Şah'ın o gün yazdığı cümleden mi geldi bilinemez.
 * 9 Eylül koşumunda KAPI 3 yanıtı yerine "(ilk kosumla ayni karar metni, --yanit)" diye bir not
 * girildi; elle kopyalamanın yanılma payı orada göründü.
 *
 * Çıktısı doğrudan yapıştırılabilir:
 *
 *   npm run oturum -- fikir.txt --yanit KAPI1='...' --yanit KAPI2='...' --yanit KAPI3='...'
 *
 * Kaçırma tek tırnakla yapılır: POSIX kabuklarında tek tırnak içindeki her şey harfiyen geçer,
 * tek istisna tırnağın kendisidir ve o da '\'' kalıbıyla kapatılır. Çift tırnak kullanmak
 * $ ve ` karakterlerini kabuğa yorumlatırdı; karar metinleri onları içerebilir.
 */

import { readFileSync } from "node:fs";

const dosya = process.argv[2];
if (!dosya) {
  console.error("Kullanim: node eval/yanitlar.mjs <oturum.jsonl>");
  process.exit(2);
}

/** POSIX kabuk için tek tırnak kaçırması. */
function kacir(metin) {
  return `'${String(metin).replace(/'/g, `'\\''`)}'`;
}

const olaylar = readFileSync(dosya, "utf8")
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l));

// Aynı kapı birden çok kez cevaplanmış olabilir (re-table, yeniden koşum): SONUNCUSU geçerlidir,
// çünkü oturumu o yanıt sürdürdü.
const yanitlar = new Map();
for (const e of olaylar) {
  if (e.type === "sah-yaniti" && typeof e.gate === "string") yanitlar.set(e.gate, e.yanit);
}

if (yanitlar.size === 0) {
  console.error(`Bu gunlukte sah-yaniti kaydi yok: ${dosya}`);
  process.exit(1);
}

// Kapı sırası oturumun sırasıdır; tanınmayan kapılar (BUTCE, ERKEN_BRIFING) sonda ve uyarılı.
const bilinen = ["KAPI1", "KAPI2", "KAPI3"];
const digerleri = [...yanitlar.keys()].filter((k) => !bilinen.includes(k));

const bayraklar = bilinen
  .filter((k) => yanitlar.has(k))
  .map((k) => `--yanit ${k}=${kacir(yanitlar.get(k))}`);

console.log(`# ${dosya}`);
for (const k of bilinen) {
  if (!yanitlar.has(k)) console.log(`# UYARI: ${k} yaniti bu gunlukte YOK`);
}
for (const k of digerleri) {
  // Olay-tetikli kapılar koşuma özgüdür: aynı kapının ikinci koşumda açılacağı garanti değil,
  // o yüzden bayrak olarak basılmaz, yalnız görünür kılınır.
  console.log(`# NOT: olay-tetikli kapi ${k} = ${kacir(yanitlar.get(k))} (bayrak olarak basilmadi)`);
}
console.log(`\nnpm run oturum -- fikir.txt \\\n  ${bayraklar.join(" \\\n  ")}`);
