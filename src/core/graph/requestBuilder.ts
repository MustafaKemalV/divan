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
 * ARAMA FAZI (DESIGN §6.2 M2-C): eklenti YALNIZ kodun yaptığı kısa arama çağrısına eklenir.
 *
 * Eskiden denetim, fizibilite ve final denetim çağrılarının kendilerine ekleniyordu ve eklenti
 * sorguyu PROMPT'UN TAMAMINDAN türetiyordu; 15 Eylül probu 35k karakterlik bir denetim prompt'uyla
 * koşulduğunda Exa'nın başkalarının aynı adlı repolarını getirdiğini ölçtü. Artık sorguyu Denetçi
 * yazar (adım 1), kod arar (adım 2, bu faz), Denetçi sonuçlarla denetler (adım 3).
 */
export const ARAMA_FAZLARI: ReadonlySet<string> = new Set(["F4:search", "F4s:search"]);

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
 * Üç şart birden: koltuğun yetkisi, fazın ARAMA FAZI olması, ve kapın dolmamış olması.
 *
 * İade çağrısına ayrı bir kural gerekmiyor artık: iade `F4:audit` fazındadır, arama fazı değil,
 * yani eklenti oraya zaten eklenmez. Kural yapıdan çıkıyor, ayrı bir koşuldan değil.
 */
export function aramaKarari(
  seatId: string,
  input: SeatRunInput,
  fazdaYapilanArama: number,
  perPhaseCap: number,
): AramaKarari {
  const seat = getSeat(seatId);
  if (!seat?.webTool) return { eklensin: false };
  if (!ARAMA_FAZLARI.has(input.phase)) return { eklensin: false };
  if (fazdaYapilanArama >= perPhaseCap) {
    // D-8 mantığı: kapa dayanan mekanizma çağrısı YAPILMAZ ve bu kayda geçer. Sessizce
    // aramadan geçmek, "aradık ama bulamadık" ile "hiç aramadık"ı ayırt edilemez kılardı.
    return { eklensin: false, sebep: `arama kap yüzünden yapılmadı (faz kapı ${perPhaseCap} doldu)` };
  }
  return { eklensin: true };
}

/** Mesaj içeriği: düz metin ya da işaretlenebilir parçalar (client.ts ContentPart ile aynı şekil). */
export type IcerikParcasi = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };

/**
 * SİSTEM MESAJI (D-1 katman sırası, SEÇENEK A): kimlik + zarf/fikir/ek özeti + faz talimatı.
 *
 * Anthropic modellerinde iki `cache_control` işareti konur: (2)'nin ve (3)'ün sonunda. Birincisi
 * bir koltuğun BÜTÜN fazlarının paylaştığı ön eki önbelleğe alır; ikincisi aynı fazdaki iade ve
 * yeniden deneme çağrıları içindir, onlar faz talimatını da paylaşır.
 *
 * Diğer sağlayıcılara AYNI SIRA düz metin olarak gider: otomatik önbellekleri de birebir ön ek
 * ister, yani sıranın kendisi onlara da yarar. İşaret koymak yalnız Anthropic'te anlamlı olduğu
 * için oraya konur; sırayı sağlayıcıya göre değiştirmek iki ayrı davranış demek olurdu.
 */
export function buildSystemContent(args: {
  model: string;
  kimlik: string;
  zarfFikirEk: string;
  fazTalimati: string;
}): string | IcerikParcasi[] {
  const { kimlik, zarfFikirEk, fazTalimati } = args;
  if (!args.model.startsWith("anthropic/")) {
    return [kimlik, zarfFikirEk, fazTalimati].filter((p) => p.trim()).join("\n\n---\n\n");
  }
  const parcalar: IcerikParcasi[] = [{ type: "text", text: kimlik }];
  // Boş bir bloğu işaretlemek anlamsız: F0 brifingi zarfsız koşar (buildEnvelope faz görünürlüğü).
  if (zarfFikirEk.trim()) {
    parcalar.push({ type: "text", text: zarfFikirEk, cache_control: { type: "ephemeral" } });
  }
  parcalar.push({ type: "text", text: fazTalimati, cache_control: { type: "ephemeral" } });
  return parcalar;
}

export interface IstekParcalari {
  system: string | IcerikParcasi[];
  user: string;
  plugins?: WebPlugin[];
  /** arama yapılmadıysa sebebi (varsa); çağrı kaydına ve transkripte girer */
  aramaAtlandi?: string;
}

/**
 * İsteğin parçalarını kurar. Mesaj metinlerini KURMAZ (o `load.ts` ve `userMessage.ts`'in işi),
 * onları alır ve isteğin geri kalanını ekler.
 */
/** Arama çağrısı mı: sistem yalnız arama talimatı, kullanıcı yalnız ham sorgu. */
export const aramaCagrisi = (phase: string) => ARAMA_FAZLARI.has(phase);

export function buildRequest(args: {
  seatId: string;
  input: SeatRunInput;
  system: string | IcerikParcasi[];
  user: string;
  /** arama çağrısının sistem mesajı: yalnız bu, kimliksiz ve zarfsız (H-1) */
  fazTalimati: string;
  fazdaYapilanArama: number;
  perPhaseCap: number;
  maxResults: number;
}): IstekParcalari {
  const karar = aramaKarari(args.seatId, args.input, args.fazdaYapilanArama, args.perPhaseCap);

  /**
   * ARAMA ÇAĞRISI YALINDIR (H-1). Sistem YALNIZ arama talimatıdır: kimlik yok, zarf yok, fikir yok,
   * ek özeti yok. Kullanıcı mesajı HAM SORGUDUR: "BAĞLAM (...)" etiketi bile yok.
   *
   * Sebep ölçülmüş bir arızadır: eklenti sorguyu prompt'un tamamından türetiyor (15 Eylül probu).
   * Üç adımlı topraklamanın bütün kazancı, arama çağrısının kısa olmasından geliyor; oraya 1.500
   * karakterlik bir zarf koymak, kaçmak için kurduğumuz şeyi geri getirmek olurdu. Bu çağrıda
   * modelin bir kimliğe ihtiyacı da yok: yorum yapmıyor, yalnız arıyor.
   *
   * `cache_control` DA KONMAZ: işaret bir ön eki önbelleğe almak içindir, burada paylaşılan bir
   * ön ek yok (her arama çağrısının metni farklı) ve işaretin kendisi de ücretli bir yazma tetikler.
   */
  if (aramaCagrisi(args.input.phase)) {
    return {
      system: args.fazTalimati,
      user: (args.input.context ?? "").trim(),
      ...(karar.eklensin ? { plugins: [{ id: "web", engine: "exa", max_results: args.maxResults } as WebPlugin] } : {}),
      ...(karar.sebep ? { aramaAtlandi: karar.sebep } : {}),
    };
  }

  return {
    system: args.system,
    user: args.user,
    // engine SABİT "exa": 2026-09-11 probu native'in SIFIR annotation döndürdüğünü ölçtü ve
    // kanıt kapısı (§6.2) annotations'a bağlı. Native ile rozet hak edilemez.
    ...(karar.eklensin ? { plugins: [{ id: "web", engine: "exa", max_results: args.maxResults } as WebPlugin] } : {}),
    ...(karar.sebep ? { aramaAtlandi: karar.sebep } : {}),
  };
}
