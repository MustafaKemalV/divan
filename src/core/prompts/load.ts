// Prompt yükleyici (DESIGN §7). Promptlar KODDA DEĞİL, `prompts/<koltuk>-<faz>.md` dosyalarında
// durur: düzenlenmeleri Şah onayı gerektirmez, denetim izi git geçmişidir. İlke şudur: bir mekanik
// yalnızca promptta duruyorsa zaten zorlanmıyor demektir; §6 mekanikleri şema ve graf kenarıyla
// zorlanır, prompt onları yalnız açıklar. Framework-bağımsız.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export const PROMPTS_DIR = process.env.DIVAN_PROMPTS_DIR ?? join(process.cwd(), "prompts");

const cache = new Map<string, string>();

/**
 * Faz adını dosya adına çevirir. Küçük kurul varyantları ana fazın promptunu kullanır: kadro
 * değişir, fazın GÖREVİ değişmez (F2s:idea -> F2-idea). Ayraç ":" dosya adında "-" olur.
 */
export function promptFileName(seatId: string, phase: string): string {
  const mainPhase = phase.replace(/^F(\d)s:/, "F$1:").replace(/:/g, "-");
  return `${seatId}-${mainPhase}.md`;
}

/** Prompt metnini döndürür. Eksik dosya SESSİZ geçilmez: koltuk sessiz bir varsayılanla konuşamaz. */
export function loadPrompt(seatId: string, phase: string): string {
  const file = promptFileName(seatId, phase);
  const cached = cache.get(file);
  if (cached !== undefined) return cached;
  let text: string;
  try {
    text = readFileSync(join(PROMPTS_DIR, file), "utf8");
  } catch {
    throw new Error(
      `Prompt dosyası bulunamadı: prompts/${file} (koltuk "${seatId}", faz "${phase}"). ` +
        `Her koltuk-faz çifti için bir prompt dosyası gerekir; varsayılan metinle konuşulmaz.`,
    );
  }
  // Başlık satırı (# ...) insan içindir, modele gitmez.
  const body = text.replace(/^#[^\n]*\n/, "").trim();
  cache.set(file, body);
  return body;
}

/** Test/geliştirme: dosya değişince yeniden okunsun. */
export function clearPromptCache(): void {
  cache.clear();
}
