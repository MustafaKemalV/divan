// Konsey grafı (DESIGN §5). Chunk C: tam F0..F5 + KAPI 1/2/3 + erken-uzlaşı kilidi koşullu kenarı
// + BD faz özetleri + bağlam sıkıştırması. Ajanlar STUB (M2 gerçek). Çekirdek/UI ayrımı korunur.

import { StateGraph, START, END, interrupt } from "@langchain/langgraph";
import { DivanState, type DivanStateType, type TranscriptEntry, type JudgmentItem } from "./state";
import { StubSeatRunner, type SeatRunner } from "./seatRunner";
import { getCheckpointer } from "./checkpointer";
import { earlyConsensusLockRouter } from "./lock";

// DESIGN §4/§5 koltuk rolleri per faz.
const IDEATORS = ["visionary", "market", "engineer1", "architect"] as const; // F2/F3
const FEASIBILITY = ["engineer1", "engineer2", "architect"] as const; // F4 değerlendirme
const RANKERS = ["market", "engineer1", "architect", "auditor"] as const; // F5 sıralama

/** Bir faz(lar)ın ham transcript'ini "koltuk: içerik" satırlarına indirger (BD özet girdisi). */
function rawOfPhase(state: DivanStateType, phasePrefix: string): string {
  return state.transcript
    .filter((t) => t.phase.startsWith(phasePrefix))
    .map((t) => `${t.seatId}: ${t.content}`)
    .join("\n");
}

export function buildCouncilGraph(runner: SeatRunner = new StubSeatRunner()) {
  const graph = new StateGraph(DivanState)
    // ---- F0: brifing + HMW ----
    .addNode("f0_briefing", async (state: DivanStateType) => {
      const out = await runner.run("chiefAdvisor", { phase: "F0", idea: state.idea });
      const hmw = (out.data?.hmw as string[] | undefined) ?? [];
      return {
        hmwOptions: hmw,
        transcript: [{ phase: "F0", seatId: "chiefAdvisor", content: out.content }],
        callCount: 1,
      };
    })
    // ---- KAPI 1: Şah HMW seçer ----
    .addNode("gate1_hmw", async (state: DivanStateType) => {
      const selected = interrupt({ gate: "KAPI1", options: state.hmwOptions }) as string;
      return { selectedHmw: selected };
    })
    // ---- F1: Denetçi çerçeve itirazı ----
    .addNode("f1_frame", async (state: DivanStateType) => {
      const out = await runner.run("auditor", { phase: "F1", idea: state.idea, context: state.selectedHmw ?? undefined });
      return {
        frameObjection: out.content,
        transcript: [{ phase: "F1", seatId: "auditor", content: out.content }],
        callCount: 1,
      };
    })
    // ---- KAPI 2: Şah çerçeveyi onaylar/düzeltir ----
    .addNode("gate2_frame", async (state: DivanStateType) => {
      const approved = interrupt({ gate: "KAPI2", frameObjection: state.frameObjection }) as string;
      return { approvedFrame: approved };
    })
    // ---- F2: sessiz ideation (4 ideatör bağımsız) ----
    .addNode("f2_ideation", async (state: DivanStateType) => {
      const entries: TranscriptEntry[] = [];
      for (const seat of IDEATORS) {
        const out = await runner.run(seat, { phase: "F2", idea: state.idea, context: state.approvedFrame ?? undefined });
        entries.push({ phase: "F2", seatId: seat, content: out.content });
      }
      return { transcript: entries, callCount: IDEATORS.length };
    })
    .addNode("bd_summary_f2", async (state: DivanStateType) => {
      const out = await runner.run("chiefAdvisor", { phase: "F2", idea: state.idea, context: rawOfPhase(state, "F2") });
      return { phaseSummaries: [{ phase: "F2", summary: out.content }], callCount: 1 };
    })
    // ---- F3: çapraz-tozlaşma (SIKIŞTIRMA: ham değil, F2 özeti bağlam) ----
    .addNode("f3_cross", async (state: DivanStateType) => {
      const f2Summary = state.phaseSummaries.find((s) => s.phase === "F2")?.summary ?? "";
      const entries: TranscriptEntry[] = [];
      for (const seat of IDEATORS) {
        const out = await runner.run(seat, { phase: "F3", idea: state.idea, context: f2Summary });
        entries.push({ phase: "F3", seatId: seat, content: out.content });
      }
      return { transcript: entries, callCount: IDEATORS.length };
    })
    .addNode("bd_summary_f3", async (state: DivanStateType) => {
      const out = await runner.run("chiefAdvisor", { phase: "F3", idea: state.idea, context: rawOfPhase(state, "F3") });
      return { phaseSummaries: [{ phase: "F3", summary: out.content }], callCount: 1 };
    })
    // OLAY-TETİKLİ DÖNÜŞ (a): bütçe tavanı aşıldıysa Şah'a dön (planlı kapı DEĞİL, koşullu interrupt).
    .addNode("budget_check", async (state: DivanStateType) => {
      if (state.callCount >= state.maxCalls) {
        interrupt({ gate: "BUTCE", callCount: state.callCount, maxCalls: state.maxCalls });
      }
      return {};
    })
    // ---- F4: fizibilite (Müh-1/Müh-2/Mimar) ----
    .addNode("f4_feasibility", async (state: DivanStateType) => {
      const f3Summary = state.phaseSummaries.find((s) => s.phase === "F3")?.summary ?? "";
      const entries: TranscriptEntry[] = [];
      for (const seat of FEASIBILITY) {
        const out = await runner.run(seat, { phase: "F4:feasibility", idea: state.idea, context: f3Summary });
        entries.push({ phase: "F4:feasibility", seatId: seat, content: out.content });
      }
      return { transcript: entries, callCount: FEASIBILITY.length };
    })
    // ---- F4: Denetçi denetim (premortem zorunlu) ----
    .addNode("f4_audit", async (state: DivanStateType) => {
      const out = await runner.run("auditor", { phase: "F4:audit", idea: state.idea });
      return {
        transcript: [{ phase: "F4:audit", seatId: "auditor", content: out.content }],
        callCount: 1,
      };
    })
    // ---- F4: Denetçi hüküm turu (şema-bağlı; judgmentComplete + blocking listelenir) ----
    .addNode("f4_judgment", async (state: DivanStateType) => {
      const out = await runner.run("auditor", { phase: "F4:judgment", idea: state.idea });
      const judgment = (out.data?.judgment as JudgmentItem[] | undefined) ?? [];
      return {
        judgment,
        judgmentComplete: true,
        transcript: [{ phase: "F4:judgment", seatId: "auditor", content: out.content }],
        callCount: 1,
      };
    })
    .addNode("bd_summary_f4", async (state: DivanStateType) => {
      const out = await runner.run("chiefAdvisor", { phase: "F4", idea: state.idea, context: rawOfPhase(state, "F4") });
      return { phaseSummaries: [{ phase: "F4", summary: out.content }], callCount: 1 };
    })
    // OLAY-TETİKLİ DÖNÜŞ (b): hüküm turunda blocking "karsilanmadi" varsa erken brifing (Şah).
    .addNode("blocking_check", async (state: DivanStateType) => {
      const unmet = state.judgment.filter((j) => j.blocking && j.status === "karsilanmadi");
      if (unmet.length > 0) {
        interrupt({ gate: "ERKEN_BRIFING", blocking: unmet.map((u) => u.rawText) });
      }
      return {};
    })
    // ---- F5: kriter bazlı sıralama ----
    .addNode("f5_ranking", async (state: DivanStateType) => {
      const f4Summary = state.phaseSummaries.find((s) => s.phase === "F4")?.summary ?? "";
      const entries: TranscriptEntry[] = [];
      const ranks: string[] = [];
      for (const seat of RANKERS) {
        const out = await runner.run(seat, { phase: "F5:ranking", idea: state.idea, context: f4Summary });
        entries.push({ phase: "F5:ranking", seatId: seat, content: out.content });
        ranks.push(`${seat}: ${out.content}`);
      }
      return { rankings: ranks, transcript: entries, callCount: RANKERS.length };
    })
    // ---- F5: BD taslak karar + muhalefet notu (§6.4: blocking "karsilanmadi" HAM metin) ----
    .addNode("bd_draft", async (state: DivanStateType) => {
      const out = await runner.run("chiefAdvisor", { phase: "F5:draft", idea: state.idea });
      const dissent = state.judgment
        .filter((j) => j.blocking && j.status === "karsilanmadi")
        .map((j) => j.rawText)
        .join("\n");
      return {
        dissentNote: dissent,
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
      }) as string;
      return { decision };
    })
    // ---- F5 çıktı: karar belgesi + kod promptu + Denetçi final denetim (M3 içerik; M1 stub) ----
    .addNode("f5_output", async (state: DivanStateType) => {
      const out = await runner.run("auditor", { phase: "F5:final-audit", idea: state.idea });
      return {
        transcript: [{ phase: "F5:output", seatId: "auditor", content: out.content }],
        callCount: 1,
      };
    })
    // ---- kenarlar (DESIGN §5 birebir) ----
    .addEdge(START, "f0_briefing")
    .addEdge("f0_briefing", "gate1_hmw")
    .addEdge("gate1_hmw", "f1_frame")
    .addEdge("f1_frame", "gate2_frame")
    .addEdge("gate2_frame", "f2_ideation")
    .addEdge("f2_ideation", "bd_summary_f2")
    .addEdge("bd_summary_f2", "f3_cross")
    .addEdge("f3_cross", "bd_summary_f3")
    .addEdge("bd_summary_f3", "budget_check")
    .addEdge("budget_check", "f4_feasibility")
    .addEdge("f4_feasibility", "f4_audit")
    .addEdge("f4_audit", "f4_judgment")
    .addEdge("f4_judgment", "bd_summary_f4")
    .addEdge("bd_summary_f4", "blocking_check")
    // ERKEN-UZLAŞI KİLİDİ: hüküm turu tamam + blocking listeli değilse F5 açılmaz (kenar koşulu).
    .addConditionalEdges("blocking_check", earlyConsensusLockRouter, {
      f5_ranking: "f5_ranking",
      judgment_incomplete: END,
    })
    .addEdge("f5_ranking", "bd_draft")
    .addEdge("bd_draft", "gate3_decision")
    .addEdge("gate3_decision", "f5_output")
    .addEdge("f5_output", END);

  return graph.compile({ checkpointer: getCheckpointer() });
}

let compiled: ReturnType<typeof buildCouncilGraph> | undefined;

/** Tek derlenmiş graf (checkpointer singleton'ı paylaşsın diye). */
export function getCouncilGraph() {
  if (!compiled) compiled = buildCouncilGraph();
  return compiled;
}
