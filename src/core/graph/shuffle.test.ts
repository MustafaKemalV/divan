// Muhafız (M2-C-4, DESIGN §6.1): kanonik sıra bir KONUM KANALIDIR ve kapatılır.
//
// GEREKÇE-KANITI: kimlikleri maskelemek yetmiyor. "Görüş 1..N" ve "Sıralayıcı 1..N" numaraları
// kanonik koltuk sırasında veriliyordu, yani numara sabit bir adresti: bir oturumda Sıralayıcı 2
// hep Müh-1, Sıralayıcı 3 hep Mimar. Bu bir kez fark edildiğinde maskeleme delinir ve 7 Eylül
// koşumunda Baş Danışman taslağında sıralayıcı numaralarını koltuklarla eşleştirerek yazdı.

import assert from "node:assert";
import { permutation, seedOf, shuffleBySeed } from "./shuffle.ts";

const SIRALAYICILAR = ["market", "engineer1", "architect", "auditor"] as const;

// 1) KIRMIZI: karıştırmasız hal. Denetçi'nin konumu HER oturumda aynı (4.), yani numara koltuğu
//    ele veriyor.
{
  const karistirmasiz = (_oturum: string) => [...SIRALAYICILAR];
  for (const oturum of ["oturum-A", "oturum-B", "oturum-C"]) {
    assert.strictEqual(
      karistirmasiz(oturum).indexOf("auditor"),
      3,
      "karistirmasiz halde Denetci her oturumda 4. sirada (kirmizinin kendisi)",
    );
  }
}

// 2) YEŞİL: iki farklı oturum farklı sıra verir.
{
  const a = shuffleBySeed(SIRALAYICILAR, "oturum-2026-09-07");
  const b = shuffleBySeed(SIRALAYICILAR, "oturum-2026-09-09");
  assert.notDeepStrictEqual(a, b, "iki oturum ayni sirayi vermemeli");
  // Karıştırma bir PERMÜTASYONDUR: hiçbir görüş düşmez, hiçbiri iki kez görünmez.
  assert.deepStrictEqual([...a].sort(), [...SIRALAYICILAR].sort(), "hicbir siralayici kaybolmamali");
  assert.deepStrictEqual([...b].sort(), [...SIRALAYICILAR].sort());
}

// 3) AYNI oturumda KARARLI: yoksa iki faz arasında "Görüş 2" başka biri olur ve kurul kendi
//    tartışmasını takip edemez.
{
  const bir = shuffleBySeed(SIRALAYICILAR, "oturum-X");
  const iki = shuffleBySeed(SIRALAYICILAR, "oturum-X");
  assert.deepStrictEqual(bir, iki, "ayni tohum ayni sirayi vermeli");
  // Farklı uzunlukta da kararlı (F2'de 4 görüş, F4'te 3 değerlendirme).
  assert.deepStrictEqual(permutation("oturum-X", 3), permutation("oturum-X", 3));
}

// 4) Denetçi'nin konumu oturumdan oturuma GEZİYOR. Tek bir oturumda farklı çıkması yetmez;
//    birçok oturumda birden çok konuma düşmeli, yoksa karıştırma bir yanılsamadır.
{
  const konumlar = new Set<number>();
  for (let i = 0; i < 40; i++) konumlar.add(shuffleBySeed(SIRALAYICILAR, `oturum-${i}`).indexOf("auditor"));
  assert.ok(konumlar.size >= 3, `Denetci en az uc farkli konumda gorulmeli, gorulen: ${[...konumlar]}`);
}

// 5) Sınır durumlar: boş ve tek elemanlı dizi. Karıştırma bir şeyi bozmamalı.
{
  assert.deepStrictEqual(shuffleBySeed([], "x"), []);
  assert.deepStrictEqual(shuffleBySeed(["tek"], "x"), ["tek"]);
  assert.deepStrictEqual(permutation("x", 0), []);
}

// 6) Tohum metinden türer ve kararlıdır; iki farklı metin (pratikte) iki farklı tohum verir.
{
  assert.strictEqual(seedOf("abc"), seedOf("abc"));
  assert.notStrictEqual(seedOf("oturum-A"), seedOf("oturum-B"));
}

// 7) Girdi DEĞİŞMEZ: karıştırma kopya üretir, kaynağı bozmaz. Kayıt (transkript) kanonik kalmalı.
{
  const kaynak = [...SIRALAYICILAR];
  shuffleBySeed(kaynak, "oturum-Y");
  assert.deepStrictEqual(kaynak, [...SIRALAYICILAR], "karistirma girdiyi bozmamali");
}

console.log("SHUFFLE_TEST_OK: konumsal anonimlik, oturumda kararli oturumlar arasinda farkli");
