// Muhafız (M2-A3 K-2): oturum zarfı kullanıcı mesajının İLK bloğu mu?
//
// Neden ayrı bir test: `context.test.ts` zarfın İÇERİĞİNİ doğruluyor (hangi parça hangi fazda
// görünür), ama içeriği doğru olan bir zarf mesajın sonuna basılırsa tasarım yine bozulur. Zarfın
// alanı ile zarfın modele basımı iki ayrı iddiadır; buraya kadar yalnız birincisi denetleniyordu.
//
// GEREKÇE-KANITI: önce sırasız (naif) kuruluşun tasarımı BOZDUĞU gösterilir, sonra kuralın
// düzelttiği. Böylece sıranın neden sabit olduğu tartışma değil, kayıt olur.

import assert from "node:assert";
import { buildUserMessage } from "./userMessage.ts";
import type { SeatRunInput } from "./seatRunner.ts";

const girdi: SeatRunInput = {
  phase: "F4:feasibility",
  idea: "Uc kutuphaneyi tek marka altinda mi toplamali?",
  envelope: "OTURUM ZARFI\nSecilen HMW: nasil farklilasiriz?\nSah'in cercevesi: dagitim degil konumlandirma.",
  attachments: [{ name: "README.md", content: "webhook-verify: imza dogrulama starter." }],
  context: "F3 ozeti: iki secenek one cikti.",
  seats: ["engineer1", "architect"],
  round: 1,
};

/** Naif kuruluş: bloklar var ama sıra yok, zarf sona ekleniyor. Tam olarak kaçındığımız şey. */
function naifKurulus(input: SeatRunInput): string {
  const parts = [`FİKİR:\n${input.idea}`];
  if (input.context) parts.push(`BAĞLAM (önceki fazın özeti veya bu faz içi metin):\n${input.context}`);
  if (input.envelope) parts.push(input.envelope);
  return parts.join("\n\n");
}

const sira = (mesaj: string, ...isaretler: string[]) => isaretler.map((i) => mesaj.indexOf(i));

// 1) KIRMIZI: naif kuruluşta zarf mesajın SONUNDA. Bütün parçalar orada, tasarım yine bozuk.
{
  const m = naifKurulus(girdi);
  const [zarf, fikir, baglam] = sira(m, "OTURUM ZARFI", "FİKİR:", "BAĞLAM (");
  assert.ok(zarf > baglam && zarf > fikir, "naif kurulusta zarf sonda olmali (kirmizinin kendisi)");
  assert.ok(!m.startsWith("OTURUM ZARFI"), "naif kurulus zarfla baslamiyor");
}

// 2) YEŞİL: sıra sabittendir oynağa. Zarf ilk blok, sonra fikir, sonra ek, sonra dinamik bağlam.
{
  const m = buildUserMessage(girdi);
  assert.ok(m.startsWith("OTURUM ZARFI"), "zarf kullanici mesajinin ILK blogu olmali");
  const [zarf, fikir, ek, baglam, koltuklar, tur] = sira(
    m,
    "OTURUM ZARFI",
    "FİKİR:",
    "EK BELGE (README.md)",
    "BAĞLAM (",
    "BU FAZDA KONUŞAN KOLTUKLAR:",
    "REVİZYON TURU:",
  );
  assert.ok(zarf < fikir, "zarf fikirden once");
  assert.ok(fikir < ek, "fikir ekten once");
  assert.ok(ek < baglam, "ek baglamdan once");
  assert.ok(baglam < koltuklar && koltuklar < tur, "dinamik bloklar en sonda ve kendi icinde sirali");
}

// 3) Ek belgenin iki hali BİRLİKTE basılmaz: tam metin verilen faz özeti görmez (§5).
{
  const tamMetin = buildUserMessage({ ...girdi, attachmentSummary: "Ek ozeti: uc starter." });
  assert.ok(tamMetin.includes("EK BELGE (README.md)"), "tam metin verilen fazda ham metin gider");
  assert.ok(!tamMetin.includes("EK BELGELERİN ÖZETİ"), "tam metin varken ozet ikinci kez basilmaz");

  const ozet = buildUserMessage({ ...girdi, attachments: [], attachmentSummary: "Ek ozeti: uc starter." });
  assert.ok(ozet.includes("EK BELGELERİN ÖZETİ"), "tam metin yoksa ozet gider");
  assert.ok(!ozet.includes("EK BELGE (README.md)"), "izinsiz fazda ham metin sizmaz");
}

// 4) Zarfsız çağrı (F0 brifingi henüz zarf üretmemiştir) boş bir blokla başlamaz.
{
  const m = buildUserMessage({ phase: "F0:briefing", idea: "Ham fikir." });
  assert.ok(m.startsWith("FİKİR:"), "zarf yoksa mesaj fikirle baslar, bos blokla degil");
  assert.ok(!m.startsWith("\n"), "bos zarf ondeki bosluk birakmaz");
}

// 5) Boşluktan ibaret zarf da yok sayılır: "zarf var" ile "zarf dolu" ayni sey degil.
{
  const m = buildUserMessage({ phase: "F1:frame", idea: "Ham fikir.", envelope: "   \n  " });
  assert.ok(m.startsWith("FİKİR:"), "bosluktan ibaret zarf blok acmaz");
}

console.log("USERMESSAGE_TEST_OK: zarf ilk blok, sira sabitten oynaga, ek metni tek halde gider");
