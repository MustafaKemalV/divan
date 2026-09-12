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
  /** etiketin dayanağı: gerekçe ya da kaynak adı */
  source: string;
  /** §6.2: `dogrulanmis` için zorunlu; diğer etiketlerde boş kalabilir */
  url: string;
}

/** §6.2 rozet kuralı: URL'siz hiçbir iddia "doğrulanmış" olamaz. Biçim kontrolü. */
export function isSourceUrl(v: unknown): boolean {
  return typeof v === "string" && /^https?:\/\/\S+$/i.test(v.trim());
}

/**
 * URL karşılaştırma normali (M2-C-3). Aynı kaynağı gösteren iki yazım eşleşmeli, yoksa kural
 * gerçek bir kaynağı biçim farkı yüzünden reddeder ve modeli URL'i harfi harfine kopyalamaya
 * zorlar. Host küçük harfe iner, fragment ve sondaki "/" atılır. Sorgu dizesi KORUNUR: `?v=2`
 * çoğu sitede başka bir sayfadır.
 */
export function normalizeUrl(v: string): string {
  try {
    const u = new URL(v.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    let metin = u.toString();
    if (metin.endsWith("/") && u.pathname !== "/") metin = metin.slice(0, -1);
    return metin;
  } catch {
    return v.trim().toLowerCase();
  }
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

/**
 * Şemayı geçmiş görünen bir çıktının mekanik şartları gerçekten taşıyıp taşımadığını sınar.
 *
 * `izinliUrller` (M2-C-3): o ÇAĞRININ arama sonuçlarında bulunan URL'ler. "dogrulanmis" etiketli
 * bir iddianın URL'si bu kümede olmak zorundadır. Gerekçe 9 Eylül koşumunda ölçüldü: biçimi
 * geçerli ama hafızadan yazılmış bir URL rozeti aldı ve kod onu geçirdi. Rozet o zaman kaynak
 * GÖSTERME disiplinini zorluyordu, kaynağın varlığını değil.
 *
 * Liste VERİLMEZSE eski davranış sürer (yalnız biçim kontrolü): stub koşumlar ve aramasız fazlar
 * bu yoldan geçer. Liste BOŞ verilirse "arama yapıldı ama sonuç yok" demektir ve her
 * "dogrulanmis" reddedilir; ikisi ayrı şeydir ve karıştırılmaz.
 */
export function validateAudit(data: unknown, izinliUrller?: readonly string[]): AuditCheck {
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
    const url = typeof c.url === "string" ? c.url.trim() : "";
    // §6.2: rozet YAPISAL olarak hak edilir. URL'siz "dogrulanmis" geçersizdir; etiketi sessizce
    // düşürmek de yasak, çünkü o zaman Denetçi'nin beyanını biz değiştirmiş oluruz.
    if (c.evidence === "dogrulanmis" && !isSourceUrl(url)) {
      return {
        ok: false,
        reason: `"dogrulanmis" etiketli iddia URL'siz olamaz (§6.2): "${c.claim.slice(0, 60)}"`,
      };
    }
    // M2-C-3: URL'nin VAR OLMASI yetmez, o çağrının ARAMA SONUÇLARINDAN gelmiş olmalı.
    if (c.evidence === "dogrulanmis" && izinliUrller) {
      const izinli = new Set(izinliUrller.map(normalizeUrl));
      if (!izinli.has(normalizeUrl(url))) {
        const liste = izinliUrller.length
          ? `Bu çağrının arama sonuçları: ${izinliUrller.slice(0, 8).join(", ")}`
          : "Bu çağrıda arama sonucu yok.";
        return {
          ok: false,
          reason:
            `"dogrulanmis" etiketli iddianın URL'si arama sonuçlarında YOK (§6.2): ` +
            `"${c.claim.slice(0, 60)}" -> ${url}. Hafızadan yazılan URL kaynak sayılmaz. ${liste}`,
        };
      }
    }
    claims.push({
      claim: c.claim,
      evidence: c.evidence,
      source: typeof c.source === "string" ? c.source : "",
      url,
    });
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
