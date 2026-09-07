// Muhafız (M2-A3 T3-1): şema çıktısı transkripte SADIK dönüyor mu?
//
// GEREKÇE-KANITI: önce eski davranışın (content = data.summary) neyi kaybettiği gösterilir,
// sonra render'ın onu taşıdığı. Kaybın adı önemli: doğrulanmış bir kanıt defteri, doğrulandığı
// yerde ölürse §6.2'nin rozet disiplini kurulun önüne hiç gelmemiş olur.

import assert from "node:assert";
import { renderAudit, renderJudgment } from "./render.ts";
import type { AuditOutput } from "./audit.ts";
import type { JudgmentItem } from "./state.ts";

const denetim: AuditOutput = {
  summary: "Denetim: premortem + 3 etiketli iddia.",
  premortem: "Bir yıl sonra başarısız olduk: dağıtım maliyeti gelirden yüksek kaldı.",
  claims: [
    { claim: "Dağıtım maliyeti gelirden yüksek.", evidence: "varsayim", source: "sınanmamış öngörü", url: "" },
    { claim: "Hedef segment bu fiyata alışkın.", evidence: "dogrulanmis", source: "sektör raporu", url: "https://example.org/kaynak" },
  ],
  weakestLink: "dağıtım kanalı",
};

// 1) KIRMIZI: eski davranış yalnız özeti taşıyordu. Kaybın büyüklüğü ölçülebilir.
{
  const eski = denetim.summary; // content = data.summary
  assert.ok(!eski.includes("Hedef segment"), "eski halde iddia metni yok (kirmizinin kendisi)");
  assert.ok(!eski.includes("dogrulanmis"), "eski halde kanit etiketi yok");
  assert.ok(!eski.includes("https://"), "eski halde kaynak URL'si yok");
  assert.ok(!eski.includes("dağıtım maliyeti gelirden"), "eski halde premortem yok");
}

// 2) YEŞİL: render hepsini taşır ve hiçbirini değiştirmez.
{
  const m = renderAudit(denetim);
  assert.ok(m.includes(denetim.premortem), "premortem tam metniyle gecmeli");
  assert.ok(m.includes("Hedef segment bu fiyata alışkın."), "iddia metni gecmeli");
  assert.ok(m.includes("dogrulanmis"), "kanit etiketi gecmeli");
  assert.ok(m.includes("https://example.org/kaynak"), "kaynak URL'si gecmeli");
  assert.ok(m.includes("sektör raporu"), "kaynak adi gecmeli");
  assert.ok(m.includes("dağıtım kanalı"), "en zayif halka gecmeli");
  // Etiket satırın BAŞINDA: bir iddianın nasıl okunacağını belirleyen ilk şey kanıt durumudur.
  const iddiaSatiri = m.split("\n").find((l) => l.includes("Hedef segment"));
  assert.ok(iddiaSatiri?.startsWith("- dogrulanmis |"), `etiket basta olmali: ${iddiaSatiri}`);
  // URL'siz iddia "URL yok" der; boş bırakıp okuyanı yanıltmaz.
  const varsayimSatiri = m.split("\n").find((l) => l.includes("Dağıtım maliyeti"));
  assert.ok(varsayimSatiri?.endsWith("URL yok"), `URL'siz iddia acikca isaretlenmeli: ${varsayimSatiri}`);
}

// 3) Render YARGILAMAZ: etiket çevirmez, madde düşürmez, metin kısaltmaz (§6 beyan bütünlüğü).
{
  const uzun = "x".repeat(500);
  const m = renderAudit({ ...denetim, claims: [{ claim: uzun, evidence: "model-bilgisi", source: "", url: "" }] });
  assert.ok(m.includes(uzun), "uzun iddia kisaltilmamali");
  assert.ok(m.includes("kaynak belirtilmedi"), "bos kaynak sessizce yutulmamali");
}

// 4) HÜKÜM: kriter, durum ve blocking işareti; ham metin de taşınır (§6.4'ün dayanağı).
{
  const items: JudgmentItem[] = [
    { criterion: "fizibilite", status: "karsilandi", blocking: false, rawText: "Temel akış uygulanabilir." },
    { criterion: "farklılaşma", status: "karsilanmadi", blocking: true, rawText: "Rakipten ayıran şey gösterilmedi." },
  ];
  const m = renderJudgment(items, "Üç kriter değerlendirildi.");
  assert.ok(m.includes("- fizibilite: karsilandi"), "kriter ve durum satiri");
  assert.ok(m.includes("- farklılaşma: karsilanmadi [BLOCKING]"), "blocking isareti gorunur olmali");
  assert.ok(!m.includes("- fizibilite: karsilandi [BLOCKING]"), "blocking olmayan madde isaretlenmemeli");
  assert.ok(m.includes("Rakipten ayıran şey gösterilmedi."), "Denetci'nin ham metni tasinmali");
  assert.ok(m.includes("Üç kriter değerlendirildi."), "hukum ozeti tasinmali");
}

// 5) Boş hüküm SESSİZ geçilmez: şema üretilemediğinde transkript bunu söylemeli.
{
  const m = renderJudgment([], "");
  assert.ok(m.includes("madde listelenmedi"), "bos hukum acikca yazilmali");
}

console.log("RENDER_TEST_OK: denetim ve hukum transkripte sadik doner, render yargilamaz");
