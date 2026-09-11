// Muhafız (M2-A3 T4-2): DESIGN §4 kadro kuralı. Aynı model iki koltukta oturamaz.
//
// GEREKÇE-KANITI: kural bir tercih değil, bir ÖLÇÜMÜN sonucu. 9 Eylül koşumunda Müh-1 ve Denetçi
// aynı modeli (claude-sonnet-5) kullanıyordu ve F5 sıralamalarının kosinüs benzerliği 0.86 çıktı;
// aynı fazdaki diğer çiftler 0.10 ile 0.19 arasındaydı. İki koltuk birbirini görmüyor olsa bile
// aynı model aynı girdiye çok benzer cevap veriyor, yani "bağımsız iki ses" orada sahiden yok.
// Test önce kuralsız halin böyle bir kurulu KABUL ettiğini gösterir, sonra kuralın reddettiğini.

import assert from "node:assert";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "./load.ts";
import { SEAT_IDS } from "../seats/seats.ts";

const DIZIN = mkdtempSync(join(tmpdir(), "divan-config-"));

/** Yedi koltuğu doldurur; `esle` ile istenen koltuklara aynı model verilebilir. */
function yaz(ad: string, esle: Record<string, string> = {}, ekstra: Record<string, unknown> = {}): string {
  const seats: Record<string, { model: string; fallbacks: string[] }> = {};
  for (const id of SEAT_IDS) {
    seats[id] = { model: esle[id] ?? `saglayici/${id}-model`, fallbacks: [`saglayici/${id}-yedek`] };
  }
  const yol = join(DIZIN, `${ad}.json`);
  writeFileSync(
    yol,
    JSON.stringify({
      seats,
      budget: { maxCalls: 30 },
      search: { perPhaseCap: 3 },
      timeouts: { perCallMs: 120000 },
      limits: { schemaMaxTokens: 8192, textMaxTokens: 6000 },
      ...ekstra,
    }),
    "utf8",
  );
  return yol;
}

// 1) KIRMIZI: kural OLMASAYDI ne geçerdi? Aynı modelli iki koltuk, şema açısından kusursuz bir
//    config. Şemayı geçiyor olması onu doğru yapmıyordu; kuralı taşıyan yer şema değil.
{
  const cakisan = yaz("cakisan", { engineer1: "x/ayni", auditor: "x/ayni" });
  // Ham JSON'u tekrar okumak: şema seviyesinde hiçbir sorun yok, koltuklar tam ve tipler doğru.
  const semaGecerli = JSON.parse(readFileSync(cakisan, "utf8")) as { seats: Record<string, { model: string }> };
  assert.strictEqual(Object.keys(semaGecerli.seats).length, SEAT_IDS.length, "yedi koltuk da dolu");
  assert.strictEqual(semaGecerli.seats.engineer1.model, semaGecerli.seats.auditor.model, "iki koltuk ayni model");
}

// 2) YEŞİL: kural bunu reddeder ve NEDEN reddettiğini söyler.
{
  const cakisan = yaz("cakisan2", { engineer1: "x/ayni", auditor: "x/ayni" });
  assert.throws(
    () => loadConfig(cakisan),
    (e: Error) => {
      assert.ok(e.message.includes("kadro kuralını ihlal"), `kural adiyla anilmali: ${e.message}`);
      assert.ok(e.message.includes("x/ayni"), "hangi model cakisiyor soylenmeli");
      assert.ok(e.message.includes("engineer1") && e.message.includes("auditor"), "hangi koltuklar soylenmeli");
      assert.ok(e.message.includes("kadroIstisnasi"), "kacis yolu soylenmeli");
      return true;
    },
  );
}

// 3) İSTİSNA: beyan VARSA geçer. Beyan bir bayrak değil METİNDİR; "true" yazan bir alan kuralı
//    neden deldiğini kimseye söylemez ve deney kolu ile hatalı config'i ayırt edilemez kılar.
{
  const yol = yaz("istisnali", { engineer1: "x/ayni", auditor: "x/ayni" }, { kadroIstisnasi: "Ayni-aile deney kolu, C-10 olcumu." });
  const c = loadConfig(yol);
  assert.strictEqual(c.kadroIstisnasi, "Ayni-aile deney kolu, C-10 olcumu.");

  // Boş ya da boşluktan ibaret beyan İSTİSNA DEĞİLDİR: gerekçesiz bir muafiyet muafiyet değildir.
  const bos = yaz("bos-beyan", { engineer1: "x/ayni", auditor: "x/ayni" }, { kadroIstisnasi: "   " });
  assert.throws(() => loadConfig(bos), /kadro kuralını ihlal/, "bosluktan ibaret beyan gecerli sayilmamali");
}

// 4) FALLBACK'LER KURALA GİRMEZ: kural hangi modelin KONUŞTUĞU hakkında, hangisinin yedekte
//    beklediği hakkında değil. İki koltuğun aynı yedeğe düşmesi bir arıza anıdır, kadro kararı
//    değil; oraya karışmak yedeksiz koltuk üretirdi.
{
  const yol = join(DIZIN, "ayni-yedek.json");
  const seats: Record<string, { model: string; fallbacks: string[] }> = {};
  for (const id of SEAT_IDS) seats[id] = { model: `saglayici/${id}-model`, fallbacks: ["x/ortak-yedek"] };
  writeFileSync(
    yol,
    JSON.stringify({
      seats,
      budget: { maxCalls: 30 },
      search: { perPhaseCap: 3 },
      timeouts: { perCallMs: 120000 },
      limits: { schemaMaxTokens: 8192, textMaxTokens: 6000 },
    }),
    "utf8",
  );
  assert.doesNotThrow(() => loadConfig(yol), "ayni fallback kurali ihlal etmez");
}

// 5) Repodaki iki config de kendi kuralına uyuyor: ana config çakışmasız, deney kolu beyanlı.
{
  const ana = loadConfig(join(process.cwd(), "divan.config.json"));
  const modeller = Object.values(ana.seats).map((s) => s.model);
  assert.strictEqual(new Set(modeller).size, modeller.length, "ana config'te ayni model iki koltukta olmamali");
  assert.ok(!ana.kadroIstisnasi, "ana config'in istisnaya ihtiyaci olmamali");

  const kol = loadConfig(join(process.cwd(), "eval", "divan.config.claude.json"));
  assert.ok((kol.kadroIstisnasi ?? "").length > 40, "deney kolu gerekcesini yazmali, bayrak koymamali");
}

console.log("CONFIG_TEST_OK: ayni model iki koltukta olamaz, istisna METINLE beyan edilir");
