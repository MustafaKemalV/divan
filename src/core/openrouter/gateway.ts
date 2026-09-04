// TEK KAPI: model çağrısı yapabilen tek yol (DESIGN §7). Sağlayıcıya giden her istek buradan
// geçer, dönen her cevap ZARFI burada işlenir. `client.ts` dışa kapalıdır; onu doğrudan çağıran
// kod, izlemeyi ve zarf işlemeyi atlamış olur.
//
// Neden tek kapı: M2-A'da denetim çağrıları izleyiciyi baypas ediyordu ve koltuk bazlı maliyet
// kaydına hiç girmiyordu. Toplam fatura doğruydu ama dağılım eksikti, dolayısıyla bütçe kapısının
// kestirimi de eksik veriyle çalışıyordu. Bir yol varsa baypas edilemez.
//
// Cevap zarfı alan envanteri ve her alanın nasıl ele alındığı: docs/CEVAP-ZARFI.md

import "server-only";
import { chatRaw, type ChatMessage, type JsonSchemaSpec, type UsageInfo } from "./client.ts";
import { classifyEnvelope, TruncatedResponseError } from "./envelope.ts";

export { classifyEnvelope, TruncatedResponseError };

export type { ChatMessage, JsonSchemaSpec, UsageInfo };

export interface ModelCallRequest {
  model: string;
  models?: string[];
  messages: ChatMessage[];
  jsonSchema?: JsonSchemaSpec;
  maxTokens: number;
  signal?: AbortSignal;
}

export interface ModelCallResult {
  content: string;
  /** cevabı GERÇEKTE veren model; pin mi fallback mi olduğunu görünür kılar */
  servedModel?: string;
  usage?: UsageInfo;
  /** sağlayıcının bildirdiği bitiş sebebi (işlenmiş hali) */
  finishReason?: string;
}

/**
 * Modeli çağırır ve cevap zarfını işler. Zarf işleme kuralları:
 *
 *  - `finish_reason === "length"` -> TruncatedResponseError. Kesilmiş bir cevabı "şemaya uymadı"
 *    diye yorumlamak yanlış teşhistir; model bize kesildiğini zaten söylüyor, okunması gerekiyordu.
 *  - `finish_reason === "content_filter"` -> hata: içerik süzüldü, boş içerik sessiz geçmez.
 *  - boş içerik + `stop` -> hata: sağlayıcı iş yaptığını söylüyor ama elimize bir şey geçmedi.
 */
export async function callModel(req: ModelCallRequest): Promise<ModelCallResult> {
  const raw = await chatRaw(req);
  classifyEnvelope(raw, req.maxTokens);
  return {
    content: raw.content,
    servedModel: raw.servedModel,
    usage: raw.usage,
    finishReason: raw.finishReason,
  };
}
