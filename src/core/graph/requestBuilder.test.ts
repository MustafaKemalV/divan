// Muhafız (M2-C-2): arama eklentisi doğru çağrılara ekleniyor mu, kap tutuyor mu?
//
// GEREKÇE-KANITI: önce eklentisiz isteğin ne demek olduğu gösterilir (F4 denetiminde arama YOK,
// yani §6.2'nin "doğrulanmış" rozeti hiç hak edilemez), sonra eklentinin geldiği.
//
// 7 ve 9 Eylül koşumları bu boşluğun sonucunu ölçtü: 7 Eylül'de hiçbir iddia "doğrulanmış"
// demedi (kural hiç devreye girmedi), 9 Eylül'de bir iddia hafızadan yazılmış bir URL ile rozeti
// aldı. Arama kodda yoktu.

import assert from "node:assert";
import { aramaKarari, ARAMA_FAZLARI, buildRequest, buildSystemContent, fazAnahtari } from "./requestBuilder.ts";
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

// 2) YEŞİL: eklenti YALNIZ arama çağrısına eklenir, engine SABİT exa.
{
  const istek = kur("auditor", girdi("F4:search"));
  assert.ok(istek.plugins, "arama cagrisinda eklenti olmali");
  assert.strictEqual(istek.plugins?.length, 1);
  assert.strictEqual(istek.plugins?.[0].id, "web");
  assert.strictEqual(istek.plugins?.[0].engine, "exa", "engine SABIT exa: native sifir annotation donduruyor");
  assert.strictEqual(istek.plugins?.[0].max_results, 5);
  assert.strictEqual(istek.aramaAtlandi, undefined, "atlama sebebi olmamali");
}

// 3) KIRMIZI: eskiden eklenti DENETİM çağrısının kendisine ekleniyordu ve sorguyu prompt'un
//    tamamından türetiyordu. 15 Eylül probu bunun 35k karakterlik bir prompt'ta alakasız
//    sonuçlar getirdiğini ölçtü (başkalarının aynı adlı repoları).
{
  assert.strictEqual(kur("auditor", girdi("F4:audit")).plugins, undefined, "denetim cagrisi ARTIK aramaz");
  assert.strictEqual(kur("engineer1", girdi("F4:feasibility")).plugins, undefined, "fizibilite M2-C'de aramaz");
  assert.strictEqual(kur("auditor", girdi("F5:output")).plugins, undefined, "final denetim M2-C'de aramaz");
  assert.strictEqual(kur("auditor", girdi("F2:idea")).plugins, undefined, "arama fazi olmayan fazda aramaz");
  // Yetkisiz koltuk arama fazında bile aramaz: kapsam kuralı yetkiyi de sorar.
  assert.strictEqual(kur("architect", girdi("F4:search")).plugins, undefined, "yetkisiz koltuk aramaz");
  // Küçük kurul yolunun arama fazı da açık.
  assert.ok(kur("auditor", girdi("F4s:search")).plugins, "kucuk kurul arama fazi acik");
}

// 4) İade çağrısına AYRI KURAL GEREKMİYOR: iade F4:audit fazındadır, arama fazı değil.
//    Kural yapıdan çıkıyor, ayrı bir koşuldan değil.
{
  assert.strictEqual(kur("auditor", girdi("F4:audit", { retry: 1 })).plugins, undefined, "iade aramaz");
}

// 5) FAZ KAPI: kap dolunca eklenti eklenmez ve sebep kayda girer (D-8 mantığı).
{
  const doluDegil = kur("auditor", girdi("F4:search"), 2, 3);
  assert.ok(doluDegil.plugins, "kap dolmadan arama yapilir");

  const dolu = kur("auditor", girdi("F4:search"), 3, 3);
  assert.strictEqual(dolu.plugins, undefined, "kap dolunca arama yapilmaz");
  assert.ok(String(dolu.aramaAtlandi).includes("kap"), `sebep kapi anmali: ${dolu.aramaAtlandi}`);
  assert.ok(String(dolu.aramaAtlandi).includes("3"), "sebep kap degerini soylemeli");

  // Kap sıfırsa hiç arama yapılmaz: kapatma yolu açık ve sebebi yine yazılı.
  const kapali = kur("auditor", girdi("F4:search"), 0, 0);
  assert.strictEqual(kapali.plugins, undefined);
  assert.ok(String(kapali.aramaAtlandi).includes("kap"));
}

// 6) Faz kümesi DESIGN §6.2 kapsamıyla birebir; sessizce genişlemesin.
{
  assert.deepStrictEqual(
    [...ARAMA_FAZLARI].sort(),
    ["F4:search", "F4s:search"],
    "arama YALNIZ kodun yaptigi kisa cagridadir; kumenin buyumesi eski hataya doner",
  );
}

// 7) Mesajlar olduğu gibi taşınır: bu modül metin KURMAZ, isteğin geri kalanını ekler.
{
  const istek = kur("auditor", girdi("F4:search"));
  assert.strictEqual(istek.system, "sistem");
  assert.strictEqual(istek.user, "kullanici");
}

// 8) `aramaKarari` yetkisiz koltukta SEBEP üretmez: "arama yapılmadı" ile "arama yapılamazdı"
//    farklı şeyler; her çağrıya sebep yazmak kaydı gürültüye boğardı.
{
  assert.strictEqual(aramaKarari("visionary", girdi("F4:search"), 0, 3).sebep, undefined);
  assert.strictEqual(aramaKarari("auditor", girdi("F4:search"), 9, 3).sebep !== undefined, true);
}

// 9) FAZ KAPI ANAHTARI (D-3): kap FAZ basinadir, faz DIZESI basina degil.
//
//    KIRMIZI: sayac "F4:feasibility" ve "F4:audit" icin AYRI sayardi, yani F4'te fizibilitenin
//    iki aramasi denetimin sayacini hic etkilemezdi ve kap pratikte hic dolmazdi.
{
  assert.strictEqual(fazAnahtari("F4:search"), "F4");
  assert.strictEqual(fazAnahtari("F4:audit"), "F4", "ayni fazin isleri TEK kapi paylasir");
  assert.strictEqual(fazAnahtari("F4s:search"), "F4s", "kucuk kurul ayri bir yoldur, kapisi da ayri");
  assert.notStrictEqual(fazAnahtari("F4:search"), fazAnahtari("F4s:search"));

  // F4'te fizibilite 2 + denetim 1 = 3; kap 3 ile DORDUNCU aramali cagri reddedilir.
  const kap = 3;
  assert.ok(kur("auditor", girdi("F4:search"), 0, kap).plugins, "1. arama gecer");
  assert.ok(kur("auditor", girdi("F4:search"), 1, kap).plugins, "2. arama gecer");
  assert.ok(kur("auditor", girdi("F4:search"), 2, kap).plugins, "3. arama gecer (ayni faz sayaci)");
  const dorduncu = kur("auditor", girdi("F4:search"), 3, kap);
  assert.strictEqual(dorduncu.plugins, undefined, "4. aramali cagri kapiya carpar");
  assert.ok(String(dorduncu.aramaAtlandi).includes("kap"));
}

// 10) ORTAK ÖN EK (M2-C-5, SEÇENEK A). Önbelleğin işe yaraması için bir koltuğun FARKLI
//     fazlarındaki istekler BAYT BAYT aynı bir ön ekle başlamalı.
//
//     KIRMIZI: eski sırada sistem mesajı kimlik + faz talimatıydı ve zarf/fikir kullanıcı
//     mesajındaydı. Ortak ön ek yalnız KİMLİK kadardı; 12 Eylül probunda önbelleğin çalıştığı en
//     kısa ölçülmüş uzunluk 2.316 tokendi (~9.000 karakter) ve kimlik metinleri onun çok altında.
{
  const kimlik = "Sen Divan'in Denetcisi'sin. ".repeat(20); // ~540 karakter: gercek kimlik dosyalari bu mertebede
  const zarfFikirEk = "OTURUM ZARFI ve FIKIR ve EK OZETI. ".repeat(300); // ~10.500 karakter
  const f4 = "F4 denetim talimati.";
  const f5 = "F5 final denetim talimati.";

  const ortakOnEk = (a: string, b: string) => {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
  };

  // ESKI sira: sistem = kimlik + faz talimati. Ortak on ek kimlik kadar.
  const eskiF4 = `${kimlik}\n\n---\n\n${f4}`;
  const eskiF5 = `${kimlik}\n\n---\n\n${f5}`;
  assert.ok(
    ortakOnEk(eskiF4, eskiF5) < 1000,
    `eski sirada ortak on ek kimlik kadar kaliyordu: ${ortakOnEk(eskiF4, eskiF5)} karakter`,
  );

  // YENI sira, Anthropic DISI model: tek metin ama sira ayni; ortak on ek kimlik + zarf/fikir/ek.
  const yeniF4 = buildSystemContent({ model: "openai/gpt-5.1", kimlik, zarfFikirEk, fazTalimati: f4 }) as string;
  const yeniF5 = buildSystemContent({ model: "openai/gpt-5.1", kimlik, zarfFikirEk, fazTalimati: f5 }) as string;
  assert.strictEqual(typeof yeniF4, "string", "Anthropic disi modelde duz metin gider");
  assert.ok(
    ortakOnEk(yeniF4, yeniF5) > 10_000,
    `yeni sirada ortak on ek zarf+fikir+ek kadar: ${ortakOnEk(yeniF4, yeniF5)} karakter`,
  );

  // YENI sira, Anthropic: parcali icerik. Ilk ISARETE kadar olan blok BAYT BAYT ayni.
  const antF4 = buildSystemContent({ model: "anthropic/claude-sonnet-5", kimlik, zarfFikirEk, fazTalimati: f4 });
  const antF5 = buildSystemContent({ model: "anthropic/claude-sonnet-5", kimlik, zarfFikirEk, fazTalimati: f5 });
  assert.ok(Array.isArray(antF4) && Array.isArray(antF5), "Anthropic'te parcali icerik");
  const p4 = antF4 as { type: string; text: string; cache_control?: unknown }[];
  const p5 = antF5 as { type: string; text: string; cache_control?: unknown }[];
  assert.strictEqual(p4.length, 3, "kimlik + zarf/fikir/ek + faz talimati");
  assert.deepStrictEqual(p4.slice(0, 2), p5.slice(0, 2), "ilk isarete kadar olan blok BAYT BAYT ayni");
  assert.notDeepStrictEqual(p4[2], p5[2], "faz talimati isaretten SONRA ve fazlar arasi farkli");

  // Iki isaret: (2)'nin ve (3)'un sonunda. Birincisi fazlar arasi, ikincisi ayni fazin iadesi icin.
  assert.strictEqual(p4[0].cache_control, undefined, "kimlik tek basina isaretlenmez, zarfla birlikte onbelleklenir");
  assert.deepStrictEqual(p4[1].cache_control, { type: "ephemeral" });
  assert.deepStrictEqual(p4[2].cache_control, { type: "ephemeral" });
}

// 11) Zarfsız çağrı (F0 brifingi): boş blok İŞARETLENMEZ, çünkü işaretlenecek bir ön ek yok.
{
  const parcalar = buildSystemContent({
    model: "anthropic/claude-sonnet-5",
    kimlik: "kimlik",
    zarfFikirEk: "   ",
    fazTalimati: "faz",
  }) as { text: string }[];
  assert.strictEqual(parcalar.length, 2, "bos zarf blogu hic eklenmez");
}

console.log("REQUEST_BUILDER_TEST_OK: arama kapsami + faz kapi + katman sirasi (ortak on ek bayt bayt ayni)");
