// Config şeması (DESIGN §7): koltuk-model eşleme (pin + fallback), bütçe tavanı, arama kapları.
// zod ile runtime doğrulama; config VERİDİR (divan.config.json), kod değil. Sıfır React/Next.

import { z } from "zod";

/** Bir koltuğa atanan model: pin + aynı aileden fallback listesi (OpenRouter `models` dizisi). */
export const SeatModelSchema = z.object({
  model: z.string().min(1, "model slug boş olamaz"),
  fallbacks: z.array(z.string().min(1)).default([]),
});
export type SeatModel = z.infer<typeof SeatModelSchema>;

export const ConfigSchema = z.object({
  /** koltukId -> model eşlemesi. Anahtar-kümesi doğrulaması load.ts'te (SEAT_IDS'e birebir). */
  seats: z.record(z.string(), SeatModelSchema),
  /** çağrı bütçe tavanı (DESIGN §5: tam kurul tavanı 30). */
  budget: z.object({
    maxCalls: z.number().int().positive(),
  }),
  /** web arama kapları (DESIGN §6.2: faz başına varsayılan 3). */
  search: z.object({
    perPhaseCap: z.number().int().nonnegative(),
  }),
});

export type DivanConfig = z.infer<typeof ConfigSchema>;
