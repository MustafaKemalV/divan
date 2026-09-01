// Faz şemaları (DESIGN §7 "şema-kritik çağrı"). Bir fazın çıktısı yapıya bağlıysa mekanik ORADA
// zorlanır: hüküm turunun durumları, F0 triyaj gözlemleri, HMW listesi. Şemayı geçemeyen koltuğa
// bu çağrılar yönlendirilmez (probe). Framework-bağımsız veri.

export interface JsonSchemaSpec {
  name: string;
  schema: Record<string, unknown>;
}

const HMW: JsonSchemaSpec = {
  name: "divan_f0_hmw",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "hmw"],
    properties: {
      // Her şema-kritik faz insan-okunur bir özet döndürür: transkripte ham JSON düşmesin.
      summary: { type: "string" },
      hmw: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
    },
  },
};

// DESIGN §6.3.1 + §6.2: zorunlu premortem ve kanıt etiketi PROMPTTA rica edilmez, BURADA zorlanır.
// Alt sınırlar (minItems) bazı sağlayıcılarda yok sayılabilir; bu yüzden audit.ts KODLA da denetler.
const AUDIT: JsonSchemaSpec = {
  name: "divan_f4_audit",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "premortem", "claims", "weakestLink"],
    properties: {
      summary: { type: "string" },
      premortem: { type: "string" },
      claims: {
        type: "array",
        minItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["claim", "evidence", "source"],
          properties: {
            claim: { type: "string" },
            evidence: { type: "string", enum: ["dogrulanmis", "model-bilgisi", "varsayim"] },
            source: { type: "string" },
          },
        },
      },
      weakestLink: { type: "string" },
    },
  },
};

const BRIEFING: JsonSchemaSpec = {
  name: "divan_f0_briefing",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "complexity"],
    properties: {
      summary: { type: "string" },
      // M2-B'de DESIGN §5.1'in dört gözlemine genişler; şu an M1 davranışı korunur.
      complexity: { type: "string", enum: ["small", "full"] },
    },
  },
};

const JUDGMENT: JsonSchemaSpec = {
  name: "divan_f4_judgment",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "judgment"],
    properties: {
      summary: { type: "string" },
      judgment: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["criterion", "status", "blocking", "rawText"],
          properties: {
            criterion: { type: "string" },
            status: { type: "string", enum: ["karsilandi", "kismen", "karsilanmadi"] },
            blocking: { type: "boolean" },
            rawText: { type: "string" },
          },
        },
      },
    },
  },
};

/** Faz -> şema. Burada olan her faz ŞEMA-KRİTİKTİR (probu geçmemiş koltuğa gitmez, §7). */
const BY_PHASE: Record<string, JsonSchemaSpec> = {
  "F0:briefing": BRIEFING,
  "F0:hmw": HMW,
  "F4:audit": AUDIT,
  "F4s:audit": AUDIT,
  "F4:judgment": JUDGMENT,
  "F4s:judgment": JUDGMENT,
};

export function schemaForPhase(phase: string): JsonSchemaSpec | undefined {
  return BY_PHASE[phase];
}

export function isSchemaCritical(phase: string): boolean {
  return phase in BY_PHASE;
}
