// Maliyet toplama (DESIGN §7 canlı maliyet sayacı). Saf fonksiyonlar, izole test edilir.
//
// İki ilke:
//
// 1) BİLİNMEYEN TAHMİN EDİLMEZ. Sağlayıcı `cost` bildirmezse token sayısından fiyat üretmeyiz;
//    üretmek, elimizdeki fiyat listesinin doğru olduğunu varsaymak demektir ve o varsayım
//    sessizce eskiyip kendinden emin bir yanlış rakam gösterir. Bilinmeyen maliyet "bilinmiyor"
//    olarak SAYILIR ve toplamla birlikte sunulur.
//
// 2) PARA FLOAT OLARAK YAŞAMAZ. Sağlayıcının ham değeri bir kez tamsayı nano-USD'ye çevrilir,
//    bütün toplama tamsayı üzerinde yapılır, biçimlendirme EN SONDA olur. Gerekçe: maliyet M3'te
//    karar.json'a girecek, yani deterministik zincirin parçası olacak; aynı oturumun iki kez
//    hesaplanması bit-birebir aynı sayıyı vermeli. Kayan nokta sürüklenmesi orada yasaktır.
//    (Bu kural teorik değil: float toplama yüzünden bu modülün ilk testi düşmüştü.)

/** 1 USD = 1e9 nano-USD. Sağlayıcıların ondalık hassasiyeti bu ölçeğin çok üstünde kalır. */
export const NANO_PER_USD = 1_000_000_000;

export interface UsageLike {
  usage?: { totalTokens?: number; cost?: number };
}

export interface UsageTotals {
  /** tamsayı nano-USD; toplama hep bu birimde yapılır */
  costNanoUsd: number;
  totalTokens: number;
  /** maliyeti sağlayıcı tarafından bildirilmeyen çağrı sayısı */
  costUnknownCalls: number;
}

/** Sağlayıcının ham USD değerini tamsayı nano-USD'ye çevirir (tek dönüşüm noktası). */
export function toNanoUsd(cost: number): number {
  return Math.round(cost * NANO_PER_USD);
}

/** Gösterim/serileştirme için: tamsayı nano-USD -> USD metni. Biçimlendirme EN SONDA yapılır. */
export function formatUsd(nano: number, fractionDigits = 6): string {
  return (nano / NANO_PER_USD).toFixed(fractionDigits);
}

export function usageOf(outs: UsageLike[]): UsageTotals {
  return {
    costNanoUsd: outs.reduce((n, o) => n + (o.usage?.cost === undefined ? 0 : toNanoUsd(o.usage.cost)), 0),
    totalTokens: outs.reduce((n, o) => n + (o.usage?.totalTokens ?? 0), 0),
    costUnknownCalls: outs.filter((o) => o.usage?.cost === undefined).length,
  };
}
