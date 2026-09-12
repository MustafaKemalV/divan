#!/usr/bin/env node
/**
 * ÖNBELLEK EŞİK PROBU (M2-C-1). GERÇEK PARA HARCAR; `npm test` bunu koşmaz.
 *
 *   node eval/prob-onbellek.mjs
 *
 * Neden var: D-1 sabit katmanları başa koyarken gerekçe "sağlayıcı önbelleği işleyebilsin" idi.
 * 7 Eylül koşumunda ölçüldü ve Anthropic tarafında kazanç SIFIRDI (C-2): `cache_control` işareti
 * gerekiyor. İşaretlemenin bir eşiği var: eşikten kısa bir ön ek önbelleğe hiç girmez.
 *
 * Eşik değeri DOĞRULANMADI ve iki kaynak farklı söylüyor:
 *   OpenRouter dokümanı : Opus 4.8 icin 4.096 token
 *   Anthropic dokümanı  : Opus 4.8 ve Sonnet 5 icin 1.024 token
 *
 * Bu prob hangisinin doğru olduğunu ÖLÇER. Ölçmeden D-1'in sıra kararı (zarf + fikir + ek özeti
 * faz talimatının önüne alınsın mı) verilemez, çünkü karar eşiğe bağlı: eşik 4.096 ise kısa
 * çağrılarda işaretlemenin hiçbir etkisi olmaz ve sırayı değiştirmenin bedeli karşılıksız kalır.
 *
 * Yöntem: her model için iki ayrı sabit sistem bloğu (biri ~3.000, biri ~1.200 token),
 * `cache_control: {type: "ephemeral"}` ile işaretli. Her blok 60 saniye içinde İKİ KEZ çağrılır:
 * ilk çağrı önbelleğe YAZAR (`cache_write_tokens`), ikincisi OKUR (`cached_tokens`). Okuma sıfır
 * çıkıyorsa o uzunluk eşiğin altındadır.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const KOK = process.cwd();
const anahtar = (readFileSync(join(KOK, ".env.local"), "utf8").match(/OPENROUTER_API_KEY\s*=\s*(\S+)/) ?? [])[1];
if (!anahtar) {
  console.error(".env.local icinde OPENROUTER_API_KEY yok.");
  process.exit(2);
}

/** Sabit doldurma metni: anlamı yok, uzunluğu var. Her koşumda AYNI olmalı (önbellek ön eki). */
function blok(hedefToken) {
  const cumle = "Divan kurulunda her koltuk kendi kimligini tasir ve kendi isini yapar. ";
  // Kaba ölçü: ~4 karakter/token. Hedefin biraz üstüne çıkmak, altında kalmaktan iyidir.
  const tekrar = Math.ceil((hedefToken * 4) / cumle.length);
  return cumle.repeat(tekrar);
}

async function cagir(model, sistemBlogu) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${anahtar}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/MustafaKemalV/divan",
      "X-Title": "Divan",
    },
    body: JSON.stringify({
      model,
      max_tokens: 16,
      messages: [
        {
          role: "system",
          // İŞARET BURADA: sabit ön ek önbelleğe alınsın diye.
          content: [{ type: "text", text: sistemBlogu, cache_control: { type: "ephemeral" } }],
        },
        { role: "user", content: "Tek kelimeyle cevapla: tamam." },
      ],
    }),
  });
  if (!res.ok) return { hata: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
  const j = await res.json();
  const u = j.usage ?? {};
  return {
    promptTokens: u.prompt_tokens,
    cached: u.prompt_tokens_details?.cached_tokens ?? 0,
    cacheWrite: u.prompt_tokens_details?.cache_write_tokens ?? 0,
    cost: u.cost ?? 0,
    ham: j,
  };
}

const kayit = [];
let toplam = 0;

for (const model of ["anthropic/claude-opus-4.8", "anthropic/claude-sonnet-5"]) {
  for (const hedef of [3000, 1200]) {
    const sistem = blok(hedef);
    const ilk = await cagir(model, sistem);
    const ikinci = await cagir(model, sistem);
    toplam += (ilk.cost ?? 0) + (ikinci.cost ?? 0);
    kayit.push({ model, hedefToken: hedef, ilk, ikinci });

    if (ilk.hata || ikinci.hata) {
      console.log(`\n### ${model}  ~${hedef} token -> HATA: ${ilk.hata ?? ikinci.hata}`);
      continue;
    }
    console.log(`\n### ${model}  hedef ~${hedef} token (gercek girdi ${ilk.promptTokens})`);
    console.log(`  1. cagri: yazilan ${ilk.cacheWrite}, okunan ${ilk.cached}, $${ilk.cost.toFixed(6)}`);
    console.log(`  2. cagri: yazilan ${ikinci.cacheWrite}, okunan ${ikinci.cached}, $${ikinci.cost.toFixed(6)}`);
    console.log(
      `  -> onbellek ${ikinci.cached > 0 ? "CALISTI" : "CALISMADI"}` +
        `${ikinci.cached > 0 ? ` (${ikinci.cached} token okundu)` : " (bu uzunluk esigin altinda)"}`,
    );
  }
}

mkdirSync(join(KOK, "oturum-ciktisi"), { recursive: true });
const yol = join(KOK, "oturum-ciktisi", `prob-onbellek-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(yol, JSON.stringify(kayit, null, 2), "utf8");
console.log(`\nPROB TOPLAM: $${toplam.toFixed(6)}`);
console.log(`ham cevap   : ${yol}`);
