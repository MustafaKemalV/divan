#!/usr/bin/env node
/**
 * Tek test zinciri (M2-A3 U-1). Bir komut, üç halka:
 *
 *   1. tsc --noEmit          (tip hatası bir testin düşmesi kadar ciddidir)
 *   2. bütün *.test.ts       (birim bekçileri; biri düşerse zincir düşer)
 *   3. npm run e2e           (uçtan uca kanıt koşusu)
 *
 * Neden var: commit kuralımız "test düşerse commit çalışmaz" diyordu ama kapıda yalnız e2e
 * vardı. On birim testi hiçbir komuta bağlı değildi ve tsc zincirde değildi; yani kural,
 * koruduğunu sandığı şeyin çoğunu korumuyordu.
 */

import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const KOK = process.cwd();

function testDosyalari(dizin) {
  const out = [];
  for (const ad of readdirSync(dizin)) {
    const yol = join(dizin, ad);
    if (statSync(yol).isDirectory()) out.push(...testDosyalari(yol));
    else if (ad.endsWith(".test.ts")) out.push(yol);
  }
  return out.sort();
}

function kos(etiket, komut, args) {
  process.stdout.write(`\n${"=".repeat(70)}\n${etiket}\n${"=".repeat(70)}\n`);
  const r = spawnSync(komut, args, { cwd: KOK, stdio: "inherit", env: process.env });
  return r.status === 0;
}

const dusenler = [];

if (!kos("1/3  tsc --noEmit", "npx", ["tsc", "--noEmit"])) dusenler.push("tsc");

const dosyalar = testDosyalari(join(KOK, "src"));
process.stdout.write(`\n${"=".repeat(70)}\n2/3  birim testleri (${dosyalar.length} dosya)\n${"=".repeat(70)}\n`);
for (const d of dosyalar) {
  const kisa = d.replace(KOK + "/", "");
  const r = spawnSync("node", [d], { cwd: KOK, encoding: "utf8", env: process.env });
  const ciktisi = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const ok = r.status === 0;
  if (!ok) dusenler.push(kisa);
  const isaret = ok ? "gecti" : "DUSTU";
  const ozet = (ciktisi.match(/[A-Z_]+_TEST_OK[^\n]*/) ?? [])[0] ?? "";
  console.log(`  ${isaret}  ${kisa}${ozet ? "  " + ozet : ""}`);
  if (!ok) console.log(ciktisi.split("\n").filter((l) => /Error|assert|Assertion/.test(l)).slice(0, 4).map((l) => "        " + l).join("\n"));
}

if (!kos("3/3  e2e", "npm", ["run", "e2e"])) dusenler.push("e2e");

console.log(`\n${"=".repeat(70)}`);
if (dusenler.length === 0) {
  console.log("TEST ZINCIRI: hepsi gecti (tsc + " + dosyalar.length + " birim + e2e)");
  process.exit(0);
}
console.log(`TEST ZINCIRI DUSTU: ${dusenler.join(", ")}`);
process.exit(1);
