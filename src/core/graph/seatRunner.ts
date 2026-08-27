// SeatRunner = bir koltuğun bir fazda çalıştırılması. M1'de STUB (deterministik canned çıktı):
// graf mekaniğini, kapıları ve bağlam sıkıştırmasını PARA/MODEL olmadan test etmek için.
// M2'de bu arayüzün gerçek OpenRouter impl'i yazılıp swap edilecek (çekirdek/graf değişmeyecek).
// Framework-bağımsız.

import type { JudgmentItem } from "./state";

export interface SeatRunInput {
  phase: string;
  idea: string;
  /** ileri taşınan bağlam = BD faz özeti (ham transcript DEĞİL); BD özet düğümünde ise ham faz metni */
  context?: string;
}

export interface SeatRunOutput {
  content: string;
  /** faz-özel yapılı veri (ör. F0 HMW listesi, F4 hüküm turu) */
  data?: Record<string, unknown>;
}

export interface SeatRunner {
  run(seatId: string, input: SeatRunInput): Promise<SeatRunOutput>;
}

/** M1 stub: sabit ama gerçekçi, deterministik çıktı. */
export class StubSeatRunner implements SeatRunner {
  async run(seatId: string, input: SeatRunInput): Promise<SeatRunOutput> {
    const { phase, idea } = input;

    // Baş Danışman: F0 brifing + HMW; F5 taslak karar; diğer fazlarda BD faz-özeti (sıkıştırma).
    if (seatId === "chiefAdvisor") {
      if (phase === "F0") {
        const acilar = ["netleştiririz", "büyütürüz", "test ederiz", "farklılaştırırız", "gelir modeline bağlarız"];
        const hmw = acilar.map((a, i) => `HMW-${i + 1}: "${idea}" fikrini nasıl ${a}?`);
        return {
          content: `Brifing (stub): "${idea}" özetlendi, karmaşıklık=orta, 5 HMW üretildi.`,
          data: { hmw },
        };
      }
      if (phase.startsWith("F5")) {
        return { content: `Taslak karar (stub): sıralama + hüküm turuna göre yön önerildi; muhalefet notu eklendi.` };
      }
      const gorusSayisi = (input.context ?? "").split("\n").filter(Boolean).length;
      return {
        content: `${phase} özeti (stub): ${gorusSayisi} görüş alındı; ana eksen fikrin çekirdeği, ayrışma işaretlendi.`,
      };
    }

    // Denetçi F1: çerçeve itirazı (tek siyah slot).
    if (seatId === "auditor" && phase === "F1") {
      return {
        content: `Çerçeve itirazı (stub): "${idea}" için seçilen HMW gömülü bir varsayım içeriyor olabilir; doğru soruyu mu soruyoruz?`,
      };
    }

    // Denetçi F4 denetim: premortem zorunlu.
    if (seatId === "auditor" && phase === "F4:audit") {
      return {
        content: `Denetim (stub): premortem zorunlu; "bu neden başarısız olur" senaryosu + en az 3 sınanmış iddia.`,
      };
    }

    // Denetçi F4 hüküm turu: kriter bazlı hüküm (şema-bağlı; blocking işaretli).
    if (seatId === "auditor" && phase === "F4:judgment") {
      const judgment: JudgmentItem[] = [
        { criterion: "fizibilite", status: "karsilandi", blocking: false, rawText: "Fizibilite makul, temel akış uygulanabilir." },
        { criterion: "farklılaşma", status: "kismen", blocking: false, rawText: "Farklılaşma kısmen kanıtlı, rakip analizi sığ." },
        { criterion: "birim ekonomisi", status: "karsilanmadi", blocking: true, rawText: "Birim ekonomisi karşılanmadı; dağıtım maliyeti gelirden yüksek görünüyor. BLOCKING." },
      ];
      return { content: `Hüküm turu (stub): 3 kriter değerlendirildi (karşılandı/kısmen/karşılanmadı).`, data: { judgment } };
    }

    // İdeatörler / değerlendiriciler, faza göre.
    if (phase === "F2") {
      return { content: `[F2 ${seatId} stub] "${idea}" için bağımsız fikir (çerçeve: ${input.context ?? "-"}).` };
    }
    if (phase === "F3") {
      return { content: `[F3 ${seatId} stub] F2 özeti üzerine geliştirme (özet girdisi: "${(input.context ?? "").slice(0, 48)}...").` };
    }
    if (phase === "F4:feasibility") {
      return { content: `[F4 fizibilite ${seatId} stub] "${idea}" uygulanabilirlik + risk değerlendirmesi.` };
    }
    if (phase === "F5:ranking") {
      return { content: `[F5 sıralama ${seatId} stub] kriter bazlı sıralama (skor değil).` };
    }

    return { content: `[stub ${seatId} @ ${phase}]` };
  }
}
