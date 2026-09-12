// Konumsal anonimlik (DESIGN §6.1, M2-C-4). Saf: rastgelelik yok, IO yok, state yok.
//
// Neden var: kimlikleri maskelemek yetmiyor. "Görüş 1..N" ve "Sıralayıcı 1..N" numaraları
// KANONİK sırada veriliyordu, yani numara sabit bir koltuk adresiydi. Bir oturumda Sıralayıcı 2
// hep Müh-1, Sıralayıcı 3 hep Mimar oluyordu; bu bir kez öğrenildiğinde maskeleme delinir.
// Ölçüldü: 7 Eylül koşumunda Baş Danışman taslağında sıralayıcı numaralarını koltuklarla
// eşleştirerek yazdı.
//
// Karıştırma OTURUMA BAĞLI ve DETERMİNİSTİK: aynı oturumda aynı numara hep aynı koltuğu gösterir
// (yoksa iki faz arasında "Görüş 2" başka biri olur ve kurul kendi tartışmasını takip edemez),
// ama iki farklı oturumda aynı olmaz. Kayıt (transkript) kanonik kalır: denetlenebilirlik
// anonimlikten önce gelir ve ikisi çakışmaz, çünkü kayıt ileri TAŞINMAZ.

/** Tohumdan türeyen, kararlı ve ucuz bir sözde-rastgele üreteç (mulberry32). */
function uretec(tohum: number): () => number {
  let a = tohum >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Metin tohumu -> sayı. Aynı metin hep aynı sayıyı verir (FNV-1a). */
export function seedOf(metin: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < metin.length; i++) {
    h ^= metin.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * `n` uzunluğunda bir permütasyon döndürür: `p[i]` = yeni sıradaki i. konuma gelen ÖĞENİN
 * kanonik indeksi. Aynı tohum + aynı n her zaman aynı diziyi verir.
 */
export function permutation(seed: string, n: number): number[] {
  const dizi = Array.from({ length: n }, (_, i) => i);
  const rnd = uretec(seedOf(seed));
  // Fisher-Yates, sondan başa: her adımda kalan aralıktan bir öğe seçilir.
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [dizi[i], dizi[j]] = [dizi[j], dizi[i]];
  }
  return dizi;
}

/** Diziyi oturum tohumuna göre karıştırır. Girdiyi değiştirmez. */
export function shuffleBySeed<T>(items: readonly T[], seed: string): T[] {
  return permutation(seed, items.length).map((i) => items[i]);
}
