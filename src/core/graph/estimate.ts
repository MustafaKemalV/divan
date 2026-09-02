// Faz maliyeti KESTİRİMİ (bütçe kapısı girdisi). Saf fonksiyon, izole test edilir.
//
// Bu modül ölçüm yapmaz, KESTİRİM yapar ve ikisi asla aynı statüde sunulmaz. Kestirim, oturum
// içinde o koltuğun ŞİMDİYE KADAR gözlenen ortalamasından türetilir; hiç konuşmamış bir koltuk
// için tahmin üretilmez, "gözlemsiz" olarak sayılır.
//
// Neden koltuk bazlı: aynı küçük prob için koltuklar arası fiyat farkı 21 kata çıktı
// (docs/M2-OLCUMLER.md). Toplam çağrı sayısını ortalama bir fiyatla çarpmak, pahalı koltukların
// çok konuştuğu fazlarda yanıltıcı bir rakam üretir.
//
// Not (DESIGN §5): çağrı adedi tavanı YAPISAL frendir ve para tavanına çevrilmez. Buradaki
// kestirim yalnız Şah'ın kapıda gördüğü bilgidir; akışı kestiren şey hâlâ çağrı sayısıdır.

export interface CostEstimate {
  /** gözlenen ortalamalardan türetilen tamsayı nano-USD; ÖLÇÜM DEĞİL */
  nanoUsd: number;
  /** kestirime katılabilen (daha önce konuşmuş) koltuk sayısı */
  observedSeats: number;
  /** hiç konuşmamış, dolayısıyla kestirilemeyen koltuk sayısı */
  unobservedSeats: number;
}

/**
 * Bir fazın maliyet kestirimi: her koltuk için (gözlenen toplam / gözlenen çağrı) x bu fazdaki
 * çağrı adedi. Gözlemsiz koltuk için sıfır eklenir ve ayrıca sayılır: eksik bilgi, sıfır maliyet
 * gibi gösterilmez.
 */
export function estimatePhaseCost(
  seats: readonly string[],
  seatCostNano: Record<string, number>,
  seatCalls: Record<string, number>,
): CostEstimate {
  let nanoUsd = 0;
  let observedSeats = 0;
  let unobservedSeats = 0;
  for (const seat of seats) {
    const calls = seatCalls[seat] ?? 0;
    const cost = seatCostNano[seat] ?? 0;
    if (calls > 0 && cost > 0) {
      nanoUsd += Math.round(cost / calls);
      observedSeats += 1;
    } else {
      unobservedSeats += 1;
    }
  }
  return { nanoUsd, observedSeats, unobservedSeats };
}
