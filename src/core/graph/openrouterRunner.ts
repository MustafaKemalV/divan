// Gerçek koltuk çalıştırıcısı (M2-A). M1'in StubSeatRunner'ı ile AYNI arayüzü uygular; graf
// değişmez, yalnız sesin kaynağı değişir. Sistem promptu dosyadan (§7 prompts/), şema-kritik
// fazlarda çıktı json_schema'ya bağlanır (§7), model config'ten pin + fallback ile gelir.
//
// Ayrıştırılamayan şema çıktısı SESSİZ GEÇİLMEZ ama sahte veri de üretilmez: data boş bırakılır,
// böylece erken-uzlaşı kilidi (§6.3) devreye girer ve durum Şah'a çıkar.

import { callModel } from "../openrouter/gateway.ts";
import { buildSystemPrompt } from "../prompts/load.ts";
import { getSeat } from "../seats/seats.ts";
import type { DivanConfig } from "../config/schema.ts";
import { schemaForPhase } from "./schemas.ts";
import type { SeatRunInput, SeatRunOutput, SeatRunner } from "./seatRunner.ts";

/** Kullanıcı mesajı: fikir + ileri taşınan bağlam + tur bilgisi. Ham transkript BURADAN geçmez. */
function buildUserMessage(input: SeatRunInput): string {
  const parts: string[] = [];
  // OTURUM ZARFI ilk blok: çerçeve her çağrıya gider (DESIGN §5 D-2).
  if (input.envelope?.trim()) parts.push(input.envelope.trim());
  parts.push(`FİKİR:\n${input.idea}`);
  // Ek belgeler: TAM METİN yalnız verildiği fazlarda; diğer fazlar özet görür (DESIGN §5).
  for (const ek of input.attachments ?? []) {
    parts.push(`EK BELGE (${ek.name}):\n${ek.content}`);
  }
  if (!input.attachments?.length && input.attachmentSummary?.trim()) {
    parts.push(`EK BELGELERİN ÖZETİ:\n${input.attachmentSummary.trim()}`);
  }
  if (input.context && input.context.trim()) {
    parts.push(`BAĞLAM (önceki fazın özeti veya bu faz içi metin):\n${input.context.trim()}`);
  }
  if (input.seats?.length) parts.push(`BU FAZDA KONUŞAN KOLTUKLAR: ${input.seats.join(", ")}`);
  if (input.round && input.round > 0) parts.push(`REVİZYON TURU: ${input.round}`);
  if (input.retry && input.retry > 0) parts.push(`YENİDEN KOŞUM: ${input.retry}`);
  return parts.join("\n\n");
}

export class OpenRouterSeatRunner implements SeatRunner {
  // Node'un tip-soyma modu constructor parametre özelliğini desteklemez (ERR_UNSUPPORTED_
  // TYPESCRIPT_SYNTAX); alan açıkça tanımlanır ki bu dosya Next dışında da import edilebilsin.
  private readonly config: DivanConfig;

  constructor(config: DivanConfig) {
    this.config = config;
  }

  async run(seatId: string, input: SeatRunInput): Promise<SeatRunOutput> {
    const seat = getSeat(seatId);
    if (!seat) throw new Error(`Tanınmayan koltuk: "${seatId}".`);
    const sm = this.config.seats[seatId];
    if (!sm) throw new Error(`Config'de koltuk eşlemesi yok: "${seatId}".`);

    // Sistem mesajı = KİMLİK + FAZ TALİMATI (DESIGN §7 D-1).
    const system = buildSystemPrompt(seatId, input.phase);
    const schema = schemaForPhase(input.phase);

    const { content, servedModel, usage } = await callModel({
      model: sm.model,
      models: [sm.model, ...sm.fallbacks],
      messages: [
        { role: "system", content: system },
        { role: "user", content: buildUserMessage(input) },
      ],
      jsonSchema: schema,
      // Tavan ÖLÇÜMLE belirlendi (docs/M2-OLCUMLER.md): akıl yürüten modeller cevaptan önce
      // düşünme tokenı harcıyor ve 2048'lik tavan şema gerektiren çağrılarda tamamen düşünmeye
      // gidip içeriği boş bırakıyordu. Düşük tavan parayı kurtarmaz, sadece karşılığını kaybettirir.
      maxTokens: schema ? this.config.limits.schemaMaxTokens : this.config.limits.textMaxTokens,
    });

    if (!schema) return { content: content.trim(), servedModel, usage };

    let data: Record<string, unknown> | undefined;
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      data = parsed;
    } catch {
      // Şema tutmadı: uydurma veri üretmek yerine boş bırakılır. Hüküm turunda bu, kilidin
      // yeniden koşum ve HUKUM_EKSIK dallarını tetikler (§6.3); triyajda tam kurula düşürür (§5.1).
      data = undefined;
    }
    const summary =
      data && typeof data.summary === "string" ? data.summary : content.trim();
    return { content: summary, data, servedModel, usage };
  }
}
