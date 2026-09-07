// Muhafız (M2-A3 K-1): kimlik katmanı ile faz talimatı aynı cümleyi iki kez söylememeli.
//
// GEREKÇE-KANITI: önce ölçerin gerçekten çiftlenme YAKALADIĞI gösterilir (yakalamayan bir ölçerle
// "temiz" demek kanıt değildir), sonra repodaki bütün koltuk-faz çiftleri taranır.

import assert from "node:assert";
import { readdirSync } from "node:fs";
import { PROMPTS_DIR, loadIdentity, loadPrompt } from "./load.ts";
import { sharedPhrases, sharedSentences, NGRAM } from "./persona.ts";

// 1) ÖLÇER ÇALIŞIYOR MU? Küçük harf, noktalama ve ek farkı çiftlenmeyi gizlememeli.
{
  const kimlik = "Parçalara değil parçaların arasındaki ilişkiye bakarsın; yapıyı sen görürsün.";
  const faz = "Sen parçalara değil, parçaların arasındaki ilişkiye bakarsın. Şimdi fikre bak.";
  const ortak = sharedPhrases(kimlik, faz);
  assert.ok(ortak.length > 0, "olcer birebir olmayan ciftlenmeyi yakalamali");
  assert.ok(ortak[0].includes("parçaların arasındaki ilişkiye bakarsın"));
  // Yanlış pozitif olmamalı: aynı konuda ama farklı cümleler çiftlenme değildir. İki cümle de
  // eşiğin ÜSTÜNDE (11'er kelime), yoksa kontrol boş kalırdı: altı kelimeye ulaşmayan bir girdide
  // bozuk bir ölçer de 0 döndürür ve test bozukluğu yakalayamaz.
  assert.strictEqual(
    sharedPhrases(
      "Yapıyı sen kurarsın ve hangi sınırın nereden geçeceğine sen karar verirsin.",
      "Fikri müşteri gözünden değerlendir, kimin ne için para ödeyeceğini sen söylersin.",
    ).length,
    0,
    "ayni konuda iki farkli cumle ciftlenme sayilmamali",
  );
}

// 1b) KISA TEKRAR: eşiğin altındaki birebir cümleler de çiftlenmedir.
{
  const ortak = sharedSentences("Moderatörsün, yargıç değilsin. Sen düzenlersin.", "Moderatorsun. moderatörsün yargıç değilsin!");
  assert.deepStrictEqual(ortak, ["moderatörsün yargıç değilsin"]);
  assert.strictEqual(sharedSentences("Kısa konuş.", "Kısa konuş.").length, 0, "uc kelimeden kisa cumleler sayilmaz");
}

// 2) REPO TARAMASI: her koltuk-faz çifti kendi kimliğiyle karşılaştırılır.
{
  const dosyalar = readdirSync(PROMPTS_DIR).filter((f) => f.endsWith(".md") && !f.endsWith("-kimlik.md"));
  const bulgular: string[] = [];
  for (const dosya of dosyalar) {
    const [seatId, ...kalan] = dosya.replace(/\.md$/, "").split("-");
    const phase = kalan.join(":");
    const kimlik = loadIdentity(seatId);
    const talimat = loadPrompt(seatId, phase);
    for (const p of sharedPhrases(kimlik, talimat)) bulgular.push(`${dosya}: "${p}"`);
    for (const c of sharedSentences(kimlik, talimat)) bulgular.push(`${dosya}: (cumle) "${c}"`);
  }
  if (bulgular.length > 0) {
    console.log(`  CIFTLENME (${NGRAM}+ kelime):`);
    for (const b of bulgular) console.log(`    ${b}`);
  }
  assert.strictEqual(bulgular.length, 0, `${bulgular.length} persona ciftlenmesi kaldi`);
}

console.log("PERSONA_TEST_OK: olcer ciftlenmeyi yakaliyor + repoda kimlik/faz ciftlenmesi yok");
