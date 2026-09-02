// Konsey grafı (DESIGN §5). İki yol: TAM KURUL (7 koltuk, F0-F5) ve KÜÇÜK KURUL (3 ajan, F1/F3
// ve revizyon döngüsü atlanır); ayrım F0 triyajında verilir. 3 planlı kapı (interrupt) + 3
// olay-tetikli dönüş (bütçe, erken brifing, hüküm eksik) + F4 revizyon/savunma döngüsü (mekanik
// kapanma, revision.ts) + erken-uzlaşı kilidi (lock.ts). Ajanlar STUB (M2 gerçek).
// Çekirdek/UI ayrımı korunur: sıfır React/Next importu.

import { StateGraph, START, END, interrupt } from "@langchain/langgraph";
import { DivanState, type DivanStateType, type TranscriptEntry, type JudgmentItem } from "./state.ts";
import { StubSeatRunner, type SeatRunner } from "./seatRunner.ts";
import { getCheckpointer } from "./checkpointer.ts";
import { earlyConsensusLockRouter } from "./lock.ts";
import { revisionLoopRouter, countBlockingUnmet } from "./revision.ts";
import { isOverBudget } from "./budget.ts";
import { validateAudit } from "./audit.ts";
import type { SeatRunInput, SeatRunOutput } from "./seatRunner.ts";
import { usageOf, formatUsd, toNanoUsd } from "./usage.ts";
import { estimatePhaseCost } from "./estimate.ts";

// DESIGN §4/§5 koltuk rolleri per faz (tam kurul).
const IDEATORS = ["visionary", "market", "engineer1", "architect"] as const; // F2/F3
const FEASIBILITY = ["engineer1", "engineer2", "architect"] as const; // F4 değerlendirme
const DEFENDERS = ["engineer1", "architect"] as const; // F4 revizyon/savunma turu
const RANKERS = ["market", "engineer1", "architect", "auditor"] as const; // F5 sıralama

// Küçük kurul (DESIGN §5: 3 ajan = Öneren + Ölçen + İtiraz eden, BD moderatör).
// Denetçi ÜRETİM turuna girmez: §3'teki "erken eleştiri üretimi bastırır" mekanizması her iki
// yolda da açık kalmalı. Denetçi küçük kurulda denetim, hüküm ve sıralama turlarında konuşur;
// bu, seats.ts'teki faz spec'iyle de birebir hizalıdır (auditor: F1, F4, F5).
const SMALL_IDEATORS = ["visionary", "engineer1"] as const;
const SMALL_RANKERS = ["engineer1", "auditor"] as const;

/** Bir faz(lar)ın ham transcript'ini "koltuk: içerik" satırlarına indirger (BD özet girdisi). */
function rawOfPhase(state: DivanStateType, phasePrefix: string): string {
  return state.transcript
    .filter((t) => t.phase.startsWith(phasePrefix))
    .map((t) => `${t.seatId}: ${t.content}`)
    .join("\n");
}

/** İleri taşınan tek bağlam: BD faz özeti (ham transcript DEĞİL). */
function summaryOf(state: DivanStateType, phase: string): string {
  return state.phaseSummaries.find((s) => s.phase === phase)?.summary ?? "";
}

/**
 * Bütçe kapısı (DESIGN §5 dönüş a): PAHALI fazın İLK satırında çağrılır, faz daha başlamadan
 * "bu faz koşarsa tavan aşılacak mı" diye sorar.
 *
 * Yanıt sözleşmesi ÜÇ seçenektir ve payload bunları listeler: `devam`, bir SAYI (yeni tavan),
 * `iptal`. Tanınmayan yanıt akışı SÜRDÜRMEZ, kapı gerekçesiyle yeniden açılır: yazım hatası bir
 * onay yerine geçemez.
 *
 * Payload iki ayrı blok taşır ve ikisi ASLA aynı statüde sunulmaz: `kesin` (çağrı sayıları, ölçülen)
 * ve `kestirim` (koltuk ortalamalarından türetilen para tahmini). Çağrı adedi tavanı yapısal frendir
 * ve para tavanına çevrilmez; kestirim yalnız Şah'ın kapıda gördüğü bilgidir.
 */
function budgetStop(
  state: DivanStateType,
  nextCost: number,
  at: string,
  seats: readonly string[],
  node: string,
): { maxCalls?: number; abort?: boolean; abortReason?: string } {
  if (!isOverBudget(state, nextCost)) return {};

  const est = estimatePhaseCost(seats, state.seatCostNano, state.seatCalls);
  const payload = {
    gate: "BUTCE",
    at,
    kabulEdilen: ["devam", "<yeni tavan sayısı>", "iptal"],
    kurtarma: `Akış durursa re-table ile "${node}" düğümünden devam edilebilir; durum korunur.`,
    kesin: { kosanCagri: state.callCount, fazCagriSayisi: nextCost, tavan: state.maxCalls },
    kestirim: {
      etiket: "KESTİRİM, ölçüm değil: bu oturumda gözlenen koltuk ortalamalarından türetildi",
      fazMaliyetiUsd: formatUsd(est.nanoUsd),
      gozlenenKoltuk: est.observedSeats,
      gozlemsizKoltuk: est.unobservedSeats,
      oturumMaliyetiUsd: formatUsd(state.costNanoUsd),
    },
  };

  const answer: unknown = interrupt(payload);

  if (typeof answer === "number" && Number.isFinite(answer) && answer > 0) {
    return { maxCalls: Math.floor(answer) };
  }
  const text = String(answer ?? "").trim().toLowerCase();
  if (text === "devam") return {};
  if (text === "iptal") return { abort: true };
  const parsed = Number(text);
  if (Number.isFinite(parsed) && parsed > 0) return { maxCalls: Math.floor(parsed) };

  // Sözleşme dışı yanıt akışı SÜRDÜRMEZ: oturum güvenli tarafta, SEBEBİ YAZILI olarak durur.
  //
  // Neden kapı yeniden açılmıyor: denendi, LangGraph'ın resume semantiğiyle çalışmadı. Düğüm
  // kendine döndürüldüğünde kapı gerçekten yeniden açılıyor, ama Şah'ın İKİNCİ yanıtı bekleyen
  // interrupt'a ulaşmıyor ve akış sürüyordu; yani "iptal" denmesine rağmen fazlar koşuyordu.
  // Sessiz sürdürme, kaba durdurmadan kötüdür. Kapının ayrı bir düğüme çıkarılması (kilit
  // kapıları gibi) envantere borç yazıldı; yeniden-sorma davranışı orada geri gelecek.
  return {
    abort: true,
    abortReason:
      `Yanıt sözleşmeye uymadı ("${String(answer)}"), akış sürdürülmedi. ` +
      `Kabul edilenler: devam | bir sayı | iptal. ` +
      `KURTARMA: bu oturum kapanmadı, re-table ile "${node}" düğümünden devam edebilirsiniz; ` +
      `durum ve çağrı sayacı korunur.`,
  };
}

/**
 * Bütçe kapısında akış durduruldu mu? Durduysa faz çıkışı END'e gider. Tek yazma noktası
 * budgetStop'tur; endReason dolu ise oturum Şah'ın kararıyla kapanmış demektir.
 */
function abortRouter(state: DivanStateType): "abort" | "devam" {
  return state.endReason ? "abort" : "devam";
}

/** F0 triyajının kurduğu yol ayrımı; iki yerde kullanılır (kapı 1 sonrası, kilit retry). */
function modeRouter(state: DivanStateType): "full" | "small" {
  return state.councilMode === "small" ? "small" : "full";
}

/**
 * Denetim çağrısı + §6 İADE SEMANTİĞİ. Beyan bütünlüğü ilkesi gereği geçersiz bir çıktıyı
 * DÜZELTMEYİZ: aynı koltuğa reddin gerekçesiyle bir kez iade ederiz. İlk denemenin HAM hali
 * transkriptte kalır (silinmez), ve iade çağrısı bütçe sayacına yazılır: iade bedavaya gelmez.
 * İkinci çıktı da geçersizse akış durur ve DENETIM_EKSIK kapısıyla Şah'a çıkar.
 */
async function runAuditWithReturn(
  runner: SeatRunner,
  state: DivanStateType,
  phase: string,
  context: string,
) {
  const entries: TranscriptEntry[] = [];
  const outs: SeatRunOutput[] = [];
  const first = await runner.run("auditor", { phase, idea: state.idea, context, retry: 0 });
  outs.push(first);
  let check = validateAudit(first.data);
  entries.push({
    phase,
    seatId: "auditor",
    content: check.ok ? first.content : `[GEÇERSİZ: ${check.reason}] ${first.content}`,
  });
  let calls = 1;

  if (!check.ok) {
    const second = await runner.run("auditor", {
      phase,
      idea: state.idea,
      context: `${context}\n\nİADE GEREKÇESİ (çıktın reddedildi, aynı denetimi bu eksiği gidererek yeniden ver): ${check.reason}`,
      retry: 1,
    });
    calls = 2;
    outs.push(second);
    check = validateAudit(second.data);
    entries.push({
      phase,
      seatId: "auditor",
      content: check.ok
        ? `[İADE SONRASI] ${second.content}`
        : `[İADE SONRASI DA GEÇERSİZ: ${check.reason}] ${second.content}`,
    });
  }

  return {
    ...usageOf(outs),
    auditComplete: check.ok,
    auditIssue: check.ok ? "" : check.reason,
    auditRetries: calls - 1,
    transcript: entries,
    callCount: calls,
  };
}

export function buildCouncilGraph(runner: SeatRunner = new StubSeatRunner()) {
  // Her koltuk çağrısı buradan geçer; düğüm dönüşünde flushUsage() ile maliyet state'e yazılır.
  // Tampon düğüm-yereldir (graf düğümleri sırayla koşar); bir düğüm boşaltmayı atlarsa maliyet
  // kaybolmaz, yalnız bir sonraki düğüme yazılır.
  const buffer: Array<{ seatId: string; out: SeatRunOutput }> = [];
  const run = async (seatId: string, input: SeatRunInput): Promise<SeatRunOutput> => {
    const out = await runner.run(seatId, input);
    buffer.push({ seatId, out });
    return out;
  };
  const flushUsage = () => {
    const totals = usageOf(buffer.map((b) => b.out));
    const seatCostNano: Record<string, number> = {};
    const seatCalls: Record<string, number> = {};
    for (const b of buffer) {
      seatCalls[b.seatId] = (seatCalls[b.seatId] ?? 0) + 1;
      const c = b.out.usage?.cost;
      if (c !== undefined) seatCostNano[b.seatId] = (seatCostNano[b.seatId] ?? 0) + toNanoUsd(c);
    }
    buffer.length = 0;
    return { ...totals, seatCostNano, seatCalls };
  };

  const graph = new StateGraph(DivanState)
    // ================= F0: brifing + triyaj + HMW (DESIGN §5: 2 çağrı) =================
    .addNode("f0_briefing", async (state: DivanStateType) => {
      const out = await run("chiefAdvisor", { phase: "F0:briefing", idea: state.idea });
      // Karmaşıklık triyajı: küçük fikir -> küçük kurul yolu (§5 F0).
      const councilMode: "full" | "small" = out.data?.complexity === "small" ? "small" : "full";
      return {
        ...flushUsage(),
        councilMode,
        transcript: [{ phase: "F0:briefing", seatId: "chiefAdvisor", content: out.content }],
        callCount: 1,
      };
    })
    .addNode("f0_hmw", async (state: DivanStateType) => {
      const out = await run("chiefAdvisor", {
        phase: "F0:hmw",
        idea: state.idea,
        councilMode: state.councilMode,
      });
      const hmw = (out.data?.hmw as string[] | undefined) ?? [];
      return {
        ...flushUsage(),
        hmwOptions: hmw,
        transcript: [{ phase: "F0:hmw", seatId: "chiefAdvisor", content: out.content }],
        callCount: 1,
      };
    })
    // ---- KAPI 1: Şah HMW seçer ----
    .addNode("gate1_hmw", async (state: DivanStateType) => {
      const selected = interrupt({
        gate: "KAPI1",
        councilMode: state.councilMode,
        // DESIGN §5.1 ara dönem: sınıf henüz modelin KANAATİ, ölçüm değil. Kanaatin kanaat
        // olduğunu gizlemek, onu ölçüm sanmaktan daha büyük hatadır; bu yüzden kapıda işaretli.
        councilModeSource: "model-kanaati",
        councilModeNote:
          "Kurul boyutu şu an Baş Danışman'ın kanaati (ölçüm değil, DESIGN §5.1 ara dönem). Değiştirebilirsiniz.",
        options: state.hmwOptions,
      }) as string;
      return { ...flushUsage(), selectedHmw: selected };
    })

    // ================= TAM KURUL =================
    // ---- F1: Denetçi çerçeve itirazı ----
    .addNode("f1_frame", async (state: DivanStateType) => {
      const out = await run("auditor", {
        phase: "F1:frame",
        idea: state.idea,
        context: state.selectedHmw ?? undefined,
      });
      return {
        ...flushUsage(),
        frameObjection: out.content,
        transcript: [{ phase: "F1:frame", seatId: "auditor", content: out.content }],
        callCount: 1,
      };
    })
    // ---- KAPI 2: Şah çerçeveyi onaylar/düzeltir ----
    .addNode("gate2_frame", async (state: DivanStateType) => {
      const approved = interrupt({ gate: "KAPI2", frameObjection: state.frameObjection }) as string;
      return { ...flushUsage(), approvedFrame: approved };
    })
    // ---- F2: sessiz ideation (4 ideatör bağımsız) ----
    .addNode("f2_ideation", async (state: DivanStateType) => {
      const budget = budgetStop(state, IDEATORS.length, "F2", IDEATORS, "f2_ideation");
      if (budget.abort) {
        // Akış burada durur; çıkışı koşullu kenar END'e yönlendirir (Command goto END
        // denendi: update uygulanıyor ama graf normal kenardan devam ediyordu).
        return {
          endReason:
            budget.abortReason ??
            "Şah bütçe kapısında iptal etti (F2 girişi). KURTARMA: re-table ile devam edilebilir, durum korunur.",
        };
      }
      const entries: TranscriptEntry[] = [];
      for (const seat of IDEATORS) {
        const out = await run(seat, {
          phase: "F2:idea",
          idea: state.idea,
          context: state.approvedFrame ?? undefined,
        });
        entries.push({ phase: "F2:idea", seatId: seat, content: out.content });
      }
      return { ...flushUsage(), ...budget, transcript: entries, callCount: IDEATORS.length };
    })
    .addNode("bd_summary_f2", async (state: DivanStateType) => {
      const out = await run("chiefAdvisor", {
        phase: "F2:summary",
        idea: state.idea,
        context: rawOfPhase(state, "F2:idea"),
      });
      return { ...flushUsage(), phaseSummaries: [{ phase: "F2", summary: out.content }], callCount: 1 };
    })
    // ---- F3: çapraz-tozlaşma (SIKIŞTIRMA: ham değil, F2 özeti bağlam) ----
    .addNode("f3_cross", async (state: DivanStateType) => {
      const budget = budgetStop(state, IDEATORS.length, "F3", IDEATORS, "f3_cross");
      if (budget.abort) {
        // Akış burada durur; çıkışı koşullu kenar END'e yönlendirir (Command goto END
        // denendi: update uygulanıyor ama graf normal kenardan devam ediyordu).
        return {
          endReason:
            budget.abortReason ??
            "Şah bütçe kapısında iptal etti (F3 girişi). KURTARMA: re-table ile devam edilebilir, durum korunur.",
        };
      }
      const f2Summary = summaryOf(state, "F2");
      const entries: TranscriptEntry[] = [];
      for (const seat of IDEATORS) {
        const out = await run(seat, { phase: "F3:cross", idea: state.idea, context: f2Summary });
        entries.push({ phase: "F3:cross", seatId: seat, content: out.content });
      }
      return { ...flushUsage(), ...budget, transcript: entries, callCount: IDEATORS.length };
    })
    .addNode("bd_summary_f3", async (state: DivanStateType) => {
      const out = await run("chiefAdvisor", {
        phase: "F3:summary",
        idea: state.idea,
        context: rawOfPhase(state, "F3:cross"),
      });
      return { ...flushUsage(), phaseSummaries: [{ phase: "F3", summary: out.content }], callCount: 1 };
    })
    // ---- F4: fizibilite (Müh-1/Müh-2/Mimar) ----
    .addNode("f4_feasibility", async (state: DivanStateType) => {
      // F4'ün tam maliyeti: fizibilite + denetim + ilk revizyon turu + hüküm turu.
      const budget = budgetStop(state, FEASIBILITY.length + 1 + DEFENDERS.length + 1, "F4", [...FEASIBILITY, "auditor", ...DEFENDERS], "f4_feasibility");
      if (budget.abort) {
        // Akış burada durur; çıkışı koşullu kenar END'e yönlendirir (Command goto END
        // denendi: update uygulanıyor ama graf normal kenardan devam ediyordu).
        return {
          endReason:
            budget.abortReason ??
            "Şah bütçe kapısında iptal etti (F4 girişi). KURTARMA: re-table ile devam edilebilir, durum korunur.",
        };
      }
      const f3Summary = summaryOf(state, "F3");
      const entries: TranscriptEntry[] = [];
      for (const seat of FEASIBILITY) {
        const out = await run(seat, { phase: "F4:feasibility", idea: state.idea, context: f3Summary });
        entries.push({ phase: "F4:feasibility", seatId: seat, content: out.content });
      }
      return { ...flushUsage(), ...budget, transcript: entries, callCount: FEASIBILITY.length };
    })
    // ---- F4: Denetçi denetim (premortem zorunlu) ----
    .addNode("f4_audit", async (state: DivanStateType) =>
      runAuditWithReturn(runner, state, "F4:audit", rawOfPhase(state, "F4:feasibility")),
    )
    // ---- F4: revizyon/savunma turu (DESIGN §5, <=3 tur; kapanış revision.ts'te MEKANİK) ----
    .addNode("f4_revision", async (state: DivanStateType) => {
      // Bir tur = savunma çağrıları + ardından gelen hüküm turu.
      const budget = budgetStop(state, DEFENDERS.length + 1, "F4:revizyon", [...DEFENDERS, "auditor"], "f4_revision");
      if (budget.abort) {
        // Akış burada durur; çıkışı koşullu kenar END'e yönlendirir (Command goto END
        // denendi: update uygulanıyor ama graf normal kenardan devam ediyordu).
        return {
          endReason:
            budget.abortReason ??
            "Şah bütçe kapısında iptal etti (F4:revizyon girişi). KURTARMA: re-table ile devam edilebilir, durum korunur.",
        };
      }
      const round = state.revisionRounds + 1;
      const auditText = rawOfPhase(state, "F4:audit");
      const entries: TranscriptEntry[] = [];
      for (const seat of DEFENDERS) {
        const out = await run(seat, {
          phase: "F4:revision",
          idea: state.idea,
          context: auditText,
          round,
        });
        entries.push({ phase: "F4:revision", seatId: seat, content: out.content });
      }
      return { ...flushUsage(), ...budget, transcript: entries, revisionRounds: 1, callCount: DEFENDERS.length };
    })
    // ---- F4: Denetçi hüküm turu (şema-bağlı). prevUnmetCount = döngünün ilerleme ölçüsü. ----
    .addNode("f4_judgment", async (state: DivanStateType) => {
      const prevUnmet = state.judgment.length > 0 ? countBlockingUnmet(state.judgment) : -1;
      const out = await run("auditor", {
        phase: "F4:judgment",
        idea: state.idea,
        context: rawOfPhase(state, "F4:"),
        round: state.revisionRounds,
        retry: state.judgmentRetries,
      });
      const judgment = (out.data?.judgment as JudgmentItem[] | undefined) ?? [];
      return {
        ...flushUsage(),
        judgment,
        judgmentHistory: [judgment],
        judgmentComplete: true,
        prevUnmetCount: prevUnmet,
        transcript: [{ phase: "F4:judgment", seatId: "auditor", content: out.content }],
        callCount: 1,
      };
    })
    .addNode("bd_summary_f4", async (state: DivanStateType) => {
      const out = await run("chiefAdvisor", {
        phase: "F4:summary",
        idea: state.idea,
        context: rawOfPhase(state, "F4:"),
      });
      return { ...flushUsage(), phaseSummaries: [{ phase: "F4", summary: out.content }], callCount: 1 };
    })

    // ================= KÜÇÜK KURUL (F1/F3 ve revizyon döngüsü yok) =================
    .addNode("f2s_ideation", async (state: DivanStateType) => {
      const budget = budgetStop(state, SMALL_IDEATORS.length, "F2s", SMALL_IDEATORS, "f2s_ideation");
      if (budget.abort) {
        // Akış burada durur; çıkışı koşullu kenar END'e yönlendirir (Command goto END
        // denendi: update uygulanıyor ama graf normal kenardan devam ediyordu).
        return {
          endReason:
            budget.abortReason ??
            "Şah bütçe kapısında iptal etti (F2s girişi). KURTARMA: re-table ile devam edilebilir, durum korunur.",
        };
      }
      const entries: TranscriptEntry[] = [];
      for (const seat of SMALL_IDEATORS) {
        const out = await run(seat, {
          phase: "F2s:idea",
          idea: state.idea,
          context: state.selectedHmw ?? undefined,
        });
        entries.push({ phase: "F2s:idea", seatId: seat, content: out.content });
      }
      return { ...flushUsage(), ...budget, transcript: entries, callCount: SMALL_IDEATORS.length };
    })
    .addNode("bd_summary_f2s", async (state: DivanStateType) => {
      const out = await run("chiefAdvisor", {
        phase: "F2s:summary",
        idea: state.idea,
        context: rawOfPhase(state, "F2s:idea"),
      });
      return { ...flushUsage(), phaseSummaries: [{ phase: "F2", summary: out.content }], callCount: 1 };
    })
    .addNode("f4s_feasibility", async (state: DivanStateType) => {
      // Küçük kurul F4: fizibilite + denetim + hüküm turu (revizyon döngüsü yok).
      const budget = budgetStop(state, 3, "F4s", ["engineer1", "auditor"], "f4s_feasibility");
      if (budget.abort) {
        // Akış burada durur; çıkışı koşullu kenar END'e yönlendirir (Command goto END
        // denendi: update uygulanıyor ama graf normal kenardan devam ediyordu).
        return {
          endReason:
            budget.abortReason ??
            "Şah bütçe kapısında iptal etti (F4s girişi). KURTARMA: re-table ile devam edilebilir, durum korunur.",
        };
      }
      const out = await run("engineer1", {
        phase: "F4s:feasibility",
        idea: state.idea,
        context: summaryOf(state, "F2"),
      });
      return {
        ...flushUsage(),
        ...budget,
        transcript: [{ phase: "F4s:feasibility", seatId: "engineer1", content: out.content }],
        callCount: 1,
      };
    })
    .addNode("f4s_audit", async (state: DivanStateType) =>
      runAuditWithReturn(runner, state, "F4s:audit", rawOfPhase(state, "F4s:feasibility")),
    )
    .addNode("f4s_judgment", async (state: DivanStateType) => {
      const out = await run("auditor", {
        phase: "F4s:judgment",
        idea: state.idea,
        context: rawOfPhase(state, "F4s:"),
        retry: state.judgmentRetries,
      });
      const judgment = (out.data?.judgment as JudgmentItem[] | undefined) ?? [];
      return {
        ...flushUsage(),
        judgment,
        judgmentHistory: [judgment],
        judgmentComplete: true,
        transcript: [{ phase: "F4s:judgment", seatId: "auditor", content: out.content }],
        callCount: 1,
      };
    })
    .addNode("bd_summary_f4s", async (state: DivanStateType) => {
      const out = await run("chiefAdvisor", {
        phase: "F4s:summary",
        idea: state.idea,
        context: rawOfPhase(state, "F4s:"),
      });
      return { ...flushUsage(), phaseSummaries: [{ phase: "F4", summary: out.content }], callCount: 1 };
    })
    .addNode("f5s_ranking", async (state: DivanStateType) => {
      const budget = budgetStop(state, SMALL_RANKERS.length + 2, "F5s", [...SMALL_RANKERS, "chiefAdvisor", "auditor"], "f5s_ranking");
      if (budget.abort) {
        // Akış burada durur; çıkışı koşullu kenar END'e yönlendirir (Command goto END
        // denendi: update uygulanıyor ama graf normal kenardan devam ediyordu).
        return {
          endReason:
            budget.abortReason ??
            "Şah bütçe kapısında iptal etti (F5s girişi). KURTARMA: re-table ile devam edilebilir, durum korunur.",
        };
      }
      const f4Summary = summaryOf(state, "F4");
      const entries: TranscriptEntry[] = [];
      const ranks: string[] = [];
      for (const seat of SMALL_RANKERS) {
        const out = await run(seat, { phase: "F5s:ranking", idea: state.idea, context: f4Summary });
        entries.push({ phase: "F5s:ranking", seatId: seat, content: out.content });
        ranks.push(`${seat}: ${out.content}`);
      }
      return { ...flushUsage(), ...budget, rankings: ranks, transcript: entries, callCount: SMALL_RANKERS.length };
    })

    // ================= ORTAK: kilit, dönüşler, F5 çıkışı =================
    // OLAY-TETİKLİ DÖNÜŞ (b): hüküm turunda blocking "karsilanmadi" varsa erken brifing (Şah).
    .addNode("blocking_check", async (state: DivanStateType) => {
      const unmet = state.judgment.filter((j) => j.blocking && j.status === "karsilanmadi");
      if (unmet.length > 0) {
        interrupt({ gate: "ERKEN_BRIFING", blocking: unmet.map((u) => u.rawText) });
      }
      return {};
    })
    // OLAY-TETİKLİ DÖNÜŞ (d): iadeye rağmen denetim mekanik şartları taşımıyor (§6.3.1).
    .addNode("gate_audit_missing", async (state: DivanStateType) => {
      const action = interrupt({
        gate: "DENETIM_EKSIK",
        reason: state.auditIssue,
        retries: state.auditRetries,
        kabulEdilen: ["devam", "iptal"],
      }) as string;
      return { ...flushUsage(), auditGateAction: action };
    })
    // Kilit blok dalı, 1. kez: hüküm turunu yeniden koştur (sayaç; çağrı harcamaz).
    .addNode("judgment_retry", async () => ({ judgmentRetries: 1 }))
    // OLAY-TETİKLİ DÖNÜŞ (c): retry'a rağmen hüküm eksik. Sessiz bitiş YOK, Şah'a çık.
    .addNode("gate_judgment_missing", async (state: DivanStateType) => {
      const action = interrupt({
        gate: "HUKUM_EKSIK",
        judgmentComplete: state.judgmentComplete,
        judgmentCount: state.judgment.length,
        retries: state.judgmentRetries,
      }) as string;
      return { ...flushUsage(), judgmentGateAction: action };
    })
    // ---- F5: kriter bazlı sıralama (tam kurul) ----
    .addNode("f5_ranking", async (state: DivanStateType) => {
      // F5'in tam maliyeti: sıralama + BD taslak + final denetim.
      const budget = budgetStop(state, RANKERS.length + 2, "F5", [...RANKERS, "chiefAdvisor", "auditor"], "f5_ranking");
      if (budget.abort) {
        // Akış burada durur; çıkışı koşullu kenar END'e yönlendirir (Command goto END
        // denendi: update uygulanıyor ama graf normal kenardan devam ediyordu).
        return {
          endReason:
            budget.abortReason ??
            "Şah bütçe kapısında iptal etti (F5 girişi). KURTARMA: re-table ile devam edilebilir, durum korunur.",
        };
      }
      const f4Summary = summaryOf(state, "F4");
      const entries: TranscriptEntry[] = [];
      const ranks: string[] = [];
      for (const seat of RANKERS) {
        const out = await run(seat, { phase: "F5:ranking", idea: state.idea, context: f4Summary });
        entries.push({ phase: "F5:ranking", seatId: seat, content: out.content });
        ranks.push(`${seat}: ${out.content}`);
      }
      return { ...flushUsage(), ...budget, rankings: ranks, transcript: entries, callCount: RANKERS.length };
    })
    // ---- F5: BD taslak karar + muhalefet notu (§6.4: blocking "karsilanmadi" HAM metin) ----
    .addNode("bd_draft", async (state: DivanStateType) => {
      const out = await run("chiefAdvisor", { phase: "F5:draft", idea: state.idea });
      const stillUnmet = state.judgment.filter((j) => j.blocking && j.status === "karsilanmadi");
      const dissent = stillUnmet.map((j) => j.rawText).join("\n");
      // §6.4: revizyon döngüsü muhalefeti buharlaştıramaz. Bir turda blocking "karsilanmadi"
      // işaretlenip son turda düşen madde, o turdaki HAM metniyle iz bırakır.
      const openCriteria = new Set(stillUnmet.map((j) => j.criterion));
      const seen = new Set<string>();
      const dropped: string[] = [];
      state.judgmentHistory.forEach((round, i) => {
        for (const item of round) {
          if (!item.blocking || item.status !== "karsilanmadi") continue;
          if (openCriteria.has(item.criterion) || seen.has(item.criterion)) continue;
          seen.add(item.criterion);
          dropped.push(`[tur ${i + 1}] ${item.criterion}: ${item.rawText}`);
        }
      });
      return {
        ...flushUsage(),
        dissentNote: dissent,
        droppedObjections: dropped,
        transcript: [{ phase: "F5:draft", seatId: "chiefAdvisor", content: out.content }],
        callCount: 1,
      };
    })
    // ---- KAPI 3: Şah karar onayı ----
    .addNode("gate3_decision", async (state: DivanStateType) => {
      const decision = interrupt({
        gate: "KAPI3",
        rankings: state.rankings,
        dissentNote: state.dissentNote,
        droppedObjections: state.droppedObjections,
        // Denetim mekanik şartları taşımıyorsa Şah bunu karar anında GÖRÜR (§6.3.1).
        auditComplete: state.auditComplete,
        auditIssue: state.auditIssue,
        // Karar anında maliyet de görünür: onay bedelini bilerek verilir.
        costNanoUsd: state.costNanoUsd,
        costUsd: formatUsd(state.costNanoUsd),
        costUnknownCalls: state.costUnknownCalls,
        callCount: state.callCount,
      }) as string;
      return { ...flushUsage(), decision };
    })
    // ---- F5 çıktı: karar belgesi + kod promptu + Denetçi final denetim (M3 içerik; M1 stub) ----
    .addNode("f5_output", async (state: DivanStateType) => {
      const out = await run("auditor", { phase: "F5:output", idea: state.idea });
      return {
        ...flushUsage(),
        transcript: [{ phase: "F5:output", seatId: "auditor", content: out.content }],
        callCount: 1,
      };
    })

    // ================= kenarlar (DESIGN §5 birebir) =================
    .addEdge(START, "f0_briefing")
    .addEdge("f0_briefing", "f0_hmw")
    .addEdge("f0_hmw", "gate1_hmw")
    // TRİYAJ DALLANMASI: küçük fikir küçük kurula gider (F1/F3 atlanır).
    .addConditionalEdges("gate1_hmw", modeRouter, { full: "f1_frame", small: "f2s_ideation" })
    // tam kurul omurgası
    .addEdge("f1_frame", "gate2_frame")
    .addEdge("gate2_frame", "f2_ideation")
    .addConditionalEdges("f2_ideation", abortRouter, { devam: "bd_summary_f2", abort: END })
    .addEdge("bd_summary_f2", "f3_cross")
    .addConditionalEdges("f3_cross", abortRouter, { devam: "bd_summary_f3", abort: END })
    .addEdge("bd_summary_f3", "f4_feasibility")
    // küçük kurul omurgası
    .addConditionalEdges("f2s_ideation", abortRouter, { devam: "bd_summary_f2s", abort: END })
    .addEdge("bd_summary_f2s", "f4s_feasibility")
    // F4 tam kurul: fizibilite -> denetim -> [revizyon -> hüküm] döngüsü -> özet
    .addConditionalEdges("f4_feasibility", abortRouter, { devam: "f4_audit", abort: END })
    // Denetim geçersizse revizyon turuna GEÇİLMEZ: eksik denetime savunma yazmak anlamsızdır.
    .addConditionalEdges("f4_audit", (state: DivanStateType) => (state.auditComplete ? "devam" : "kapi"), {
      devam: "f4_revision",
      kapi: "gate_audit_missing",
    })
    .addConditionalEdges("f4_revision", abortRouter, { devam: "f4_judgment", abort: END })
    .addConditionalEdges("f4_judgment", revisionLoopRouter, {
      f4_revision: "f4_revision",
      bd_summary_f4: "bd_summary_f4",
    })
    .addEdge("bd_summary_f4", "blocking_check")
    // F4 küçük kurul: revizyon döngüsü yok
    .addConditionalEdges("f4s_feasibility", abortRouter, { devam: "f4s_audit", abort: END })
    .addConditionalEdges("f4s_audit", (state: DivanStateType) => (state.auditComplete ? "devam" : "kapi"), {
      devam: "f4s_judgment",
      kapi: "gate_audit_missing",
    })
    .addEdge("f4s_judgment", "bd_summary_f4s")
    .addEdge("bd_summary_f4s", "blocking_check")
    // ERKEN-UZLAŞI KİLİDİ (§6.3): hüküm turu tamam + blocking listeli değilse F5 açılmaz.
    // Blok dalı END'e DÜŞMEZ: önce yeniden koşum, sonra Şah kapısı.
    .addConditionalEdges("blocking_check", earlyConsensusLockRouter, {
      f5_ranking: "f5_ranking",
      f5s_ranking: "f5s_ranking",
      judgment_retry: "judgment_retry",
      gate_judgment_missing: "gate_judgment_missing",
    })
    .addConditionalEdges(
      "gate_audit_missing",
      (state: DivanStateType) => (state.auditGateAction === "iptal" ? "abort" : modeRouter(state)),
      { full: "f4_revision", small: "f4s_judgment", abort: END },
    )
    .addConditionalEdges("judgment_retry", modeRouter, {
      full: "f4_judgment",
      small: "f4s_judgment",
    })
    .addConditionalEdges(
      "gate_judgment_missing",
      (state: DivanStateType) =>
        state.judgmentGateAction === "retry" ? modeRouter(state) : "abort",
      { full: "f4_judgment", small: "f4s_judgment", abort: END },
    )
    // F5 ortak kuyruk
    .addConditionalEdges("f5_ranking", abortRouter, { devam: "bd_draft", abort: END })
    .addConditionalEdges("f5s_ranking", abortRouter, { devam: "bd_draft", abort: END })
    .addEdge("bd_draft", "gate3_decision")
    .addEdge("gate3_decision", "f5_output")
    .addEdge("f5_output", END);

  return graph.compile({ checkpointer: getCheckpointer() });
}

const compiledByMode = new Map<string, ReturnType<typeof buildCouncilGraph>>();

/**
 * Mod başına tek derlenmiş graf (checkpointer singleton'ı paylaşılsın diye). Runner enjekte edilir:
 * graf hangi sesle konuştuğunu bilmez, bu yüzden stub ve gerçek koşum aynı mekaniği kullanır.
 */
export function getCouncilGraph(mode: string, runner: SeatRunner): ReturnType<typeof buildCouncilGraph> {
  const existing = compiledByMode.get(mode);
  if (existing) return existing;
  const built = buildCouncilGraph(runner);
  compiledByMode.set(mode, built);
  return built;
}
