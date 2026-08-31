// Konsey oturumu: graf koşumu -> SSE (ReadableStream). Kapı onayları da bu POST'a `resume` ile
// gelir (DESIGN §10). Anahtar/graf sunucuda; tarayıcı yalnız olay akışını tüketir (M4).

import { Command } from "@langchain/langgraph";
import { getCouncilGraph } from "@/core/graph/graph";
import { encodeSSE, type DivanEvent } from "@/core/graph/events";
import type { DivanStateType } from "@/core/graph/state";
import { loadConfig } from "@/core/config/load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    threadId?: string;
    idea?: string;
    resume?: unknown;
    maxCalls?: number;
    reTableToNode?: string;
  };

  const graph = getCouncilGraph();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: DivanEvent) => controller.enqueue(encoder.encode(encodeSSE(e)));
      const threadId = body.threadId ?? crypto.randomUUID();
      const config = { configurable: { thread_id: threadId } };

      try {
        const isResume = body.resume !== undefined;
        const reTableTo = typeof body.reTableToNode === "string" ? body.reTableToNode : undefined;

        // Bütçe tavanı: config §5'ten; test için body.maxCalls override edebilir.
        let maxCalls = 30;
        try {
          maxCalls = loadConfig().budget.maxCalls;
        } catch {
          // config yoksa/geçersizse varsayılan tavan
        }
        if (typeof body.maxCalls === "number") maxCalls = body.maxCalls;

        // Girdi + config'i moda göre kur: yeni oturum / resume / re-table (checkpoint'ten).
        let streamConfig: Record<string, unknown> = config;
        let streamInput: unknown = { idea: body.idea ?? "", maxCalls };
        if (reTableTo) {
          // Re-table (§5): hedef fazın hemen ÖNCEKİ checkpoint'ini bul, oradan yeniden koştur.
          let forkConfig: unknown;
          for await (const snap of graph.getStateHistory(config)) {
            if (Array.isArray(snap.next) && snap.next.includes(reTableTo)) {
              forkConfig = snap.config;
              break;
            }
          }
          if (!forkConfig) {
            send({ type: "error", message: `re-table: '${reTableTo}' için checkpoint bulunamadı` });
            controller.close();
            return;
          }
          streamConfig = forkConfig as Record<string, unknown>;
          streamInput = null; // null girdi = checkpoint'ten yeniden koşum
          send({ type: "phase-start", phase: `RE-TABLE:${reTableTo}`, threadId });
        } else if (isResume) {
          streamInput = new Command({ resume: body.resume });
        } else {
          send({ type: "phase-start", phase: "F0", threadId });
        }

        // LangGraph girdi jenerikleri graf düğüm-adı union'ına daralmıyor; runtime'da geçerli, cast.
        for await (const chunk of await graph.stream(
          streamInput as Parameters<typeof graph.stream>[0],
          { ...streamConfig, streamMode: "updates" },
        )) {
          for (const [node, update] of Object.entries(chunk as Record<string, unknown>)) {
            if (node === "__interrupt__") continue; // kapı, aşağıda getState ile ele alınır
            send({ type: "node-update", node, keys: Object.keys((update as object) ?? {}) });
          }
        }

        // Duraklama (kapı) mı, bitiş mi? getState ile karar ver (versiyon-sağlam).
        const snap = await graph.getState(config);
        const paused = Array.isArray(snap.next) && snap.next.length > 0;
        if (paused) {
          const interruptVal = snap.tasks?.[0]?.interrupts?.[0]?.value ?? {};
          const gateName =
            interruptVal && typeof interruptVal === "object" && "gate" in interruptVal
              ? String((interruptVal as { gate: unknown }).gate)
              : "gate";
          send({ type: "gate", gate: gateName, payload: interruptVal, threadId });
        } else {
          const v = snap.values as DivanStateType;
          const transcriptChars = (v.transcript ?? []).reduce((n, t) => n + t.content.length, 0);
          const summaryChars = (v.phaseSummaries ?? []).reduce((n, s) => n + s.summary.length, 0);
          send({
            type: "done",
            threadId,
            selectedHmw: v.selectedHmw ?? null,
            councilMode: v.councilMode ?? "full",
            metrics: {
              callCount: v.callCount ?? 0,
              transcriptEntries: (v.transcript ?? []).length,
              transcriptChars,
              summaryChars,
              revisionRounds: v.revisionRounds ?? 0,
              judgmentRetries: v.judgmentRetries ?? 0,
            },
          });
        }
      } catch (e) {
        send({ type: "error", message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
