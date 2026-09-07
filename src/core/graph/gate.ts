// Kapı sözleşmesi (DESIGN §5, D-5'in bugünkü payı; tek tablo U-10'da). Saf: interrupt bilmez,
// state bilmez, graf bilmez.
//
// Neden var: sözleşme yalnız bütçe kapısında vardı. Diğer üç kapı yanıtı ya hiç okumuyor
// (ERKEN_BRIFING), ya tanımadığı her şeyi "devam" sayıyor (DENETIM_EKSIK), ya da tanımadığı her
// şeyi sessizce "bitir" sayıyordu (HUKUM_EKSIK: `done` olayı normal görünüyor, `endReason` boş).
// Üçü de aynı kuralı deliyordu: **yazım hatası bir onay yerine geçemez, ve hiçbir oturum sebepsiz
// bitmez.**
//
// Kural: tanınmayan yanıt akışı SÜRDÜRMEZ ve oturumu SESSİZCE de bitirmez. Sebebi yazılı bir
// duruş üretir, kurtarma yolunu söyler ve durum korunur.

/** Yanıt sözleşmeye uyuyor mu? Uyuyorsa kanonik aksiyon, uymuyorsa null. */
export function matchGateAnswer(answer: unknown, accepted: readonly string[]): string | null {
  const text = String(answer ?? "").trim().toLowerCase();
  if (!text) return null;
  for (const kabul of accepted) {
    // "re-table:<düğüm>" gibi parametreli kabuller: ön ek eşleşir, gerisi argümandır.
    const acili = kabul.indexOf("<");
    if (acili > 0) {
      const onEk = kabul.slice(0, acili).toLowerCase();
      if (text.startsWith(onEk) && text.length > onEk.length) return text;
      continue;
    }
    if (text === kabul.toLowerCase()) return kabul.toLowerCase();
  }
  return null;
}

/**
 * Sözleşme dışı yanıtın sebepli duruş metni. Yanıt METNİYLE yazılır: Şah ne yazdığını görmeden
 * neyi düzelteceğini bilemez.
 */
export function contractViolation(
  gate: string,
  answer: unknown,
  accepted: readonly string[],
  node: string,
): string {
  return (
    `${gate} kapısında yanıt sözleşmeye uymadı ("${String(answer)}"), akış sürdürülmedi. ` +
    `Kabul edilenler: ${accepted.join(" | ")}. ` +
    `KURTARMA: bu oturum kapanmadı, re-table ile "${node}" düğümünden devam edebilirsiniz; ` +
    `durum ve çağrı sayacı korunur.`
  );
}

/** Şah'ın kapıda bilerek verdiği iptal kararının sebep metni. Sessiz sonlanma yasak (§5). */
export function cancelReason(gate: string, node: string): string {
  return (
    `Şah ${gate} kapısında iptal etti. ` +
    `KURTARMA: durum korunur, re-table ile "${node}" düğümünden devam edilebilir.`
  );
}
