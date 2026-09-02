// SeatRunner = bir koltuğun bir fazda çalıştırılması. M1'de STUB (deterministik canned çıktı):
// graf mekaniğini, kapıları, döngüleri ve bağlam sıkıştırmasını PARA/MODEL olmadan test etmek için.
// M2'de bu arayüzün gerçek OpenRouter impl'i yazılıp swap edilecek (çekirdek/graf değişmeyecek).
// Framework-bağımsız.

import type { JudgmentItem } from "./state.ts";

export interface SeatRunInput {
  phase: string;
  idea: string;
  /** ileri taşınan bağlam = BD faz özeti (ham transcript DEĞİL); BD özet düğümünde ise ham faz metni */
  context?: string;
  /** F0 triyajının sonucu; HMW sayısı gibi mod-bağımlı davranışlar için */
  councilMode?: "full" | "small";
  /** F4 revizyon/savunma tur sayısı (hüküm turu bunu görür) */
  round?: number;
  /** erken-uzlaşı kilidi yeniden-koşum sayısı */
  retry?: number;
}

export interface SeatRunOutput {
  content: string;
  /** faz-özel yapılı veri (ör. F0 triyaj + HMW listesi, F4 hüküm turu) */
  data?: Record<string, unknown>;
  /** cevabı gerçekte veren model; stub'da yok, gerçek runner'da künye ve fallback izi için dolu */
  servedModel?: string;
  /** token/maliyet; maliyet sayacı bunu toplar (M2-A2) */
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; cost?: number };
}

export interface SeatRunner {
  run(seatId: string, input: SeatRunInput): Promise<SeatRunOutput>;
}

/** Stub triyaj eşiği: bu uzunluğun altındaki fikir "küçük" sayılır (deterministik, test edilebilir). */
export const SMALL_IDEA_MAX_CHARS = 60;

/**
 * M1 stub: sabit ama gerçekçi, deterministik çıktı.
 *
 * İki test işareti tanır (yalnız stub'a özgü; M2'de gerçek runner ile kalkar). Gerekçe: bazı
 * mekanik dallar (ısrarcı blocking muhalefet, şema üretemeyen hüküm turu) sağlıklı bir akışta
 * kendiliğinden oluşmaz; kanıtlanabilmeleri için fikir metninden tetiklenirler.
 *   [TEST:blocking]     -> revizyon turları blocking muhalefeti ÇÖZEMEZ (erken brifing + muhalefet notu dalı)
 *   [TEST:nojudgment]   -> ilk hüküm turu boş şema döndürür (erken-uzlaşı kilidi retry dalı)
 *   [TEST:nojudgment:always] -> hiçbir turda şema üretilmez (HUKUM_EKSIK Şah kapısı dalı)
 *   [TEST:drop]         -> itiraz bir tur blocking kalır, ikinci turda düşer (§6.4 düşen itiraz izi)
 *   [TEST:noaudit]      -> denetim premortemsiz döner (§6.3.1 eksik denetim işaretlenmesi)
 */
export class StubSeatRunner implements SeatRunner {
  async run(seatId: string, input: SeatRunInput): Promise<SeatRunOutput> {
    const { phase, idea } = input;

    // --- Baş Danışman: brifing + triyaj, HMW, faz özetleri, taslak karar ---
    if (seatId === "chiefAdvisor") {
      if (phase === "F0:briefing") {
        // Triyaj (DESIGN §5): karmaşıklık sınıfı. Stub'da deterministik ölçü = fikrin uzunluğu.
        const complexity = idea.trim().length <= SMALL_IDEA_MAX_CHARS ? "small" : "full";
        return {
          content: `Brifing (stub): "${idea}" özetlendi; karmaşıklık sınıfı = ${complexity}.`,
          data: { complexity },
        };
      }
      if (phase === "F0:hmw") {
        const acilar =
          input.councilMode === "small"
            ? ["netleştiririz", "test ederiz", "gelir modeline bağlarız"]
            : ["netleştiririz", "büyütürüz", "test ederiz", "farklılaştırırız", "gelir modeline bağlarız"];
        const hmw = acilar.map((a, i) => `HMW-${i + 1}: "${idea}" fikrini nasıl ${a}?`);
        return { content: `HMW turu (stub): ${hmw.length} soru üretildi.`, data: { hmw } };
      }
      if (phase === "F5:draft") {
        return { content: `Taslak karar (stub): sıralama + hüküm turuna göre yön önerildi; muhalefet notu eklendi.` };
      }
      if (phase.endsWith(":summary")) {
        const gorusSayisi = (input.context ?? "").split("\n").filter(Boolean).length;
        return {
          content: `${phase.split(":")[0]} özeti (stub): ${gorusSayisi} görüş alındı; ana eksen fikrin çekirdeği, ayrışma işaretlendi.`,
        };
      }
      return { content: `[BD stub @ ${phase}]` };
    }

    // --- Denetçi ---
    if (seatId === "auditor") {
      if (phase === "F1:frame") {
        return {
          content: `Çerçeve itirazı (stub): "${idea}" için seçilen HMW gömülü bir varsayım içeriyor olabilir; doğru soruyu mu soruyoruz?`,
        };
      }
      if (phase === "F4:audit" || phase === "F4s:audit") {
        // Stub gerçek çıktı ŞEKLİNİ taklit eder (§6.3.1 şeması), yoksa e2e mekanizmayı değil
        // yalnız akışı test etmiş olurdu. [TEST:noaudit] premortemsiz eksik denetimi tetikler.
        if (idea.includes("[TEST:noaudit]")) {
          return {
            content: `Denetim (stub): premortem atlandı.`,
            data: { summary: "eksik denetim", premortem: "", claims: [], weakestLink: "" },
          };
        }
        return {
          content: `Denetim (stub): premortem + 3 etiketli sınanmış iddia + en zayıf halka.`,
          data: {
            summary: "Denetim (stub): premortem + 3 etiketli sınanmış iddia + en zayıf halka.",
            premortem: "Bir yıl sonra başarısız olduk: dağıtım maliyeti gelirden yüksek kaldı.",
            claims: [
              { claim: "Dağıtım maliyeti gelirden yüksek.", evidence: "varsayim", source: "" },
              { claim: "Benzer ürünler bu kanalda tutundu.", evidence: "model-bilgisi", source: "" },
              { claim: "Hedef segment bu fiyata alışkın.", evidence: "dogrulanmis", source: "https://example.org/kaynak" },
            ],
            weakestLink: "dağıtım kanalı",
          },
        };
      }
      if (phase === "F4:judgment" || phase === "F4s:judgment") {
        // Kilit retry dalı: ilk koşumda şema üretilemedi (yalnız test işaretiyle).
        const noJudgmentAlways = idea.includes("[TEST:nojudgment:always]");
        if (noJudgmentAlways || (idea.includes("[TEST:nojudgment]") && (input.retry ?? 0) < 1)) {
          return {
            content: `Hüküm turu (stub): şema üretilemedi, madde listelenmedi.`,
            data: { judgment: [] },
          };
        }
        const stubborn = idea.includes("[TEST:blocking]");
        // Tam kurulda revizyon turu koştuysa blocking madde çözülür; küçük kurulda revizyon yok.
        // [TEST:drop]: ilk savunma yetmez, itiraz bir tur "karsilanmadi" kalır, ikinci turda düşer.
        const lateFix = idea.includes("[TEST:drop]");
        const revised = (input.round ?? 0) >= (lateFix ? 2 : 1);
        const smallCouncil = phase.startsWith("F4s");
        const unmetStays = stubborn || (!smallCouncil && !revised);
        const judgment: JudgmentItem[] = [
          {
            criterion: "fizibilite",
            status: "karsilandi",
            blocking: false,
            rawText: "Fizibilite makul, temel akış uygulanabilir.",
          },
          {
            criterion: "farklılaşma",
            status: "kismen",
            blocking: false,
            rawText: "Farklılaşma kısmen kanıtlı, rakip analizi sığ.",
          },
          {
            criterion: "birim ekonomisi",
            status: unmetStays ? "karsilanmadi" : "kismen",
            blocking: true,
            rawText: unmetStays
              ? "Birim ekonomisi karşılanmadı; dağıtım maliyeti gelirden yüksek görünüyor. BLOCKING."
              : "Birim ekonomisi revizyon turundan sonra kısmen karşılandı; maliyet varsayımı daraltıldı.",
          },
        ];
        return {
          content: `Hüküm turu (stub, tur ${input.round ?? 0}): 3 kriter değerlendirildi (karşılandı/kısmen/karşılanmadı).`,
          data: { judgment },
        };
      }
      if (phase === "F5:output") {
        return { content: `Final topraklamalı denetim (stub): bağımlılık listesi ve kanıt rozetleri kontrol edildi.` };
      }
    }

    // --- Ajanlar, faza göre ---
    if (phase === "F2:idea" || phase === "F2s:idea") {
      return { content: `[${phase} ${seatId} stub] "${idea}" için bağımsız fikir (çerçeve: ${input.context ?? "-"}).` };
    }
    if (phase === "F3:cross") {
      return {
        content: `[F3 ${seatId} stub] F2 özeti üzerine geliştirme (özet girdisi: "${(input.context ?? "").slice(0, 48)}...").`,
      };
    }
    if (phase === "F4:feasibility" || phase === "F4s:feasibility") {
      return { content: `[${phase} ${seatId} stub] "${idea}" uygulanabilirlik + risk değerlendirmesi.` };
    }
    if (phase === "F4:revision") {
      return {
        content: `[F4 revizyon ${seatId} stub] denetim itirazlarına savunma + düzeltme (tur ${input.round ?? 0}).`,
      };
    }
    if (phase === "F5:ranking" || phase === "F5s:ranking") {
      return { content: `[${phase} ${seatId} stub] kriter bazlı sıralama (skor değil).` };
    }

    return { content: `[stub ${seatId} @ ${phase}]` };
  }
}
