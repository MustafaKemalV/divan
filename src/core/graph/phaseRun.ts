// Faz içi koşum (DESIGN §7): zaman aşımı, tek yeniden deneme, "koltuk sustu" kaydı ve
// PARALEL çalıştırma. Üç korkuluk burada uygulanır:
//
//   1) Paralellik yalnız FAZ İÇİDİR. Bu modül bir fazın koltuklarını alır; fazlar arası sıra ve
//      kapılar grafın işidir ve değişmez.
//   2) Sonuçlar KANONİK koltuk sırasına göre döner. Tamamlanma sırası ne olursa olsun çıktı
//      dizisi girdi dizisiyle aynı sıradadır, yani transkript deterministik kalır.
//   3) Eksik ses SESSİZ GEÇİLMEZ. Zaman aşımı ya da hata bir başarısızlıktır: bir kez yeniden
//      denenir, yine gelmezse koltuk "sustu" olarak işaretlenir ve Şah'ın görünürlüğüne çıkar.
//
// Maliyet kuralı: cevapsız denemenin maliyeti BİLİNMİYORDUR, asla sıfır. Sağlayıcı iş yapıp
// bize bildirmemiş olabilir; bu yüzden başarısız deneme de "maliyeti bilinmeyen çağrı" sayılır.

import type { SeatRunInput, SeatRunOutput } from "./seatRunner.ts";

export interface SeatOutcome {
  seatId: string;
  /** başarısızlık altyapı kaynaklı mı (tavan/kesilme) yoksa koltuğun kendi hatası mı */
  infraFailure?: boolean;
  /** başarılı çıktı; koltuk sustuysa yoktur */
  out?: SeatRunOutput;
  /** yapılan çağrı denemesi sayısı (1 = ilk seferde döndü, 2 = bir kez yeniden denendi) */
  attempts: number;
  /** iki denemede de cevap gelmediyse true */
  silent: boolean;
  reason?: string;
}

export class SeatTimeoutError extends Error {}

/**
 * KOLTUĞUN CEVABIYLA İLGİLİ OLMAYAN çöküş. `runPhaseSeats` koltuk hatalarını yutup "sustu" der;
 * bir programlama hatasını ya da düğüm düzeyinde bir altyapı çöküşünü yutmaz, çünkü o zaman
 * gerçek arıza "koltuk sustu" diye görünür ve yanlış yerde aranır.
 *
 * T4-3'te gerekli oldu: tek koltuklu düğümler de korkuluklara bağlanınca, koltuk hatası artık
 * düğümü çökertmiyor. Çöken oturum kurtarması (U-14) yine de sınanmalı, ve sınanacak şey koltuk
 * hatası değil DÜĞÜM çöküşü.
 */
export class NodeCrashError extends Error {
  override name = "NodeCrashError";
}

/**
 * Bir sözü süre sınırına bağlar. Sınır aşılırsa `onTimeout` çağrılır (istek iptali buradan
 * tetiklenir) ve hata fırlar.
 *
 * `onTimeout` isteğe bağlı DEĞİL bir gereklilik gibi okunmalı: sınırı aşan bir isteği yalnız
 * beklemeyi bırakmak onu durdurmaz. Sağlayıcı işi yapmaya devam eder, faturayı yazar ve geç
 * cevabı bir sonraki düğümün tamponuna düşer (U-9).
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string, onTimeout?: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout?.();
      reject(new SeatTimeoutError(`zaman aşımı (${ms} ms): ${label}`));
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export type RunFn = (seatId: string, input: SeatRunInput) => Promise<SeatRunOutput>;

/**
 * Bir fazın koltuklarını PARALEL koşturur ve sonuçları KANONİK sırada döndürür.
 * Her koltuk için: çağrı -> (zaman aşımı/hata ise) bir yeniden deneme -> yine olmazsa "sustu".
 */
export async function runPhaseSeats(
  run: RunFn,
  seats: readonly string[],
  inputFor: (seatId: string) => SeatRunInput,
  timeoutMs: number,
): Promise<SeatOutcome[]> {
  const attempt = async (seatId: string): Promise<SeatOutcome> => {
    let lastError = "";
    let infra = false;
    for (let attemptNo = 1; attemptNo <= 2; attemptNo++) {
      // Her deneme kendi iptal kontrolcüsünü taşır: zaman aşımı bu denemeyi iptal eder, sonraki
      // denemeyi değil.
      const kontrol = new AbortController();
      try {
        const out = await withTimeout(
          run(seatId, { ...inputFor(seatId), signal: kontrol.signal }),
          timeoutMs,
          seatId,
          () => kontrol.abort(),
        );
        return { seatId, out, attempts: attemptNo, silent: false };
      } catch (e) {
        // Düğüm çöküşü koltuk hatası değildir: yutulmaz, yukarı gider.
        if ((e as Error).name === "NodeCrashError") throw e;
        lastError = (e as Error).message;
        // Kesilme bir ALTYAPI arızasıdır, koltuğun hatası değil: aynı tavanla yeniden denemek
        // aynı sonucu verir ve boşuna para harcar. Tek deneme, sonra açık arıza kaydı.
        if ((e as Error).name === "TruncatedResponseError") {
          infra = true;
          return { seatId, attempts: attemptNo, silent: true, infraFailure: true, reason: lastError };
        }
      }
    }
    return { seatId, attempts: 2, silent: true, infraFailure: infra, reason: lastError };
  };
  // Promise.all girdi sırasını korur: tamamlanma sırası değişse de çıktı kanonik kalır.
  return Promise.all(seats.map(attempt));
}
