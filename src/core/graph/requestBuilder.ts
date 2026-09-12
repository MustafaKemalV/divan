// İstek kurucu (M2-C-2). Saf ve MÜHÜRSÜZ: `server-only` taşımaz, sağlayıcıya dokunmaz.
// `openrouterRunner` yalnız burada kurulan isteği çağırır.
//
// Neden ayrı modül: bir isteğin İÇİNDE ne olduğu (mesajlar, eklentiler, ileride `cache_control`
// blokları) mekanizmanın kendisidir, ve mekanizma ancak izole test edilebilirse zorlanmış sayılır.
// `openrouterRunner` `server-only` mührü taşıdığı için oradaki hiçbir karar birim testten
// görünmüyordu; `userMessage.ts` aynı sebeple ayrılmıştı.

import { getSeat } from "../seats/seats.ts";
import type { SeatRunInput } from "./seatRunner.ts";

/**
 * ARAMA YAPILAN FAZLAR (DESIGN §6.2 kapsam). Koltuğun `webTool` yetkisi TEK BAŞINA yetmez: yetki
 * "bu koltuk arayabilir" der, faz kümesi "bu işte aramak gerekir" der. İkisi birden olmalı, yoksa
 * Müh-1 her fazda arama yapar ve kap bir fazda tükenir.
 */
export const ARAMALI_FAZLAR: ReadonlySet<string> = new Set([
  "F4:audit",
  "F4s:audit",
  "F4:feasibility",
  "F5:output",
]);

/** Web eklentisi isteği (OpenRouter). `engine` SABİT `exa`. */
export interface WebPlugin {
  id: "web";
  engine: "exa";
  max_results: number;
}

/**
 * Faz kapı ANAHTARI (D-3). DESIGN §6.2 "faz başına kap" derken F4'ü kastediyor, "F4:audit"i
 * değil: aynı fazın fizibilite ve denetim çağrıları tek kapı paylaşır. Dizeyi olduğu gibi saymak
 * "F4:feasibility" ve "F4:audit" için AYRI sayaçlar üretiyordu; bugün bağlayıcı değil (kap 3,
 * F4'te en çok üç aramalı çağrı) ama kap düşürülürse yanlış sayar ve kap hiç dolmaz.
 */
export function fazAnahtari(phase: string): string {
  return phase.split(":")[0];
}

export interface AramaKarari {
  /** eklenti isteğe eklenecek mi */
  eklensin: boolean;
  /** eklenmiyorsa sebebi; kayda giren metin budur, sessiz geçilmez */
  sebep?: string;
}

/**
 * Bu çağrıda arama yapılacak mı?
 *
 * Üç şart birden: koltuğun yetkisi, fazın arama gerektirmesi, ve fazın kapının dolmamış olması.
 * Ayrıca İADE çağrısı (retry >= 1) YENİ ARAMA YAPMAZ: iade, koltuğu kendi çıktısını düzeltmeye
 * çağırmaktır, yeniden araştırmaya değil. İlk çağrının sonuçları bağlam olarak zaten gider;
 * ikinci kez aramak hem para harcar hem de iadeyi "başka bir denetim" haline getirir.
 */
export function aramaKarari(
  seatId: string,
  input: SeatRunInput,
  fazdaYapilanArama: number,
  perPhaseCap: number,
): AramaKarari {
  const seat = getSeat(seatId);
  if (!seat?.webTool) return { eklensin: false };
  if (!ARAMALI_FAZLAR.has(input.phase)) return { eklensin: false };
  if ((input.retry ?? 0) >= 1) {
    return { eklensin: false, sebep: "iade çağrısı yeni arama yapmaz, ilk çağrının sonuçlarını görür" };
  }
  if (fazdaYapilanArama >= perPhaseCap) {
    // D-8 mantığı: kapa dayanan mekanizma çağrısı YAPILMAZ ve bu kayda geçer. Sessizce
    // aramadan geçmek, "aradık ama bulamadık" ile "hiç aramadık"ı ayırt edilemez kılardı.
    return { eklensin: false, sebep: `arama kap yüzünden yapılmadı (faz kapı ${perPhaseCap} doldu)` };
  }
  return { eklensin: true };
}

export interface IstekParcalari {
  system: string;
  user: string;
  plugins?: WebPlugin[];
  /** arama yapılmadıysa sebebi (varsa); çağrı kaydına ve transkripte girer */
  aramaAtlandi?: string;
}

/**
 * İsteğin parçalarını kurar. Mesaj metinlerini KURMAZ (o `load.ts` ve `userMessage.ts`'in işi),
 * onları alır ve isteğin geri kalanını ekler.
 */
export function buildRequest(args: {
  seatId: string;
  input: SeatRunInput;
  system: string;
  user: string;
  fazdaYapilanArama: number;
  perPhaseCap: number;
  maxResults: number;
}): IstekParcalari {
  const karar = aramaKarari(args.seatId, args.input, args.fazdaYapilanArama, args.perPhaseCap);
  return {
    system: args.system,
    user: args.user,
    // engine SABİT "exa": 2026-09-11 probu native'in SIFIR annotation döndürdüğünü ölçtü ve
    // kanıt kapısı (§6.2) annotations'a bağlı. Native ile rozet hak edilemez.
    ...(karar.eklensin ? { plugins: [{ id: "web", engine: "exa", max_results: args.maxResults } as WebPlugin] } : {}),
    ...(karar.sebep ? { aramaAtlandi: karar.sebep } : {}),
  };
}
