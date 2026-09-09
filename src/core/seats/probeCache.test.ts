// Prob önbelleği birim testi (DESIGN §7). Node native TS ile:
//   node src/core/seats/probeCache.test.ts
// Bekçi görevi: ASİMETRİ kuralı (düşen koltuk önbelleğe yazılmaz) gevşetilirse burada düşer.

import assert from "node:assert";
import { cacheableResults, configHashOf, isCacheFresh, PROBE_TTL_MS } from "./probeCache.ts";

const seat = (seatId: string, status: string) =>
  ({ seatId, title: seatId, family: "x", model: "m", status }) as never;

// 1) ASİMETRİ: yalnız geçenler önbelleğe girer, düşenler her açılışta yeniden denenir
const filtered = cacheableResults([
  seat("a", "pass"),
  seat("b", "pass-via-fallback"),
  seat("c", "fail"),
  seat("d", "no-key"),
]);
assert.deepStrictEqual(
  filtered.map((r) => r.seatId),
  ["a", "b"],
  "fail ve no-key onbellege YAZILMAMALI (gecici ariza kalici dislama olmasin)",
);

// 2) config değişirse önbellek düşer
const cfg = (model: string) =>
  ({ seats: { visionary: { model, fallbacks: ["f1"] } }, budget: { maxCalls: 30 }, search: { perPhaseCap: 3 } }) as never;
const h1 = configHashOf(cfg("x-ai/grok-4.6"));
const h2 = configHashOf(cfg("x-ai/grok-4.5"));
assert.notStrictEqual(h1, h2, "model degisince ozet degismeli");
assert.strictEqual(h1, configHashOf(cfg("x-ai/grok-4.6")), "ayni config ayni ozeti vermeli");

// 3) tazelik: ömür içinde geçerli, dolduğunda değil
const now = 1_000_000_000_000;
const file = (savedAt: number, configHash = h1) => ({ configHash, savedAt, results: [] });
assert.strictEqual(isCacheFresh(file(now - 1000), h1, now), true);
assert.strictEqual(isCacheFresh(file(now - PROBE_TTL_MS - 1), h1, now), false, "omru dolan onbellek gecersiz");
assert.strictEqual(isCacheFresh(file(now - 1000), h2, now), false, "baska config'in onbellegi kullanilamaz");
assert.strictEqual(isCacheFresh(undefined, h1, now), false);
// gelecekten gelen damga (saat kaymasi) güvenilmez sayılır
assert.strictEqual(isCacheFresh(file(now + 5000), h1, now), false);

// 4) DENEY KOLU (DIVAN_CONFIG): baska bir config dosyasiyla kosulan kol, onceki kolun prob
//    sonuclarini KULLANAMAZ. Aynı-aile deneyinin ve M5 kor degerlendirmesinin on sarti bu:
//    kollar ayni kodu farkli kadroyla kosar, prob sonucu kadroya bagli olmak zorundadir.
{
  const kol = (koltuklar: Record<string, { model: string; fallbacks: string[] }>) =>
    ({ seats: koltuklar, budget: { maxCalls: 30 }, search: { perPhaseCap: 3 } }) as never;
  const ana = kol({
    visionary: { model: "x-ai/grok-4.6", fallbacks: ["x-ai/grok-4.5"] },
    auditor: { model: "deepseek/deepseek-v4-pro", fallbacks: ["deepseek/deepseek-v3.2"] },
  });
  const ayniAile = kol({
    visionary: { model: "anthropic/claude-sonnet-5", fallbacks: ["anthropic/claude-opus-5"] },
    auditor: { model: "anthropic/claude-sonnet-5", fallbacks: ["anthropic/claude-opus-5"] },
  });
  const anaOzet = configHashOf(ana);
  const kolOzet = configHashOf(ayniAile);
  assert.notStrictEqual(anaOzet, kolOzet, "farkli kol farkli ozet vermeli");

  const t = 1_700_000_000_000;
  const anaOnbellek = { configHash: anaOzet, savedAt: t - 1000, results: [] };
  assert.strictEqual(isCacheFresh(anaOnbellek, anaOzet, t), true, "kendi kolunda taze");
  assert.strictEqual(
    isCacheFresh(anaOnbellek, kolOzet, t),
    false,
    "deney kolu onceki kolun prob sonuclarini kullanamaz (yeniden problanir)",
  );

  // YALNIZ fallback degisse bile ozet degisir: sema-kritik yonlendirme fallback'e de bakar.
  const fallbackFarki = kol({
    visionary: { model: "x-ai/grok-4.6", fallbacks: ["x-ai/grok-4.5"] },
    auditor: { model: "deepseek/deepseek-v4-pro", fallbacks: ["anthropic/claude-opus-5"] },
  });
  assert.notStrictEqual(configHashOf(fallbackFarki), anaOzet, "fallback degisikligi de onbellegi dusurmeli");
}

console.log("PROBE_CACHE_TEST_OK: asimetri (dusen yazilmaz) + config ozeti + omur/tazelik + deney kolu yeniden problanir");
