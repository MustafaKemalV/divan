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

export interface ChatResult {
  content: string;
  raw: unknown;
}

/** Anahtar sunucuda var mı? (probe'un no-key dalını sürer.) */
export function hasApiKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
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
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  return { content, raw: data };
}
