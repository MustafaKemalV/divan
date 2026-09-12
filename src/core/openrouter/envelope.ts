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

/** Bir arama sonucu alıntısı (OpenRouter web eklentisi, `url_citation`). */
export interface SearchCitation {
  url: string;
  title?: string;
  /** arama parçası: §6.2'nin kanıt defterine URL ile birlikte giren metin */
  content?: string;
}

/**
 * Sağlayıcı cevabının ÖLÇÜM alanlarını okur. Saf: girdi ham JSON, çıktı sayılar.
 *
 * Okunmayan alan olmayan alandır. 2026-09-11 probu üç alanın kayıtta olmadığını gösterdi ve
 * üçü de M2-C'nin ölçemeyeceği şeyleri ölçüyor: `annotations` kanıt kapısının dayanağı,
 * `cache_write_tokens` önbellek işaretlemesinin bedeli, `upstream_inference_cost` arama ücretini
 * model ücretinden ayıran tek alan.
 */
export function readUsage(data: unknown): UsageInfo | undefined {
  const u = (data as { usage?: Record<string, unknown> })?.usage;
  if (!u) return undefined;
  const pd = u.prompt_tokens_details as { cached_tokens?: number; cache_write_tokens?: number } | undefined;
  const cd = u.completion_tokens_details as { reasoning_tokens?: number } | undefined;
  const kd = u.cost_details as { upstream_inference_cost?: number } | undefined;
  return {
    promptTokens: u.prompt_tokens as number | undefined,
    completionTokens: u.completion_tokens as number | undefined,
    totalTokens: u.total_tokens as number | undefined,
    cost: u.cost as number | undefined,
    reasoningTokens: cd?.reasoning_tokens,
    cachedTokens: pd?.cached_tokens,
    cacheWriteTokens: pd?.cache_write_tokens,
    upstreamCost: kd?.upstream_inference_cost,
  };
}

/** Cevabın taşıdığı arama alıntıları. Arama yapılmadıysa boş dizi; `undefined` ile karışmaz. */
export function readCitations(data: unknown): SearchCitation[] {
  const ann = (data as { choices?: { message?: { annotations?: unknown[] } }[] })?.choices?.[0]?.message
    ?.annotations;
  if (!Array.isArray(ann)) return [];
  const out: SearchCitation[] = [];
  for (const a of ann) {
    const kayit = a as { type?: string; url_citation?: { url?: string; title?: string; content?: string } };
    if (kayit?.type !== "url_citation" || typeof kayit.url_citation?.url !== "string") continue;
    out.push({ url: kayit.url_citation.url, title: kayit.url_citation.title, content: kayit.url_citation.content });
  }
  return out;
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
