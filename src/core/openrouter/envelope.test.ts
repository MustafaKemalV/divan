// Cevap zarfı işleme birim testi (docs/CEVAP-ZARFI.md). Node native TS ile:
//   node src/core/openrouter/gateway.test.ts
//
// Bu testin varlık sebebi gerçek bir arıza: ilk tam oturumda Denetçi'nin cevabı token tavanına
// çarpıp boş döndü, sağlayıcı bunu finish_reason="length" ile söyledi, kod o alanı okumadı ve
// "şemaya uymadı" diye yanlış teşhis koydu. Bekçi görevi: o alan bir daha okunmadan geçilemesin.

import assert from "node:assert";
import { classifyEnvelope, TruncatedResponseError } from "./envelope.ts";

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

console.log("GATEWAY_TEST_OK: kesilme ayri hata sinifi + harcanan para tasinir + suzme/bos icerik sessiz gecmez");
