// Muhafız (M2-C-2): arama eklentisi doğru çağrılara ekleniyor mu, kap tutuyor mu?
//
// GEREKÇE-KANITI: önce eklentisiz isteğin ne demek olduğu gösterilir (F4 denetiminde arama YOK,
// yani §6.2'nin "doğrulanmış" rozeti hiç hak edilemez), sonra eklentinin geldiği.
//
// 7 ve 9 Eylül koşumları bu boşluğun sonucunu ölçtü: 7 Eylül'de hiçbir iddia "doğrulanmış"
// demedi (kural hiç devreye girmedi), 9 Eylül'de bir iddia hafızadan yazılmış bir URL ile rozeti
// aldı. Arama kodda yoktu.

import assert from "node:assert";
import { aramaKarari, ARAMALI_FAZLAR, buildRequest, fazAnahtari } from "./requestBuilder.ts";
import type { SeatRunInput } from "./seatRunner.ts";

const girdi = (phase: string, ek: Partial<SeatRunInput> = {}): SeatRunInput => ({
  phase,
  idea: "fikir",
  ...ek,
});

const kur = (seatId: string, input: SeatRunInput, fazdaYapilanArama = 0, perPhaseCap = 3) =>
  buildRequest({ seatId, input, system: "sistem", user: "kullanici", fazdaYapilanArama, perPhaseCap, maxResults: 5 });

// 1) KIRMIZI: eklenti kararı olmadan istek ne taşırdı? Hiçbir şey. Denetim çağrısı aramasız gider
//    ve "doğrulanmış" rozeti kaynaksız verilir. Ölçülen hal buydu.
{
  const eklentisiz = { system: "sistem", user: "kullanici" } as { plugins?: unknown };
  assert.strictEqual(eklentisiz.plugins, undefined, "eski istekte plugins yoktu (kirmizinin kendisi)");
}

// 2) YEŞİL: Denetçi'nin F4 denetimi aramalı, engine SABİT exa.
{
  const istek = kur("auditor", girdi("F4:audit"));
  assert.ok(istek.plugins, "F4 denetiminde eklenti olmali");
  assert.strictEqual(istek.plugins?.length, 1);
  assert.strictEqual(istek.plugins?.[0].id, "web");
  assert.strictEqual(istek.plugins?.[0].engine, "exa", "engine SABIT exa: native sifir annotation donduruyor");
  assert.strictEqual(istek.plugins?.[0].max_results, 5);
  assert.strictEqual(istek.aramaAtlandi, undefined, "atlama sebebi olmamali");
}

// 3) Kapsam ikili şarttır: koltuk yetkisi VE faz. Biri eksikse arama yok.
{
  // Mimar F4 fizibilitede konuşur ama web yetkisi yok (DESIGN §4).
  assert.strictEqual(kur("architect", girdi("F4:feasibility")).plugins, undefined, "yetkisiz koltuk aramaz");
  // Müh-1'in yetkisi var ama F2 arama fazı değil: yetki tek başına yetmezse kap bir fazda tükenir.
  assert.strictEqual(kur("engineer1", girdi("F2:idea")).plugins, undefined, "arama fazi olmayan fazda aramaz");
  // İkisi birden: Müh-1 ve Müh-2 F4 fizibilitede arar.
  assert.ok(kur("engineer1", girdi("F4:feasibility")).plugins, "Muh-1 F4 fizibilitede aramali");
  assert.ok(kur("engineer2", girdi("F4:feasibility")).plugins, "Muh-2 F4 fizibilitede aramali");
  // Final topraklama denetimi de aramalı (§6.2 kapsam).
  assert.ok(kur("auditor", girdi("F5:output")).plugins, "final denetim aramali");
  // Küçük kurul denetimi de.
  assert.ok(kur("auditor", girdi("F4s:audit")).plugins, "kucuk kurul denetimi aramali");
}

// 4) İADE çağrısı YENİ ARAMA YAPMAZ ve bu SESSİZ geçilmez.
{
  const iade = kur("auditor", girdi("F4:audit", { retry: 1 }));
  assert.strictEqual(iade.plugins, undefined, "iade cagrisi yeniden aramamali");
  assert.ok(String(iade.aramaAtlandi).includes("iade"), `sebep yazili olmali: ${iade.aramaAtlandi}`);
}

// 5) FAZ KAPI: kap dolunca eklenti eklenmez ve sebep kayda girer (D-8 mantığı).
{
  const doluDegil = kur("auditor", girdi("F4:audit"), 2, 3);
  assert.ok(doluDegil.plugins, "kap dolmadan arama yapilir");

  const dolu = kur("auditor", girdi("F4:audit"), 3, 3);
  assert.strictEqual(dolu.plugins, undefined, "kap dolunca arama yapilmaz");
  assert.ok(String(dolu.aramaAtlandi).includes("kap"), `sebep kapi anmali: ${dolu.aramaAtlandi}`);
  assert.ok(String(dolu.aramaAtlandi).includes("3"), "sebep kap degerini soylemeli");

  // Kap sıfırsa hiç arama yapılmaz: kapatma yolu açık ve sebebi yine yazılı.
  const kapali = kur("auditor", girdi("F4:audit"), 0, 0);
  assert.strictEqual(kapali.plugins, undefined);
  assert.ok(String(kapali.aramaAtlandi).includes("kap"));
}

// 6) Faz kümesi DESIGN §6.2 kapsamıyla birebir; sessizce genişlemesin.
{
  assert.deepStrictEqual(
    [...ARAMALI_FAZLAR].sort(),
    ["F4:audit", "F4:feasibility", "F4s:audit", "F5:output"],
    "arama fazlari kumesinin sessizce buyumesi para harcar",
  );
}

// 7) Mesajlar olduğu gibi taşınır: bu modül metin KURMAZ, isteğin geri kalanını ekler.
{
  const istek = kur("auditor", girdi("F4:audit"));
  assert.strictEqual(istek.system, "sistem");
  assert.strictEqual(istek.user, "kullanici");
}

// 8) `aramaKarari` yetkisiz koltukta SEBEP üretmez: "arama yapılmadı" ile "arama yapılamazdı"
//    farklı şeyler; her çağrıya sebep yazmak kaydı gürültüye boğardı.
{
  assert.strictEqual(aramaKarari("visionary", girdi("F4:audit"), 0, 3).sebep, undefined);
  assert.strictEqual(aramaKarari("auditor", girdi("F4:audit"), 9, 3).sebep !== undefined, true);
}

// 9) FAZ KAPI ANAHTARI (D-3): kap FAZ basinadir, faz DIZESI basina degil.
//
//    KIRMIZI: sayac "F4:feasibility" ve "F4:audit" icin AYRI sayardi, yani F4'te fizibilitenin
//    iki aramasi denetimin sayacini hic etkilemezdi ve kap pratikte hic dolmazdi.
{
  assert.strictEqual(fazAnahtari("F4:feasibility"), "F4");
  assert.strictEqual(fazAnahtari("F4:audit"), "F4", "ayni fazin iki isi TEK kapi paylasir");
  assert.strictEqual(fazAnahtari("F4s:audit"), "F4s", "kucuk kurul ayri bir yoldur, kapisi da ayri");
  assert.notStrictEqual(fazAnahtari("F4:audit"), fazAnahtari("F4s:audit"));

  // F4'te fizibilite 2 + denetim 1 = 3; kap 3 ile DORDUNCU aramali cagri reddedilir.
  const kap = 3;
  assert.ok(kur("engineer1", girdi("F4:feasibility"), 0, kap).plugins, "1. arama gecer");
  assert.ok(kur("engineer2", girdi("F4:feasibility"), 1, kap).plugins, "2. arama gecer");
  assert.ok(kur("auditor", girdi("F4:audit"), 2, kap).plugins, "3. arama gecer (ayni faz sayaci)");
  const dorduncu = kur("auditor", girdi("F4:audit"), 3, kap);
  assert.strictEqual(dorduncu.plugins, undefined, "4. aramali cagri kapiya carpar");
  assert.ok(String(dorduncu.aramaAtlandi).includes("kap"));
}

console.log("REQUEST_BUILDER_TEST_OK: arama kapsami, engine sabit exa, iade aramaz, faz kapi FAZ basina");
