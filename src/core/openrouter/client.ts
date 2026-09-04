// Minimal OpenRouter istemcisi (M2'de büyür: web plugin, usage/maliyet, anonimleştirme).
// server-only MÜHRÜ: bir istemci bileşeni bunu import ederse derleme patlar -> anahtar
// hiçbir zaman tarayıcı paketine giremez (DESIGN §10 "anahtar makineden çıkmaz").

import "server-only";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface JsonSchemaSpec {
  name: string;
  schema: Record<string, unknown>;
}

export interface ChatOptions {
  /** pin'li model */
  model: string;
  /** [pin, ...fallbacks] = OpenRouter otomatik yönlendirme dizisi */
  models?: string[];
  messages: ChatMessage[];
  /** verilirse response_format=json_schema (structured output) */
  jsonSchema?: JsonSchemaSpec;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface UsageInfo {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  /** akıl yürüten modellerin cevaptan ÖNCE harcadığı token; tavan sorunlarının teşhisi bundadır */
  reasoningTokens?: number;
  /** sağlayıcı önbelleğinden okunan token (varsa) */
  cachedTokens?: number;
  /**
   * Sağlayıcının bildirdiği USD maliyeti.
   *
   * CANLI DOĞRULANDI (2026-09-02, M2-A ilk gerçek çağrılar): OpenRouter `usage` nesnesi
   * `prompt_tokens` / `completion_tokens` / `total_tokens` ve `cost` alanlarını döndürür.
   * `cost` için ayrıca `usage: { include: true }` göndermek GEREKMEDİ; iki ayrı sağlayıcıda da geldi:
   *   anthropic/claude-sonnet-5  -> 1027 token, cost 0.003926
   *   deepseek/deepseek-v4-pro   -> 1505 token, cost 0.002648802
   * Maliyet sayacı (M2-A2) bu alanı toplar; alan gelmezse token sayısıyla tahmin YAPILMAZ,
   * maliyet "bilinmiyor" olarak gösterilir (uydurma rakam, rakam olmamasından kötüdür).
   */
  cost?: number;
}

export interface ChatResult {
  content: string;
  /** sağlayıcının bildirdiği bitiş sebebi; zarf işleme gateway.ts'te yapılır */
  finishReason?: string;
  /** cevabı GERÇEKTE veren model (OpenRouter `model` alanı); fallback yönlendirmesini görünür kılar */
  servedModel?: string;
  usage?: UsageInfo;
  raw: unknown;
}

/** Anahtar sunucuda var mı? (probe'un no-key dalını sürer.) */
export function hasApiKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/**
 * Sağlayıcı hata gövdesini istemciye dönmeden süzer (Fable F-3): yalnız HTTP status +
 * kısa mesaj geçer. Ham gövde ve hesap kimliği (user_id) / anahtar ASLA sızmaz; gövdenin
 * yalnız error.message alanı alınır (üst düzey user_id kardeş alanı hiç okunmaz) + kalıp temizliği.
 */
export function sanitizeProviderError(status: number, rawBody: string): string {
  let msg = "";
  try {
    const parsed = JSON.parse(rawBody) as { error?: { message?: unknown } };
    if (typeof parsed.error?.message === "string") msg = parsed.error.message;
  } catch {
    // gövde JSON değil: ham gövdeyi ASLA geçirme, status ile yetin
  }
  msg = msg
    .replace(/user_[A-Za-z0-9]+/g, "[gizlendi]")
    .replace(/sk-[A-Za-z0-9._-]+/g, "[gizlendi]")
    .slice(0, 150);
  return msg ? `OpenRouter ${status}: ${msg}` : `OpenRouter ${status}`;
}

/**
 * HAM sağlayıcı çağrısı. DIŞARIYA AÇIK DEĞİLDİR: tek kapı `gateway.callModel`'dir, çünkü izleme
 * ve cevap zarfı işleme orada yapılır. Bunu doğrudan çağıran kod ikisini de atlamış olur.
 * @internal
 */
export async function chatRaw(opts: ChatOptions): Promise<ChatResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY tanımlı değil (.env.local).");

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 256,
  };
  if (opts.models?.length) body.models = opts.models;
  if (opts.jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: opts.jsonSchema.name,
        strict: true,
        schema: opts.jsonSchema.schema,
      },
    };
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/MustafaKemalV/divan",
      "X-Title": "Divan",
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(sanitizeProviderError(res.status, text));
  }

  const data = (await res.json()) as {
    model?: string;
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
      cost?: number;
      prompt_tokens_details?: { cached_tokens?: number };
      completion_tokens_details?: { reasoning_tokens?: number };
    };
  };
  const choice = data.choices?.[0];
  const content = choice?.message?.content ?? "";
  const u = data.usage;
  const usage: UsageInfo | undefined = u
    ? {
        promptTokens: u.prompt_tokens,
        completionTokens: u.completion_tokens,
        totalTokens: u.total_tokens,
        cost: u.cost,
        reasoningTokens: u.completion_tokens_details?.reasoning_tokens,
        cachedTokens: u.prompt_tokens_details?.cached_tokens,
      }
    : undefined;
  return { content, servedModel: data.model, usage, finishReason: choice?.finish_reason, raw: data };
}
