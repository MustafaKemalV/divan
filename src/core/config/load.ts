// Config yükleyici: dosyadan oku -> JSON parse -> zod şema -> koltuk-kümesi birebir doğrula.
// Her hata ANLAŞILIR bir mesajla döner (DESIGN M0 kabul kriteri). Framework-bağımsız.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ConfigSchema, type DivanConfig } from "./schema.ts";
import { SEAT_IDS } from "../seats/seats.ts";

/**
 * Hangi config okunur. `DIVAN_CONFIG` ile değiştirilebilir; sürücü ve `next dev` ortamı miras
 * aldığı için tek değişkenle bütün koşum o config'e geçer.
 *
 * Neden var: aynı-aile deneyi (ve M5'in kör değerlendirmesi) aynı kodu FARKLI kadrolarla koşmak
 * demektir. Kadro config'te olduğuna göre, kolu seçmenin doğru yolu kodu değil dosyayı
 * değiştirmektir. Prob önbelleği config'in koltuk özetiyle anahtarlı (`probeCache.configHashOf`),
 * yani yeni bir kol kendiliğinden yeniden problanır; eski kolun sonuçları yanlışlıkla
 * kullanılamaz.
 */
export const DEFAULT_CONFIG_PATH =
  process.env.DIVAN_CONFIG ?? join(process.cwd(), "divan.config.json");

function formatZodError(err: z.ZodError): string {
  return err.issues
    .map((i) => `  - ${i.path.join(".") || "(kök)"}: ${i.message}`)
    .join("\n");
}

export function loadConfig(configPath: string = DEFAULT_CONFIG_PATH): DivanConfig {
  let raw: string;
  try {
    raw = readFileSync(configPath, "utf8");
  } catch {
    throw new Error(
      `Config dosyası bulunamadı: ${configPath}. Kökte divan.config.json oluşturun.`,
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `Config geçerli JSON değil (${configPath}): ${(e as Error).message}`,
    );
  }

  const parsed = ConfigSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Config şema hatası (${configPath}):\n${formatZodError(parsed.error)}`,
    );
  }

  // Koltuk-kümesi DESIGN §4 kadrosuna birebir olmalı: eksik veya tanınmayan koltuk = hata.
  const keys = Object.keys(parsed.data.seats);
  const missing = SEAT_IDS.filter((id) => !keys.includes(id));
  const unknown = keys.filter((k) => !SEAT_IDS.includes(k));
  if (missing.length || unknown.length) {
    const parts: string[] = [];
    if (missing.length) parts.push(`eksik koltuk(lar): ${missing.join(", ")}`);
    if (unknown.length) parts.push(`tanınmayan koltuk(lar): ${unknown.join(", ")}`);
    throw new Error(
      `Config koltuk eşlemesi hatalı: ${parts.join("; ")}. ` +
        `Beklenen 7 koltuk: ${SEAT_IDS.join(", ")}.`,
    );
  }

  // DESIGN §4 KADRO KURALI: aynı model iki koltukta oturamaz. Aynı modelli iki koltuk kurulda bir
  // sesi ikiye katlar; 9 Eylül ölçümünde aynı modelli iki sıralayıcının görüşleri 0.86 örtüştü,
  // aynı fazdaki diğer çiftler 0.10-0.19 aralığındaydı. Koltuklar birbirini görmese bile aynı
  // model aynı girdiye çok benzer cevap veriyor, yani "bağımsız iki ses" orada sahiden yok.
  //
  // FALLBACK'LER KURALA GİRMEZ: kural hangi modelin KONUŞTUĞU hakkındadır, hangisinin yedekte
  // beklediği hakkında değil. İki koltuk aynı yedeğe düşerse bu bir arıza anıdır, kadro kararı
  // değil; oraya karışmak yedeksiz koltuk üretirdi.
  const istisna = parsed.data.kadroIstisnasi?.trim();
  if (!istisna) {
    const nerede = new Map<string, string[]>();
    for (const [seatId, sm] of Object.entries(parsed.data.seats)) {
      nerede.set(sm.model, [...(nerede.get(sm.model) ?? []), seatId]);
    }
    const cakisan = [...nerede.entries()].filter(([, ids]) => ids.length > 1);
    if (cakisan.length) {
      const liste = cakisan.map(([model, ids]) => `  - ${model}: ${ids.join(", ")}`).join("\n");
      throw new Error(
        `Config kadro kuralını ihlal ediyor (DESIGN §4): aynı model birden çok koltukta.\n${liste}\n` +
          `Aynı modelli iki koltuk kurulda bir sesi ikiye katlar. Bunu BİLEREK yapıyorsanız ` +
          `config'e gerekçesini yazın: "kadroIstisnasi": "<neden>". Beyan oturum kaydına ve ` +
          `karar belgesi künyesine damgalanır.`,
      );
    }
  }

  return parsed.data;
}
