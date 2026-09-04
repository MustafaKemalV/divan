// Cevap zarfı sınıflandırması (docs/CEVAP-ZARFI.md). Saf ve MÜHÜRSÜZ: `server-only` taşımaz,
// çünkü hiçbir gizli bilgiye dokunmaz ve izole test edilebilir olması gerekir.
//
// Varlık sebebi bir arıza: ilk gerçek oturumda Denetçi'nin cevabı token tavanına çarpıp boş döndü;
// sağlayıcı bunu finish_reason="length" ile açıkça söylüyordu, kod o alanı okumuyordu ve boşluğu
// "şemaya uymadı" diye yorumluyordu. Yanlış teşhis, çalışmayan mekanizmadan tehlikelidir.

import type { UsageInfo } from "./client.ts";

/** Sağlayıcı cevabı kesildi: ALTYAPI ARIZASI, koltuğun hatası değil. */
export class TruncatedResponseError extends Error {
  readonly completionTokens: number;
  readonly reasoningTokens: number;
  readonly maxTokens: number;
  /** Kesilen çağrı da FATURALANIR: harcanan para hatayla birlikte taşınır, kaybolmaz. */
  readonly usage?: UsageInfo;
  readonly servedModel?: string;

  constructor(args: {
    completionTokens: number;
    reasoningTokens: number;
    maxTokens: number;
    usage?: UsageInfo;
    servedModel?: string;
  }) {
    super(
      `cevap token tavanına çarptı (finish_reason=length): tavan ${args.maxTokens}, ` +
        `üretilen ${args.completionTokens} token, bunun ${args.reasoningTokens}'i düşünmeye gitti. ` +
        `İçerik üretilmeden kesildi; bu koltuğun şema disiplini sorunu DEĞİL, tavan sorunudur.`,
    );
    this.name = "TruncatedResponseError";
    this.completionTokens = args.completionTokens;
    this.reasoningTokens = args.reasoningTokens;
    this.maxTokens = args.maxTokens;
    this.usage = args.usage;
    this.servedModel = args.servedModel;
  }
}

/**
 * Sağlayıcının bize söylediğini OKUR ve sınıflar. Sorunlu her durumda hata fırlatır; sessiz
 * geçilen tek bir zarf durumu yoktur.
 */
export function classifyEnvelope(
  raw: { content: string; finishReason?: string; usage?: UsageInfo; servedModel?: string },
  maxTokens: number,
): void {
  if (raw.finishReason === "length") {
    throw new TruncatedResponseError({
      completionTokens: raw.usage?.completionTokens ?? 0,
      reasoningTokens: raw.usage?.reasoningTokens ?? 0,
      maxTokens,
      usage: raw.usage,
      servedModel: raw.servedModel,
    });
  }
  if (raw.finishReason === "content_filter") {
    throw new Error("sağlayıcı içeriği süzdü (finish_reason=content_filter); içerik alınamadı");
  }
  if (!raw.content.trim()) {
    throw new Error(
      `sağlayıcı boş içerik döndürdü (finish_reason=${raw.finishReason ?? "bilinmiyor"}, ` +
        `üretilen ${raw.usage?.completionTokens ?? 0} token)`,
    );
  }
}
