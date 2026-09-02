// Koltuk kontrolü = şema probu (DESIGN §7). Açılışta her config'li modele küçük bir
// structured-output çağrısı atılır; uyum sağlamayan koltuğa M2'de şema-kritik çağrı
// (puanlama/etiket/hüküm) YÖNLENDİRİLMEZ. server-only mühürlü.

import "server-only";
import { chat, hasApiKey } from "../openrouter/client.ts";
import { toNanoUsd } from "../graph/usage.ts";
import { SEATS, type Seat } from "./seats.ts";
import type { DivanConfig } from "../config/schema.ts";
import {
  cacheableResults,
  configHashOf,
  isCacheFresh,
  readProbeCacheFile,
  writeProbeCacheFile,
} from "./probeCache.ts";

export type ProbeStatus = "pass" | "pass-via-fallback" | "fail" | "no-key";

export interface SeatProbeResult {
  seatId: string;
  title: string;
  family: string;
  model: string;
  /** cevabı gerçekte veren model; pin'den farklıysa status = pass-via-fallback (Fable F-1) */
  servedModel?: string;
  status: ProbeStatus;
  detail?: string;
  /** sonuç bu koşumda mı alındı, yoksa önbellekten mi geldi (görünürlük; §7) */
  fromCache?: boolean;
  /**
   * Bu probun maliyeti (tamsayı nano-USD) ve zamanı. OTURUM SAYACINA GİRMEZ: prob grafın
   * dışında ve farklı bir ritimde (config başına, günde bir) koşar; oturum maliyetine karışması
   * hesabı kirletirdi. Kayıt kendi maliyetini taşır ve koltuk kontrolü ekranında görünür.
   */
  costNanoUsd?: number;
  probedAt?: number;
}

// Probun beklediği minimal şema. Model bunu birebir döndürebiliyorsa structured-output stabil.
const PROBE_JSON_SCHEMA = {
  name: "divan_probe",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["ok", "seat"],
    properties: {
      ok: { type: "boolean" },
      seat: { type: "string" },
    },
  },
} as const;

async function probeSeat(
  seat: Seat,
  model: string,
  models: string[],
  now: number = Date.now(),
): Promise<SeatProbeResult> {
  const base = { seatId: seat.id, title: seat.title, family: seat.family, model, probedAt: now };
  try {
    const { content, servedModel, usage } = await chat({
      model,
      models,
      messages: [
        { role: "system", content: "Yalnızca istenen JSON nesnesini döndür, başka hiçbir şey yazma." },
        { role: "user", content: `Koltuk kontrolü. Tam olarak şu JSON'u döndür: {"ok": true, "seat": "${seat.id}"}` },
      ],
      jsonSchema: PROBE_JSON_SCHEMA,
      // Reasoning modelleri asıl JSON'dan önce reasoning token harcar (gemini bu görevde ~212,
      // deepseek ~63). Düşük tavan content'i aç bırakıp yanlış-negatif "fail" üretir; bol tut.
      maxTokens: 1024,
    });
    const cost = usage?.cost === undefined ? {} : { costNanoUsd: toNanoUsd(usage.cost) };
    const parsed = JSON.parse(content) as { ok?: unknown; seat?: unknown };
    // Fable F-2: eko birebir doğrulanır; herhangi bir string değil, tam olarak seat.id beklenir.
    if (parsed.ok === true && typeof parsed.seat === "string" && parsed.seat === seat.id) {
      // Fable F-1: pass'i pin'e atfetmeden önce cevabı kimin verdiğine bak; fallback verdiyse gizleme.
      if (servedModel && servedModel !== model) {
        return {
          ...base,
          ...cost,
          servedModel,
          status: "pass-via-fallback",
          detail: `cevabı fallback verdi: ${servedModel}`,
        };
      }
      return { ...base, ...cost, servedModel, status: "pass" };
    }
    return {
      ...base,
      ...cost,
      servedModel,
      status: "fail",
      detail:
        parsed.ok === true && typeof parsed.seat === "string"
          ? `koltuk ekosu uyuşmadı (beklenen ${seat.id})`
          : "structured-output şema uyumsuz",
    };
  } catch (e) {
    return { ...base, status: "fail", detail: (e as Error).message.slice(0, 200) };
  }
}

export interface ProbeOptions {
  /** elle tazeleme: önbelleği yok say, hepsini yeniden probla (§7) */
  refresh?: boolean;
  /** test edilebilirlik: zaman dışarıdan verilebilir */
  now?: number;
}

/**
 * 7 koltuğu probla. Anahtar yoksa hepsini no-key olarak döndür (para/patlama yok).
 *
 * Önbellek (§7): geçerli önbellekteki koltuklar YENİDEN PROBLANMAZ. Asimetri gereği önbellekte
 * yalnız geçen koltuklar bulunur, dolayısıyla düşen bir koltuk her açılışta yeniden denenir.
 * Önbellek damgası taze kayıt varken korunur: aksi halde her koşum ömrü sıfırlar ve önbellek
 * hiç eskimezdi.
 */
export async function probeAllSeats(
  config: DivanConfig,
  opts: ProbeOptions = {},
): Promise<SeatProbeResult[]> {
  if (!hasApiKey()) {
    return SEATS.map((s) => ({
      seatId: s.id,
      title: s.title,
      family: s.family,
      model: config.seats[s.id]?.model ?? "-",
      status: "no-key" as const,
      detail: "OPENROUTER_API_KEY yok (.env.local)",
    }));
  }

  const now = opts.now ?? Date.now();
  const hash = configHashOf(config);
  const file = opts.refresh ? undefined : readProbeCacheFile();
  const cachedList = isCacheFresh(file, hash, now) && file ? file.results : [];
  const cachedById = new Map(cachedList.map((r) => [r.seatId, r]));

  const fresh = await Promise.all(
    SEATS.filter((s) => !cachedById.has(s.id)).map((s) => {
      const sm = config.seats[s.id];
      return probeSeat(s, sm.model, [sm.model, ...sm.fallbacks], now);
    }),
  );
  const freshById = new Map(fresh.map((r) => [r.seatId, r]));

  const all: SeatProbeResult[] = SEATS.map((s) => {
    const c = cachedById.get(s.id);
    if (c) return { ...c, fromCache: true };
    return freshById.get(s.id) as SeatProbeResult;
  });

  writeProbeCacheFile({
    configHash: hash,
    savedAt: cachedList.length > 0 && file ? file.savedAt : now,
    results: cacheableResults(all).map(({ fromCache: _drop, ...r }) => r),
  });

  return all;
}
