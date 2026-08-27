// Config yükleyici: dosyadan oku -> JSON parse -> zod şema -> koltuk-kümesi birebir doğrula.
// Her hata ANLAŞILIR bir mesajla döner (DESIGN M0 kabul kriteri). Framework-bağımsız.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ConfigSchema, type DivanConfig } from "./schema";
import { SEAT_IDS } from "../seats/seats";

export const DEFAULT_CONFIG_PATH = join(process.cwd(), "divan.config.json");

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

  return parsed.data;
}
