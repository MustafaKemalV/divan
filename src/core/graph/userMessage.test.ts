// Muhafız (M2-A3 K-2): oturum zarfı kullanıcı mesajının İLK bloğu mu?
//
// Neden ayrı bir test: `context.test.ts` zarfın İÇERİĞİNİ doğruluyor (hangi parça hangi fazda
// görünür), ama içeriği doğru olan bir zarf mesajın sonuna basılırsa tasarım yine bozulur. Zarfın
// alanı ile zarfın modele basımı iki ayrı iddiadır; buraya kadar yalnız birincisi denetleniyordu.
//
// GEREKÇE-KANITI: önce sırasız (naif) kuruluşun tasarımı BOZDUĞU gösterilir, sonra kuralın
// düzelttiği. Böylece sıranın neden sabit olduğu tartışma değil, kayıt olur.

import assert from "node:assert";
import { buildSystemEnvelope, buildUserMessage } from "./userMessage.ts";
import type { SeatRunInput } from "./seatRunner.ts";

const girdi: SeatRunInput = {
  phase: "F4:feasibility",
  idea: "Uc kutuphaneyi tek marka altinda mi toplamali?",
  envelope: "OTURUM ZARFI\nSecilen HMW: nasil farklilasiriz?\nSah'in cercevesi: dagitim degil konumlandirma.",
  attachments: [{ name: "README.md", content: "webhook-verify: imza dogrulama starter." }],
  // Ozet ve tam metin AYNI cagrida bulunabilir: biri sabit on ekin parcasi, oburu degil.
  attachmentSummary: "Ek ozeti: uc Spring Boot starter.",
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
}

// 2) YEŞİL (M2-C-5, SEÇENEK A): SABİT katmanlar SİSTEM mesajında, sırayla zarf, FİKİR, ek özeti.
{
  const sistem = buildSystemEnvelope(girdi);
  assert.ok(sistem.startsWith("OTURUM ZARFI"), "zarf sistem blogunun ILK parcasi olmali");
  const [zarf, fikir, ekOzeti] = sira(sistem, "OTURUM ZARFI", "FİKİR:", "EK BELGELERİN ÖZETİ");
  assert.ok(zarf < fikir, "zarf fikirden once");
  assert.ok(fikir < ekOzeti, "fikir ek ozetinden once");
  // Ek TAM METNİ sistem blogunda OLMAMALI: fazdan faza degisir, on eki bozar.
  assert.ok(!sistem.includes("EK BELGE (README.md)"), "tam metin sabit on ege girmez");
}

// 3) YEŞİL: DİNAMİK bağlam kullanıcı mesajında, sırayla ek tam metni, bağlam, koltuklar, tur.
{
  const m = buildUserMessage(girdi);
  const [ek, baglam, koltuklar, tur] = sira(
    m,
    "EK BELGE (README.md)",
    "BAĞLAM (",
    "BU FAZDA KONUŞAN KOLTUKLAR:",
    "REVİZYON TURU:",
  );
  assert.ok(ek < baglam, "ek tam metni baglamdan once");
  assert.ok(baglam < koltuklar && koltuklar < tur, "dinamik bloklar kendi icinde sirali");
  // Zarf ve fikir ARTIK burada degil: iki kez gonderilirse on ek de bozulur, token da yanar.
  assert.ok(!m.includes("OTURUM ZARFI"), "zarf kullanici mesajinda TEKRARLANMAZ");
  assert.ok(!m.includes("FİKİR:"), "fikir kullanici mesajinda TEKRARLANMAZ");
}

// 4) Ek belgenin iki hali AYRI YERDE: tam metin dinamik tarafta, özet sabit tarafta. İkisi de
//    aynı çağrıda bulunabilir, çünkü biri ön ekin parçası öbürü değil.
{
  const sistem = buildSystemEnvelope({ ...girdi, attachmentSummary: "Ek ozeti: uc starter." });
  assert.ok(sistem.includes("EK BELGELERİN ÖZETİ"), "ozet sabit on ekte");
  const kullanici = buildUserMessage({ ...girdi, attachmentSummary: "Ek ozeti: uc starter." });
  assert.ok(kullanici.includes("EK BELGE (README.md)"), "tam metin dinamik tarafta");
  assert.ok(!kullanici.includes("EK BELGELERİN ÖZETİ"), "ozet kullanici mesajinda tekrarlanmaz");
}

// 5) Zarfsız çağrı (F0 brifingi) boş bir blokla başlamaz.
{
  const sistem = buildSystemEnvelope({ phase: "F0:briefing", idea: "Ham fikir." });
  assert.ok(sistem.startsWith("FİKİR:"), "zarf yoksa sistem blogu fikirle baslar");
  assert.ok(!sistem.startsWith("\n"), "bos zarf ondeki bosluk birakmaz");
}

// 6) Boşluktan ibaret zarf da yok sayılır.
{
  const sistem = buildSystemEnvelope({ phase: "F1:frame", idea: "Ham fikir.", envelope: "   \n  " });
  assert.ok(sistem.startsWith("FİKİR:"), "bosluktan ibaret zarf blok acmaz");
}

console.log("USERMESSAGE_TEST_OK: sabit katmanlar sistem mesajinda, dinamik baglam kullanici mesajinda");
