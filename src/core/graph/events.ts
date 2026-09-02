// SSE olay şeması (DESIGN §10): LangGraph olayları → tek tipli olay-yayını. İki tüketici
// (M4: oda renderer + transkript/karar paneli) aynı akışı okur. Framework-bağımsız tip.

export type DivanEvent =
  | { type: "phase-start"; phase: string; threadId: string }
  | { type: "node-update"; node: string; keys: string[] }
  | { type: "gate"; gate: string; payload: unknown; threadId: string }
  | {
      type: "done";
      threadId: string;
      selectedHmw: string | null;
      // hangi yol koştu (F0 triyajı) + sıkıştırma/bütçe/döngü kanıtları
      councilMode: "full" | "small";
      /** DESIGN §7 damgası: oturum gerçek modellerle mi stub'larla mı koştu (sahte gerçek sanılamaz) */
      runnerMode: "openrouter" | "stub";
      /** oturum neden bitti: normal akış mı, Şah'ın açık iptali mi (§5 bütçe sözleşmesi) */
      reason?: string;
      metrics: {
        callCount: number;
        transcriptEntries: number;
        transcriptChars: number;
        summaryChars: number;
        revisionRounds: number;
        judgmentRetries: number;
        /** §6.3.1: denetim mekanik şartları taşıdı mı (premortem + >=3 etiketli iddia) */
        auditComplete: boolean;
        /** §7 maliyet sayacı: tamsayı nano-USD toplamı (para float olarak taşınmaz) */
        costNanoUsd: number;
        /** gösterim için biçimlendirilmiş USD metni; hesapta kullanılmaz */
        costUsd: string;
        totalTokens: number;
        /** maliyeti bildirilmeyen çağrı sayısı; tahmin YAPILMAZ, bilinmezlik gösterilir */
        costUnknownCalls: number;
      };
    }
  | { type: "error"; message: string };

/** SSE tel formatı: `data: <json>\n\n` */
export function encodeSSE(event: DivanEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
