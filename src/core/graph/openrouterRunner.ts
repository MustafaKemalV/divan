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
// Kullanıcı mesajının kuruluşu ayrı ve SAF modülde: burada dururken bir birim testi ona
// ulaşamıyordu (bu dosya `gateway` üzerinden `server-only` mührü taşır).
import { buildUserMessage } from "./userMessage.ts";
import { buildRequest } from "./requestBuilder.ts";

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

    // İsteğin parçaları SAF modülde kurulur (requestBuilder): eklenti kararı bir mekanizmadır
    // (§6.2 kapsam ve faz kapı) ve bu dosya `server-only` mühürlü olduğu için burada yazılan
    // hiçbir karar birim testten görünmez.
    const istek = buildRequest({
      seatId,
      input,
      system,
      user: buildUserMessage(input),
      fazdaYapilanArama: input.searchesInPhase ?? 0,
      perPhaseCap: this.config.search.perPhaseCap,
      maxResults: this.config.search.maxResults,
    });

    const { content, servedModel, usage, citations } = await callModel({
      model: sm.model,
      models: [sm.model, ...sm.fallbacks],
      messages: [
        { role: "system", content: istek.system },
        { role: "user", content: istek.user },
      ],
      plugins: istek.plugins,
      jsonSchema: schema,
      // Tavan ÖLÇÜMLE belirlendi (docs/M2-OLCUMLER.md): akıl yürüten modeller cevaptan önce
      // düşünme tokenı harcıyor ve 2048'lik tavan şema gerektiren çağrılarda tamamen düşünmeye
      // gidip içeriği boş bırakıyordu. Düşük tavan parayı kurtarmaz, sadece karşılığını kaybettirir.
      maxTokens: schema ? this.config.limits.schemaMaxTokens : this.config.limits.textMaxTokens,
      // İPTAL (U-9): zaman aşımında istek gerçekten durur. Zincir buraya kadar kuruluydu
      // (gateway ve client `signal` alıyordu) ama hiçbir yerden geçirilmiyordu.
      signal: input.signal,
    });

    const aramaBilgisi = { citations, searchRequested: !!istek.plugins, aramaAtlandi: istek.aramaAtlandi };
    if (!schema) return { content: content.trim(), servedModel, usage, ...aramaBilgisi };

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
    return { content: summary, data, servedModel, usage, ...aramaBilgisi };
  }
}
