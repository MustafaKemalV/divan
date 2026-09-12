// Denetim doğrulaması birim testi (DESIGN §6.3.1 + §6.2). Node native TS ile:
//   node src/core/graph/audit.test.ts
// Bu test bir MEKANİZMA BEKÇİSİDİR: zorunlu premortem, üç iddia alt sınırı ve kanıt etiketi
// şartlarından biri gevşetilirse burada düşer.

import assert from "node:assert";
import { validateAudit, MIN_AUDIT_CLAIMS, EVIDENCE_LABELS } from "./audit.ts";

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

// KANIT KAPISI, ARAMA SONUCUNA BAGLI (M2-C-3).
//
// GEREKÇE-KANITI GERÇEK VERİDEN: aşağıdaki iddia 9 Eylül koşumunun denetiminden alındı. Biçimi
// geçerli bir URL taşıyor ve kod onu GEÇİRDİ; ama o koşumda web araması yoktu, yani URL modelin
// hafızasından geldi ve hiç doğrulanmadı. §6.2'nin rozeti o gün kaynak GÖSTERME disiplinini
// zorluyordu, kaynağın varlığını değil.
{
  const gercekIddia = {
    claim: "audit-chain README'sinde Maven Central badge'i mevcut ancak kutuphane henuz yayinlanmamis.",
    evidence: "dogrulanmis",
    source: "audit-chain README.md",
    url: "https://central.sonatype.com/artifact/io.github.mustafakemalv/audit-chain-spring-boot-starter",
  };
  const denetim = {
    summary: "ozet",
    premortem: "bir yil sonra basarisiz olduk",
    weakestLink: "dagitim",
    claims: [
      gercekIddia,
      { claim: "iddia2", evidence: "varsayim", source: "s", url: "" },
      { claim: "iddia3", evidence: "model-bilgisi", source: "s", url: "" },
    ],
  };

  // KIRMIZI: izinli liste VERİLMEZSE (bugünkü aramasız yol) iddia geçiyor.
  assert.strictEqual(validateAudit(denetim).ok, true, "aramasiz yolda bicim kontrolu geciriyor (9 Eylul'de olan bu)");

  // YEŞİL 1: arama YAPILDI ve bu URL sonuçlarda YOK -> reddedilir, gerekçe izinli listeyi taşır.
  const red = validateAudit(denetim, ["https://spring.io/", "https://github.com/spring-projects/spring-boot"]);
  assert.strictEqual(red.ok, false, "arama sonuclarinda olmayan URL rozeti alamaz");
  assert.ok(String((red as { reason: string }).reason).includes("arama sonuçlarında YOK"), "gerekce acik olmali");
  assert.ok(String((red as { reason: string }).reason).includes("spring.io"), "iade gerekcesi izinli listeyi tasimali");

  // YEŞİL 2: URL sonuçlardaysa geçer.
  const gecer = validateAudit(denetim, [gercekIddia.url]);
  assert.strictEqual(gecer.ok, true, "arama sonucundaki URL rozeti hak eder");

  // YEŞİL 3: arama yapıldı ama SONUÇ YOK -> her "dogrulanmis" reddedilir. "Arama yapılmadı" ile
  // "arandı, sonuç yok" ayrı şeylerdir: ilki listeyi vermez, ikincisi boş liste verir.
  const bos = validateAudit(denetim, []);
  assert.strictEqual(bos.ok, false, "arama sonucu yoksa dogrulanmis olamaz");
  assert.ok(String((bos as { reason: string }).reason).includes("arama sonucu yok"));

  // Normalleştirme: aynı kaynağın farklı yazımı reddedilmemeli, yoksa kural gerçek bir kaynağı
  // biçim farkı yüzünden düşürür ve modeli URL'i harfi harfine kopyalamaya zorlar.
  const farkliYazim = validateAudit(
    { ...denetim, claims: [{ ...gercekIddia, url: "HTTPS://Central.Sonatype.com/artifact/io.github.mustafakemalv/audit-chain-spring-boot-starter/#readme" }, ...denetim.claims.slice(1)] },
    [gercekIddia.url],
  );
  assert.strictEqual(farkliYazim.ok, true, "host buyuk/kucuk ve fragment farki ayni kaynagi bozmamali");

  // Ama sorgu dizesi KORUNUR: ?v=2 cogu sitede baska bir sayfadir.
  assert.strictEqual(
    validateAudit({ ...denetim, claims: [{ ...gercekIddia, url: `${gercekIddia.url}?v=2` }, ...denetim.claims.slice(1)] }, [gercekIddia.url]).ok,
    false,
    "sorgu dizesi farki ayni sayfa sayilmamali",
  );

  // Etiketsiz iddialar liste verilse de etkilenmez: kural yalniz "dogrulanmis" icindir.
  assert.strictEqual(
    validateAudit({ ...denetim, claims: denetim.claims.map((c) => ({ ...c, evidence: "varsayim", url: "" })) }, []).ok,
    true,
    "varsayim ve model-bilgisi arama sonucu istemez",
  );
}

console.log("AUDIT_TEST_OK: premortem zorunlu + 3 iddia alt siniri + etiket zorunlu + URL'siz rozet yok (§6.2)");
