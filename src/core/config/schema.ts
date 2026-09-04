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
  /**
   * Çağrı zaman aşımı (DESIGN §7, faz-içi paralelliğin ön koşulu). Ölçüme yaslanır: M2-A'da en
   * yavaş koltuk 30 sn sürdü, varsayılan bunun dört katıdır. Asılı bir üye asılı bir oturumdur.
   */
  timeouts: z
    .object({
      perCallMs: z.number().int().positive(),
    })
    .default({ perCallMs: 120_000 }),
  /**
   * Çağrı token tavanları. Değerler ÖLÇÜMLE belirlendi (docs/M2-OLCUMLER.md): akıl yürüten
   * modeller cevaptan önce düşünme tokenı harcar ve şema gerektiren çağrılarda 2048'lik tavan
   * düşünmeye tamamen gidip içeriği boş bırakıyordu. 8192 ölçümde yeterli oldu. Düşük tavan
   * parayı KURTARMIYOR: kesilen çağrı da faturalanıyor, sadece karşılığı alınamıyor.
   */
  limits: z
    .object({
      schemaMaxTokens: z.number().int().positive(),
      textMaxTokens: z.number().int().positive(),
    })
    .default({ schemaMaxTokens: 8192, textMaxTokens: 1600 }),
});

export type DivanConfig = z.infer<typeof ConfigSchema>;
