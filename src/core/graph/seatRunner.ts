// SeatRunner = bir koltuğun bir fazda çalıştırılması. M1'de STUB (deterministik canned çıktı):
// graf mekaniğini, kapıları ve bağlam sıkıştırmasını PARA/MODEL olmadan test etmek için.
// M2'de bu arayüzün gerçek OpenRouter impl'i yazılıp swap edilecek (çekirdek/graf değişmeyecek).
// Framework-bağımsız.

export interface SeatRunInput {
  phase: string;
  idea: string;
  /** ileri taşınan bağlam = BD faz özetleri (ham transcript DEĞİL) */
  context?: string;
}

export interface SeatRunOutput {
  content: string;
  /** faz-özel yapılı veri (ör. F0 HMW listesi) */
  data?: Record<string, unknown>;
}

export interface SeatRunner {
  run(seatId: string, input: SeatRunInput): Promise<SeatRunOutput>;
}

/** M1 stub: sabit ama gerçekçi, deterministik çıktı. */
export class StubSeatRunner implements SeatRunner {
  async run(seatId: string, input: SeatRunInput): Promise<SeatRunOutput> {
    if (seatId === "chiefAdvisor" && input.phase === "F0") {
      const acilar = ["netleştiririz", "büyütürüz", "test ederiz", "farklılaştırırız", "gelir modeline bağlarız"];
      const hmw = acilar.map(
        (a, i) => `HMW-${i + 1}: "${input.idea}" fikrini nasıl ${a}?`,
      );
      return {
        content: `Brifing (stub): "${input.idea}" özetlendi, karmaşıklık=orta, 5 HMW üretildi.`,
        data: { hmw },
      };
    }
    return { content: `[stub ${seatId} @ ${input.phase}]` };
  }
}
