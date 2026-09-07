// Persona çiftlenmesi ölçer (M2-A3 K-1). Kimlik katmanı (D-1) geldikten sonra faz talimatlarındaki
// persona paragrafları BORÇ haline geldi: aynı cümle her çağrıda iki kez gidiyor. Bu yalnız token
// israfı değil, bakım tuzağı: kimliği değiştiren kişi faz dosyasındaki kopyayı unutur ve koltuk iki
// farklı şey söylemeye başlar. Tek doğru yer kimlik dosyasıdır; faz dosyası FAZIN işini anlatır.
//
// Ölçüm birebir cümle eşitliği DEĞİL: "Sen parçalara değil, parçaların arasındaki ilişkiye
// bakarsın" ile "Parçalara değil parçaların arasındaki ilişkiye bakarsın" farklı cümlelerdir ama
// aynı çiftlenmedir. Bu yüzden normalize edilmiş kelime dizisinde ortak N-gram aranır.
//
// Eşik 6, tahminle değil bu repoda ölçülerek seçildi. Temizlenmiş prompt setinde n=5 sıfır bulgu
// veriyor, yani beşinci kelimeye kadar inmek yanlış pozitif üretmiyor. n=4'te tek bir yanlış
// pozitif çıkıyor: Müh-2'nin faz talimatındaki "birinci mühendisin ve mimarın". Bu bir persona
// tekrarı değil, koltuğun işini tarif ederken başka koltuklara yaptığı isim göndermesi; ölçer onu
// çiftlenme sanarsa gerçek bulguların arasına gürültü karışır. 6, son temiz eşiğin bir kelime
// üstünde durur ve o payı bilerek bırakır.

/** Noktalama ve büyük/küçük farkını atar; Türkçe harfler korunur. */
function kelimeler(metin: string): string[] {
  return metin
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export const NGRAM = 6;

/**
 * Eşiğin altında kalan kısa tekrarlar için ikinci ölçüm: birebir aynı CÜMLE. "Moderatörsün, yargıç
 * değilsin." dört kelimedir, altı kelimelik pencereye girmez ama çiftlenmenin ta kendisidir.
 */
export function sharedSentences(a: string, b: string): string[] {
  const bol = (m: string) =>
    m
      .split(/(?<=[.!?:])\s+|\n+/)
      .map((c) => c.trim().toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " "))
      .filter((c) => c.split(" ").length >= 3);
  const bSet = new Set(bol(b));
  return [...new Set(bol(a).filter((c) => bSet.has(c)))];
}

/** İki metnin paylaştığı, NGRAM kelime ve daha uzun ortak dizileri döndürür. */
export function sharedPhrases(a: string, b: string, n: number = NGRAM): string[] {
  const ka = kelimeler(a);
  const kb = kelimeler(b);
  const bSet = new Set<string>();
  for (let i = 0; i + n <= kb.length; i++) bSet.add(kb.slice(i, i + n).join(" "));
  const bulunan: string[] = [];
  for (let i = 0; i + n <= ka.length; i++) {
    const parca = ka.slice(i, i + n).join(" ");
    if (bSet.has(parca)) bulunan.push(parca);
  }
  // Kayan pencere aynı çiftlenmeyi n kez üretir (her kaydırma bir bulgu). Ardışık pencereler
  // birleştirilir, yoksa tek bir kopyalanmış cümle onlarca bulgu gibi görünür ve sayı yalan söyler.
  const tekil: string[] = [];
  for (const parca of bulunan) {
    const onceki = tekil[tekil.length - 1];
    const kuyruk = onceki?.split(" ").slice(-(n - 1)).join(" ");
    if (onceki && kuyruk === parca.split(" ").slice(0, n - 1).join(" ")) {
      tekil[tekil.length - 1] = `${onceki} ${parca.split(" ").at(-1)}`;
      continue;
    }
    tekil.push(parca);
  }
  return tekil;
}
