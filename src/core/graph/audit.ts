// Denetim çıktısının doğrulaması (DESIGN §6.3.1 + §6.2). Zorunlu premortem bir PROMPT RİCASI
// değildir: burada şema ile zorlanır, burada kod ile denetlenir. Eksik denetim sessizce geçmez,
// "eksik" olarak işaretlenir ve Şah'ın önüne çıkar.
//
// Kompozisyon kararı (M2-A): her sınanmış iddia, §6.2'nin üç durumundan birini ilk günden taşır.
// Etiketsiz iddia geçersizdir; kanıt disiplini denetimin İÇİNDE doğar, sonradan eklenen bir kat olmaz.

/** DESIGN §6.2 kanıt kapısı, üç durum. `dogrulanmis` için URL zorunluluğu M2-C'de kod ile eklenir. */
export const EVIDENCE_LABELS = ["dogrulanmis", "model-bilgisi", "varsayim"] as const;
export type EvidenceLabel = (typeof EVIDENCE_LABELS)[number];

/** DESIGN §6.3.1: "en az 3 sınanmış iddia". */
export const MIN_AUDIT_CLAIMS = 3;

export interface AuditClaim {
  claim: string;
  evidence: EvidenceLabel;
  /** URL ya da gerekçe; boş olabilir ama alan zorunludur (etiketin dayanağı görünür kalsın) */
  source: string;
}

export interface AuditOutput {
  summary: string;
  /** "bu neden başarısız olur" senaryosu; uyum derecesinden BAĞIMSIZ olarak zorunlu */
  premortem: string;
  claims: AuditClaim[];
  weakestLink: string;
}

export type AuditCheck =
  | { ok: true; audit: AuditOutput }
  | { ok: false; reason: string };

function isLabel(v: unknown): v is EvidenceLabel {
  return typeof v === "string" && (EVIDENCE_LABELS as readonly string[]).includes(v);
}

/** Şemayı geçmiş görünen bir çıktının mekanik şartları gerçekten taşıyıp taşımadığını sınar. */
export function validateAudit(data: unknown): AuditCheck {
  if (!data || typeof data !== "object") return { ok: false, reason: "denetim çıktısı şemaya uymadı" };
  const d = data as Record<string, unknown>;

  const premortem = typeof d.premortem === "string" ? d.premortem.trim() : "";
  if (!premortem) return { ok: false, reason: "premortem senaryosu yok (§6.3.1 zorunlu)" };

  if (!Array.isArray(d.claims)) return { ok: false, reason: "sınanmış iddia listesi yok" };
  if (d.claims.length < MIN_AUDIT_CLAIMS) {
    return { ok: false, reason: `en az ${MIN_AUDIT_CLAIMS} sınanmış iddia gerekir, ${d.claims.length} geldi` };
  }

  const claims: AuditClaim[] = [];
  for (const raw of d.claims) {
    const c = raw as Record<string, unknown>;
    if (typeof c?.claim !== "string" || !c.claim.trim()) {
      return { ok: false, reason: "iddia metni boş" };
    }
    if (!isLabel(c.evidence)) {
      return {
        ok: false,
        reason: `iddia etiketsiz veya tanınmayan etiket: "${String(c?.evidence)}" (§6.2: ${EVIDENCE_LABELS.join(" | ")})`,
      };
    }
    claims.push({ claim: c.claim, evidence: c.evidence, source: typeof c.source === "string" ? c.source : "" });
  }

  return {
    ok: true,
    audit: {
      summary: typeof d.summary === "string" ? d.summary : "",
      premortem,
      claims,
      weakestLink: typeof d.weakestLink === "string" ? d.weakestLink : "",
    },
  };
}
