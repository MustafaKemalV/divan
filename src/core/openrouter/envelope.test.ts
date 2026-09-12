// Cevap zarfı işleme birim testi (docs/CEVAP-ZARFI.md). Node native TS ile:
//   node src/core/openrouter/envelope.test.ts
//
// Bu testin varlık sebebi gerçek bir arıza: ilk tam oturumda Denetçi'nin cevabı token tavanına
// çarpıp boş döndü, sağlayıcı bunu finish_reason="length" ile söyledi, kod o alanı okumadı ve
// "şemaya uymadı" diye yanlış teşhis koydu. Bekçi görevi: o alan bir daha okunmadan geçilemesin.

import assert from "node:assert";
import { classifyEnvelope, readCitations, readUsage, TruncatedResponseError } from "./envelope.ts";

const usage = { completionTokens: 2048, reasoningTokens: 2048, totalTokens: 3500, cost: 0.008 };

// 1) GEREKÇE-KANITI: kesilmiş cevap "şema hatası" değil ALTYAPI arızası olarak sınıflanır.
//    (Arızanın kendisi: içerik boş VE finish_reason length. Eski kod yalnız boşluğa bakıyordu.)
assert.throws(
  () => classifyEnvelope({ content: "", finishReason: "length", usage }, 2048),
  (e: Error) => {
    assert.strictEqual(e.name, "TruncatedResponseError", "kesilme kendi hata sinifini tasimali");
    assert.ok(e.message.includes("2048"), "tesbis mesaji tavani soylemeli");
    assert.ok(e.message.includes("düşünmeye"), "tesbis mesaji dusunme-token dokumunu icermeli");
    assert.ok(e.message.includes("DEĞİL"), "mesaj bunun koltugun sema sorunu OLMADIGINI soylemeli");
    return true;
  },
);

// 2) Kesilen çağrının HARCANAN PARASI hatayla birlikte taşınır (fatura sessizce kaybolmaz)
try {
  classifyEnvelope({ content: "", finishReason: "length", usage }, 2048);
  assert.fail("kesilme hata firlatmaliydi");
} catch (e) {
  const t = e as TruncatedResponseError;
  assert.strictEqual(t.usage?.cost, 0.008, "kesilen cagrinin maliyeti hatada tasinmali");
  assert.strictEqual(t.reasoningTokens, 2048);
}

// 3) İçerik dolu + kesilme: yine kesilmedir (yarım JSON'u geçerli saymayız)
assert.throws(
  () => classifyEnvelope({ content: '{"premortem": "yarim', finishReason: "length", usage }, 4096),
  TruncatedResponseError,
);

// 4) İçerik süzüldüyse sessiz geçilmez
assert.throws(() => classifyEnvelope({ content: "", finishReason: "content_filter" }, 2048), /süzdü/);

// 5) finish_reason "stop" ama içerik boş: yine hata (sağlayıcı iş yaptı, elimize bir şey geçmedi)
assert.throws(() => classifyEnvelope({ content: "   ", finishReason: "stop" }, 2048), /boş içerik/);

// 6) Normal cevap sorunsuz geçer
assert.doesNotThrow(() => classifyEnvelope({ content: '{"ok": true}', finishReason: "stop", usage }, 8192));

// ÖLÇÜM ALANLARI (M2-C-1). Üç alan 2026-09-11 probunda sağlayıcıdan GELİYORDU ama kayda hiç
// girmiyordu; üçü de M2-C'nin ölçemeyeceği şeyleri ölçer.
//
// GEREKÇE-KANITI: önce eski okuyucunun bu alanları DÜŞÜRDÜĞÜ gösterilir, sonra yenisinin taşıdığı.
{
  // Gerçek probun döndürdüğü cevabın şekli (alan adları 2026-09-11 ham kaydından).
  const sahteCevap = {
    model: "deepseek/deepseek-v4-pro",
    choices: [
      {
        finish_reason: "stop",
        message: {
          content: "{}",
          annotations: [
            { type: "url_citation", url_citation: { url: "https://spring.io/", title: "Spring Boot 4.1.1", content: "yayinlandi" } },
            { type: "url_citation", url_citation: { url: "https://github.com/spring-projects/spring-boot/releases" } },
            { type: "baska_sey", url_citation: { url: "https://yok" } },
          ],
        },
      },
    ],
    usage: {
      prompt_tokens: 1900,
      completion_tokens: 1771,
      total_tokens: 3671,
      cost: 0.010919,
      prompt_tokens_details: { cached_tokens: 128, cache_write_tokens: 640 },
      completion_tokens_details: { reasoning_tokens: 900 },
      cost_details: { upstream_inference_cost: 0.0039188016825 },
    },
  };

  // KIRMIZI: eski okuyucu yalnız dört alan + cached_tokens + reasoning_tokens aliyordu.
  const eskiOkuyucu = (d: typeof sahteCevap) => ({
    promptTokens: d.usage.prompt_tokens,
    completionTokens: d.usage.completion_tokens,
    totalTokens: d.usage.total_tokens,
    cost: d.usage.cost,
    reasoningTokens: d.usage.completion_tokens_details?.reasoning_tokens,
    cachedTokens: d.usage.prompt_tokens_details?.cached_tokens,
  });
  const eski = eskiOkuyucu(sahteCevap) as Record<string, unknown>;
  assert.strictEqual(eski.cacheWriteTokens, undefined, "eski okuyucu onbellege YAZILAN tokeni dusuruyordu");
  assert.strictEqual(eski.upstreamCost, undefined, "eski okuyucu upstream maliyeti dusuruyordu");

  // YEŞİL: üçü de kayıtta.
  const u = readUsage(sahteCevap);
  assert.strictEqual(u?.cacheWriteTokens, 640, "onbellege yazilan token okunmali");
  assert.strictEqual(u?.cachedTokens, 128);
  assert.strictEqual(u?.upstreamCost, 0.0039188016825, "upstream maliyet okunmali");
  // Arama ücreti ancak bu iki alanın FARKI ile ayrılabilir; probda $0.007 çıkmıştı.
  assert.ok(Math.abs((u!.cost! - u!.upstreamCost!) - 0.007) < 1e-6, "arama ucreti fark ile ayrilabilmeli");

  const alintilar = readCitations(sahteCevap);
  assert.strictEqual(alintilar.length, 2, "yalniz url_citation tipindekiler alinir");
  assert.strictEqual(alintilar[0].url, "https://spring.io/");
  assert.strictEqual(alintilar[0].title, "Spring Boot 4.1.1");
  assert.strictEqual(alintilar[0].content, "yayinlandi", "arama parcasi kanit defterine girecek");
  assert.strictEqual(alintilar[1].title, undefined, "olmayan alan uydurulmaz");

  // Arama yapılmamış cevap: boş dizi, undefined değil. "Arama yok" ile "alan yok" karışmamalı.
  assert.deepStrictEqual(readCitations({ choices: [{ message: { content: "x" } }] }), []);
  assert.strictEqual(readUsage({}), undefined, "usage yoksa undefined");
}

console.log("ENVELOPE_TEST_OK: kesilme ayri hata sinifi + harcanan para tasinir + olcum alanlari (onbellek yazma, upstream, alintilar) kayitta");
