// Koltuk probu önbelleği (DESIGN §7). Prob yedi model çağrısı demektir; her oturumda
// tekrarlamak israftır. Önbellek üç kurala bağlıdır:
//
//   anahtar   : config'in özeti. Koltuk-model eşlemesi değişirse önbellek kendiliğinden düşer.
//   ömür      : ~24 saat. Sağlayıcı davranışı zamanla değişir, sonsuz güven yok.
//   ASİMETRİ  : yalnız GEÇEN sonuçlar önbelleğe yazılır. Bir koltuk düştüyse kaydedilmez ve
//               bir sonraki açılışta yeniden denenir; geçici bir sağlayıcı arızası kalıcı
//               dışlamaya dönüşmemelidir.
//
// Saf mantık (tazelik, asimetri, özet) IO'dan ayrıdır ve izole test edilir.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DivanConfig } from "../config/schema.ts";
import type { SeatProbeResult } from "./probe.ts";

export const PROBE_TTL_MS = 24 * 60 * 60 * 1000;

export const PROBE_CACHE_PATH =
  process.env.DIVAN_PROBE_CACHE ?? join(process.cwd(), ".divan-probe-cache.json");

export interface ProbeCacheFile {
  configHash: string;
  savedAt: number;
  results: SeatProbeResult[];
}

/** Config'in koltuk eşlemesi + kapları üzerinden kararlı özet. Eşleme değişirse önbellek düşer. */
export function configHashOf(config: DivanConfig): string {
  const seats = Object.keys(config.seats)
    .sort()
    .map((id) => `${id}:${config.seats[id].model}|${config.seats[id].fallbacks.join(",")}`)
    .join(";");
  return createHash("sha256").update(seats).digest("hex").slice(0, 16);
}

/** Önbelleğe YALNIZ geçen sonuçlar yazılır (asimetri kuralı). */
export function cacheableResults(results: SeatProbeResult[]): SeatProbeResult[] {
  return results.filter((r) => r.status === "pass" || r.status === "pass-via-fallback");
}

/** Dosyadaki kayıt bu config için ve bu an için hâlâ geçerli mi? */
export function isCacheFresh(
  file: ProbeCacheFile | undefined,
  configHash: string,
  now: number,
  ttlMs: number = PROBE_TTL_MS,
): boolean {
  if (!file) return false;
  if (file.configHash !== configHash) return false;
  if (!Number.isFinite(file.savedAt)) return false;
  const age = now - file.savedAt;
  return age >= 0 && age < ttlMs;
}

export function readProbeCacheFile(path: string = PROBE_CACHE_PATH): ProbeCacheFile | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ProbeCacheFile;
  } catch {
    return undefined;
  }
}

export function writeProbeCacheFile(file: ProbeCacheFile, path: string = PROBE_CACHE_PATH): void {
  try {
    writeFileSync(path, JSON.stringify(file, null, 2), "utf8");
  } catch {
    // Önbellek yazılamadıysa akış durmaz: önbellek bir hızlandırmadır, bir şart değil.
  }
}
