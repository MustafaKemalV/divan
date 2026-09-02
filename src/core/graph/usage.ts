// Maliyet toplama (DESIGN §7 canlı maliyet sayacı). Saf fonksiyon, izole test edilir.
//
// İlke: sağlayıcı `cost` bildirmezse TAHMİN YAPILMAZ. Token sayısından fiyat üretmek, fiyat
// listesinin doğru olduğunu varsaymak demektir ve o varsayım sessizce eskiyip yanlış rakam
// gösterir. Bilinmeyen maliyet, "bilinmiyor" olarak sayılır ve toplamla birlikte sunulur:
// Şah'ın gördüğü rakam eksikse, eksik olduğunu da görmelidir.

export interface UsageLike {
  usage?: { totalTokens?: number; cost?: number };
}

export interface UsageTotals {
  costUsd: number;
  totalTokens: number;
  /** maliyeti sağlayıcı tarafından bildirilmeyen çağrı sayısı */
  costUnknownCalls: number;
}

export function usageOf(outs: UsageLike[]): UsageTotals {
  return {
    costUsd: outs.reduce((n, o) => n + (o.usage?.cost ?? 0), 0),
    totalTokens: outs.reduce((n, o) => n + (o.usage?.totalTokens ?? 0), 0),
    costUnknownCalls: outs.filter((o) => o.usage?.cost === undefined).length,
  };
}
