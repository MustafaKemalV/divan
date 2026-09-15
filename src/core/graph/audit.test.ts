// Denetim doğrulaması birim testi (DESIGN §6.3.1 + §6.2). Node native TS ile:
//   node src/core/graph/audit.test.ts
// Bu test bir MEKANİZMA BEKÇİSİDİR: zorunlu premortem, üç iddia alt sınırı ve kanıt etiketi
// şartlarından biri gevşetilirse burada düşer.

import assert from "node:assert";
import { normalizeQuote, validateAudit, MIN_AUDIT_CLAIMS, EVIDENCE_LABELS } from "./audit.ts";

const claim = (evidence: string, url = "") => ({
  claim: "dagitim maliyeti gelirden yuksek",
  evidence,
  source: "gerekce",
  url,
});
const ok = {
  summary: "denetim ozeti",
  premortem: "Bir yil sonra basarisiz olduk: dagitim maliyeti gelirden yuksek kaldi.",
  claims: [claim("dogrulanmis", "https://example.org/kaynak"), claim("model-bilgisi"), claim("varsayim")],
  weakestLink: "dagitim",
};

// 1) tam çıktı geçer
const r1 = validateAudit(ok);
assert.strictEqual(r1.ok, true);
if (r1.ok) assert.strictEqual(r1.audit.claims.length, 3);

// 2) premortem yoksa GEÇERSİZ (uyum derecesinden bağımsız zorunluluk)
assert.strictEqual(validateAudit({ ...ok, premortem: "" }).ok, false);
assert.strictEqual(validateAudit({ ...ok, premortem: "   " }).ok, false);

// 3) üç iddiadan az GEÇERSİZ
assert.strictEqual(validateAudit({ ...ok, claims: ok.claims.slice(0, MIN_AUDIT_CLAIMS - 1) }).ok, false);

// 4) etiketsiz veya tanınmayan etiketli iddia GEÇERSİZ (§6.2 kompozisyonu)
assert.strictEqual(
  validateAudit({ ...ok, claims: [claim("dogrulanmis", "https://x.org/a"), claim("kesin"), claim("varsayim")] }).ok,
  false,
);
assert.strictEqual(
  validateAudit({ ...ok, claims: [claim("dogrulanmis", "https://x.org/a"), { claim: "x", source: "" }, claim("varsayim")] }).ok,
  false,
);

// 4b) §6.2 ROZET KURALI: URL'siz "dogrulanmis" GEÇERSİZ (bu kuralı ilk gerçek çağrı tetikledi)
assert.strictEqual(validateAudit({ ...ok, claims: [claim("dogrulanmis"), claim("varsayim"), claim("varsayim")] }).ok, false);
// URL olmayan bir "kaynak" metni de rozet kazandırmaz
assert.strictEqual(
  validateAudit({ ...ok, claims: [claim("dogrulanmis", "Node.js dokumantasyonu"), claim("varsayim"), claim("varsayim")] }).ok,
  false,
);
// URL zorunluluğu YALNIZ dogrulanmis icin: diger etiketler URL'siz gecerlidir
assert.strictEqual(validateAudit({ ...ok, claims: [claim("model-bilgisi"), claim("varsayim"), claim("varsayim")] }).ok, true);

// 5) üç etiketin üçü de tanınır
for (const label of EVIDENCE_LABELS) {
  const url = label === "dogrulanmis" ? "https://example.org/k" : "";
  assert.strictEqual(validateAudit({ ...ok, claims: [claim(label, url), claim(label, url), claim(label, url)] }).ok, true);
}

// 6) çıktı hiç yoksa (şema tutmadı) GEÇERSİZ
assert.strictEqual(validateAudit(undefined).ok, false);
assert.strictEqual(validateAudit({}).ok, false);

// KANIT KAPISI: ARAMA SONUCU + ALINTI (M2-C-3 ve §6.2 M2-C alıntı şartı).
//
// GEREKÇE-KANITI GERÇEK VERİDEN: aşağıdaki iddia 9 Eylül koşumunun denetiminden alındı. Biçimi
// geçerli bir URL taşıyor ve kod onu GEÇİRDİ; o koşumda web araması yoktu, yani URL modelin
// hafızasından geldi. Sonra bir adım daha: URL arama sonuçlarında OLSA BİLE sayfanın iddiayı
// desteklediğini göstermez. Alıntı, modelin gerçekten okuduğu metne bağlanmasının tek ucuz yolu.
{
  const PARCA =
    "Spring Boot 4.1.1 is now available from Maven Central. This maintenance release includes " +
    "dependency upgrades and bug fixes for the 4.1 line.";
  const URL = "https://spring.io/blog/spring-boot-4-1-1";

  const iddia = (ek = {}) => ({
    claim: "Spring Boot 4.1.1 Maven Central'da yayinda.",
    evidence: "dogrulanmis",
    source: "spring.io blog",
    url: URL,
    quote: "Spring Boot 4.1.1 is now available from Maven Central",
    ...ek,
  });
  const denetim = (ilk: Record<string, unknown>) => ({
    summary: "ozet",
    premortem: "bir yil sonra basarisiz olduk",
    weakestLink: "dagitim",
    claims: [
      ilk,
      { claim: "iddia2", evidence: "varsayim", source: "s", url: "", quote: "" },
      { claim: "iddia3", evidence: "model-bilgisi", source: "s", url: "", quote: "" },
    ],
  });
  const kaynak = [{ url: URL, content: PARCA }];

  // KIRMIZI 1: liste VERİLMEZSE (aramasız yol) hafızadan URL geçiyor. 9 Eylül'de olan bu.
  assert.strictEqual(validateAudit(denetim(iddia())).ok, true, "aramasiz yolda bicim kontrolu geciriyor");

  // KIRMIZI 2: URL LİSTEDE ama alıntı parçada YOK. Alıntı şartı olmasaydı bu geçerdi: model
  // gerçek bir kaynağı gösterip onun söylemediği bir şeyi iddia edebilirdi.
  const uydurmaAlinti = iddia({ quote: "Spring Boot 4.1.1 drops support for Java 17 entirely" });
  const yalnizUrl = { ...denetim(uydurmaAlinti) };
  assert.strictEqual(
    normalizeQuote(PARCA).includes(normalizeQuote(uydurmaAlinti.quote)),
    false,
    "uydurma alinti parcada YOK (kirmizinin kendisi)",
  );
  const red = validateAudit(yalnizUrl, kaynak);
  assert.strictEqual(red.ok, false, "URL listede olsa bile uydurma alinti gecmemeli");
  assert.ok(String((red as { reason: string }).reason).includes("ALINTISI arama parçasında yok"));
  assert.ok(String((red as { reason: string }).reason).includes(URL), "gerekce hangi kaynak oldugunu soylemeli");

  // YEŞİL: alıntı parçada varsa geçer.
  assert.strictEqual(validateAudit(denetim(iddia()), kaynak).ok, true, "parcadan birebir alinti gecmeli");

  // Biçim farkı alıntıyı düşürmemeli: satır sarması ve girinti, içerik değil biçimdir.
  const bicimFarki = iddia({ quote: "Spring   Boot 4.1.1\n  is now available\tfrom Maven Central" });
  assert.strictEqual(validateAudit(denetim(bicimFarki), kaynak).ok, true, "bosluk farki alintiyi bozmamali");

  // KISA alıntı reddedilir: üç kelimelik bir parça her metinde bulunur, kanıt değeri yoktur.
  const kisa = iddia({ quote: "Spring Boot" });
  const kisaRed = validateAudit(denetim(kisa), kaynak);
  assert.strictEqual(kisaRed.ok, false, "kisa alinti kanit sayilmaz");
  assert.ok(String((kisaRed as { reason: string }).reason).includes("ALINTI"));

  // URL listede YOKSA alıntıya bakılmadan reddedilir ve gerekçe izinli listeyi taşır.
  const listeDisi = validateAudit(denetim(iddia({ url: "https://hafizadan.example/uydurma" })), kaynak);
  assert.strictEqual(listeDisi.ok, false);
  assert.ok(String((listeDisi as { reason: string }).reason).includes("arama sonuçlarında YOK"));
  assert.ok(String((listeDisi as { reason: string }).reason).includes("spring.io"), "gerekce izinli listeyi tasimali");

  // Arama yapıldı ama SONUÇ YOK: her "dogrulanmis" reddedilir.
  assert.strictEqual(validateAudit(denetim(iddia()), []).ok, false, "arama sonucu yoksa dogrulanmis olamaz");

  // Etiketsiz iddialar alıntı istemez: kural yalnız "dogrulanmis" içindir.
  assert.strictEqual(
    validateAudit(
      { ...denetim(iddia()), claims: denetim(iddia()).claims.map((c) => ({ ...c, evidence: "varsayim", url: "", quote: "" })) },
      [],
    ).ok,
    true,
    "varsayim ve model-bilgisi alinti istemez",
  );

  // Normalleştirme: host büyük/küçük ve fragment farkı aynı kaynağı bozmamalı.
  assert.strictEqual(
    validateAudit(denetim(iddia({ url: "HTTPS://Spring.io/blog/spring-boot-4-1-1#readme" })), kaynak).ok,
    true,
    "host ve fragment farki ayni kaynagi bozmamali",
  );
}

console.log("AUDIT_TEST_OK: premortem zorunlu + 3 iddia alt siniri + etiket zorunlu + URL'siz rozet yok (§6.2)");
