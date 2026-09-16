// Muhafız (M2-C-2 H-5): sorgu şeması BOŞ LİSTEYE izin veriyor mu?
//
// GEREKÇE-KANITI: prompt Denetçi'ye "doğrulanacak bir şey yoksa boş liste döndürebilirsin" diyor.
// Şema `minItems: 1` taşıdığı sürece bu cümle YALAN: sağlayıcı `strict: true` ile boş listeyi
// reddeder, model de istemediği bir sorgu uydurmak zorunda kalır. Uydurma sorgu, aramamaktan
// kötüdür: para yakar ve denetime alakasız bir sonuç kümesi sokar.
//
// Şema sağlayıcıda zorlanıyor, burada değil. O yüzden test, sağlayıcının uyguladığı KISITI
// (minItems/maxItems) aday listelere karşı çalıştırır: şema BEYANI ile davranış arasındaki
// bağ ancak böyle sınanır, "alan var mı" diye bakarak değil.

import assert from "node:assert";
import { schemaForPhase } from "./schemas.ts";

/** Sağlayıcının dizi kısıtı: `strict: true` altında uygulanan kural budur. */
function diziGecerMi(spec: { minItems?: number; maxItems?: number }, liste: string[]): boolean {
  if (spec.minItems !== undefined && liste.length < spec.minItems) return false;
  if (spec.maxItems !== undefined && liste.length > spec.maxItems) return false;
  return true;
}

const sema = schemaForPhase("F4:audit:queries");
assert.ok(sema, "sorgu turunun semasi olmali");
const queries = (sema.schema.properties as Record<string, { minItems?: number; maxItems?: number; items?: unknown }>)
  .queries;

// 1) KIRMIZI: eski beyan (minItems 1) boş listeyi REDDEDER. Prompt'taki cümle o halde yalandı.
{
  const eski = { minItems: 1, maxItems: 3 };
  assert.strictEqual(diziGecerMi(eski, []), false, "eski semada bos liste gecmiyordu (kirmizinin kendisi)");
  assert.strictEqual(diziGecerMi(eski, ["tek sorgu"]), true, "eski sema tek sorguyu geciriyordu");
}

// 2) YEŞİL: yeni beyan boş listeyi geçirir. "Aranacak bir şey yok" artık söylenebilir bir cevap.
{
  assert.strictEqual(diziGecerMi(queries, []), true, "bos liste semadan GECMELI (H-5)");
  assert.strictEqual(queries.minItems ?? 0, 0, `minItems 0 olmali: ${queries.minItems}`);
}

// 3) Üst sınır DURUYOR: kap bir frendir. Boş listeye izin vermek, sınırsız sorguya izin vermek
//    değildir; dördüncü sorgu şemada reddedilir, kod tarafındaki faz kapı ikinci bir frendir.
{
  assert.strictEqual(diziGecerMi(queries, ["a", "b", "c"]), true, "uc sorgu gecmeli");
  assert.strictEqual(diziGecerMi(queries, ["a", "b", "c", "d"]), false, "dort sorgu semada reddedilmeli");
  assert.strictEqual(queries.maxItems, 3, `maxItems 3 kalmali: ${queries.maxItems}`);
}

// 4) Küçük kurul varyantı AYNI şemayı kullanır: kadro değişir, sorgu turunun görevi değişmez.
{
  assert.strictEqual(schemaForPhase("F4s:audit:queries"), sema, "kucuk kurul ayni semayi kullanmali");
}

console.log("SCHEMAS_TEST_OK: sorgu semasi bos listeyi gecirir, ust sinir durur");
