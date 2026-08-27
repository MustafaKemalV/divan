// Konsey grafı (DESIGN §5). M1 dikey dilim: START -> F0 brifing -> KAPI 1 (interrupt) -> END.
// F1..F5 aynı desenle sonra doldurulacak. Çekirdek/UI ayrımı: sıfır React/Next importu.

import { StateGraph, START, END, interrupt } from "@langchain/langgraph";
import { DivanState, type DivanStateType } from "./state";
import { StubSeatRunner, type SeatRunner } from "./seatRunner";
import { getCheckpointer } from "./checkpointer";

export function buildCouncilGraph(runner: SeatRunner = new StubSeatRunner()) {
  const graph = new StateGraph(DivanState)
    // F0: BD fikri özetler + 5 HMW üretir (§5). Ham çıktı transcript'e (audit), sayaç +1.
    .addNode("f0_briefing", async (state: DivanStateType) => {
      const out = await runner.run("chiefAdvisor", { phase: "F0", idea: state.idea });
      const hmw = (out.data?.hmw as string[] | undefined) ?? [];
      return {
        hmwOptions: hmw,
        transcript: [{ phase: "F0", seatId: "chiefAdvisor", content: out.content }],
        callCount: 1,
      };
    })
    // KAPI 1: Şah HMW seçer. interrupt payload = seçenekler; resume değeri = seçilen HMW.
    // Not: resume'da bu düğüm baştan koşar, interrupt() resume değerini döndürür (idempotent tutuldu).
    .addNode("gate1_hmw", async (_state: DivanStateType) => {
      const selected = interrupt({ gate: "KAPI1", options: _state.hmwOptions }) as string;
      return { selectedHmw: selected };
    })
    .addEdge(START, "f0_briefing")
    .addEdge("f0_briefing", "gate1_hmw")
    .addEdge("gate1_hmw", END);

  return graph.compile({ checkpointer: getCheckpointer() });
}

let compiled: ReturnType<typeof buildCouncilGraph> | undefined;

/** Tek derlenmiş graf (checkpointer singleton'ı paylaşsın diye). */
export function getCouncilGraph() {
  if (!compiled) compiled = buildCouncilGraph();
  return compiled;
}
