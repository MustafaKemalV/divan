// SSE olay şeması (DESIGN §10): LangGraph olayları → tek tipli olay-yayını. İki tüketici
// (M4: oda renderer + transkript/karar paneli) aynı akışı okur. Framework-bağımsız tip.

export type DivanEvent =
  | { type: "phase-start"; phase: string; threadId: string }
  | { type: "node-update"; node: string; keys: string[] }
  | { type: "gate"; gate: string; payload: unknown; threadId: string }
  | { type: "done"; threadId: string; selectedHmw: string | null }
  | { type: "error"; message: string };

/** SSE tel formatı: `data: <json>\n\n` */
export function encodeSSE(event: DivanEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
