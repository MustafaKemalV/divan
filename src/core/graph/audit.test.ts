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

console.log("AUDIT_TEST_OK: premortem zorunlu + 3 iddia alt siniri + etiket zorunlu + URL'siz rozet yok (§6.2)");
