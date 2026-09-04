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
  /** özet fazlarında: o fazda KONUŞAN koltuklar (kota bunlar üzerinden denetlenir, §6) */
  seats?: readonly string[];
  /** ek belgelerin TAM METNİ; yalnız F0 (BD) ve F4'te doldurulur (DESIGN §5 ek bağlam) */
  attachments?: readonly { name: string; content: string }[];
  /** ek belgelerin BD özeti; tam metin verilmeyen fazlar bunu görür */
  attachmentSummary?: string;
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
 *   [TEST:badurl]       -> "dogrulanmis" iddia hep URL'siz döner (red -> iade -> red -> Şah kapısı)
 *   [TEST:badurl1]      -> ilk çıktı URL'siz, İADE turunda düzelir (§6 iade semantiği mutlu yol)
 *   [TEST:ozeteksik]    -> faz özeti bir koltuğun katkısını düşürür (§6 özet kotası)
 *   [TEST:slow:<koltuk>]   -> o koltuk gecikir (paralel tamamlanma sırası bozulur)
 *   [TEST:silent:<koltuk>] -> o koltuk hiç cevap vermez (koltuk sustu dalı)
 */
export class StubSeatRunner implements SeatRunner {
  async run(seatId: string, input: SeatRunInput): Promise<SeatRunOutput> {
    const { phase, idea } = input;

    // Paralellik testleri için iki işaret (yalnız stub'a özgü, M2'de gerçek runner ile kalkar):
    //   [TEST:slow:<koltuk>]   -> o koltuk gecikir; tamamlanma sırası bilerek bozulur.
    //   [TEST:silent:<koltuk>] -> o koltuk hiç cevap vermez; "koltuk sustu" dalı tetiklenir.
    const slow = idea.match(/\[TEST:slow:(\w+)\]/);
    if (slow && slow[1] === seatId) {
      await new Promise((r) => setTimeout(r, 250));
    }
    const silent = idea.match(/\[TEST:silent:(\w+)\]/);
    if (silent && silent[1] === seatId) {
      throw new Error(`stub: "${seatId}" koltugu cevap vermiyor`);
    }

    // --- Baş Danışman: brifing + triyaj, HMW, faz özetleri, taslak karar ---
    if (seatId === "chiefAdvisor") {
      if (phase === "F0:briefing") {
        // Triyaj (DESIGN §5): karmaşıklık sınıfı. Stub'da deterministik ölçü = fikrin uzunluğu.
        const complexity = idea.trim().length <= SMALL_IDEA_MAX_CHARS ? "small" : "full";
        const ekler = input.attachments ?? [];
        return {
          content: `Brifing (stub): "${idea}" özetlendi; karmaşıklık sınıfı = ${complexity}.`,
          data: {
            summary: `Brifing (stub): karmaşıklık ${complexity}.`,
            complexity,
            attachmentSummary: ekler.length
              ? `Ek belge özeti (stub): ${ekler.map((e) => `${e.name} (${e.content.length} krk)`).join(", ")}.`
              : "",
          },
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
        const konusanlar = input.seats ?? [];
        // [TEST:ozeteksik]: özetleyici son koltuğun katkısını DÜŞÜRÜR; §6 kotası bunu yakalamalı.
        const dusur = idea.includes("[TEST:ozeteksik]") && konusanlar.length > 1;
        const kapsanan = dusur ? konusanlar.slice(0, -1) : konusanlar;
        const faz = phase.split(":")[0];
        return {
          content: `${faz} özeti (stub): ${konusanlar.length} görüş alındı.`,
          data: {
            summary: `${faz} özeti (stub): ${konusanlar.length} görüş alındı; ana eksen fikrin çekirdeği, ayrışma işaretlendi.`,
            points: kapsanan.map((s) => ({ seatId: s, point: `${s} katkısı özetlendi (stub).` })),
          },
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
              { claim: "Dağıtım maliyeti gelirden yüksek.", evidence: "varsayim", source: "sınanmamış öngörü", url: "" },
              { claim: "Benzer ürünler bu kanalda tutundu.", evidence: "model-bilgisi", source: "hafızadan", url: "" },
              {
                claim: "Hedef segment bu fiyata alışkın.",
                evidence: "dogrulanmis",
                source: "sektör raporu",
                // [TEST:badurl]: rozet hak edilmeden verilir; §6.2 kod kuralı bunu reddetmeli
                // [TEST:badurl] inatçı: iadeden sonra da URL vermez (kapıya kadar gider).
                // [TEST:badurl1] iade turunda düzelir: red -> iade -> geçerli.
                url:
                  idea.includes("[TEST:badurl]") ||
                  (idea.includes("[TEST:badurl1]") && (input.retry ?? 0) < 1)
                    ? ""
                    : "https://example.org/kaynak",
              },
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
