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

console.log("PROBE_CACHE_TEST_OK: asimetri (dusen yazilmaz) + config ozeti + omur/tazelik");
