// Koltuk kontrolü = şema probu (DESIGN §7). Açılışta her config'li modele küçük bir
// structured-output çağrısı atılır; uyum sağlamayan koltuğa M2'de şema-kritik çağrı
// (puanlama/etiket/hüküm) YÖNLENDİRİLMEZ. server-only mühürlü.

import "server-only";
import { chat, hasApiKey } from "../openrouter/client";
import { SEATS, type Seat } from "./seats";
import type { DivanConfig } from "../config/schema";

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
): Promise<SeatProbeResult> {
  const base = { seatId: seat.id, title: seat.title, family: seat.family, model };
  try {
    const { content, servedModel } = await chat({
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
    const parsed = JSON.parse(content) as { ok?: unknown; seat?: unknown };
    // Fable F-2: eko birebir doğrulanır; herhangi bir string değil, tam olarak seat.id beklenir.
    if (parsed.ok === true && typeof parsed.seat === "string" && parsed.seat === seat.id) {
      // Fable F-1: pass'i pin'e atfetmeden önce cevabı kimin verdiğine bak; fallback verdiyse gizleme.
      if (servedModel && servedModel !== model) {
        return {
          ...base,
          servedModel,
          status: "pass-via-fallback",
          detail: `cevabı fallback verdi: ${servedModel}`,
        };
      }
      return { ...base, servedModel, status: "pass" };
    }
    return {
      ...base,
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

/** 7 koltuğu paralel probla. Anahtar yoksa hepsini no-key olarak döndür (para/patlama yok). */
export async function probeAllSeats(config: DivanConfig): Promise<SeatProbeResult[]> {
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

  return Promise.all(
    SEATS.map((s) => {
      const sm = config.seats[s.id];
      return probeSeat(s, sm.model, [sm.model, ...sm.fallbacks]);
    }),
  );
}
