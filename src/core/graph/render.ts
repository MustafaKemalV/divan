// Şema çıktılarının TRANSKRİPT metnine dönüşü (M2-A3 T3-1). Saf: graf bilmez, state bilmez,
// sağlayıcı bilmez; girdisi doğrulanmış veri, çıktısı metindir.
//
// Neden var: şema fazlarında runner `content = data.summary` yapıyordu. Yani Denetçi'nin
// premortem'i, etiketli iddiaları, kaynak URL'leri ve en zayıf halkası ŞEMAYLA ZORLANIP
// DOĞRULANDIKTAN SONRA atılıyordu; transkripte tek satırlık bir özet giriyor, sonraki hiçbir
// çağrı kanıt defterini görmüyordu. Zorlanan ama taşınmayan bir mekanizma, yarısı olmayan bir
// mekanizmadır: §6.2'nin rozet disiplini ancak rozetler kurulun önüne gelirse iş görür.
//
// Sınır: burası BİÇİMLENDİRİR, yargılamaz. Hiçbir etiketi çevirmez, hiçbir maddeyi düşürmez,
// hiçbir metni kısaltmaz (beyan bütünlüğü, §6). Doğrulama `audit.ts`'in işidir ve ondan ÖNCE olur.

import type { AuditOutput } from "./audit.ts";
import type { JudgmentItem } from "./state.ts";

/** Denetim çıktısını okunur metne çevirir: özet, premortem, etiketli iddialar, en zayıf halka. */
export function renderAudit(audit: AuditOutput, alintilar: readonly { url: string; title?: string }[] = []): string {
  const satirlar = ["DENETİM"];
  if (audit.summary.trim()) satirlar.push(`Özet: ${audit.summary.trim()}`);
  satirlar.push(`Premortem (bu neden başarısız olur): ${audit.premortem.trim()}`);
  satirlar.push(`Sınanmış iddialar (${audit.claims.length}):`);
  for (const c of audit.claims) {
    // Etiket başta durur: bir iddianın nasıl okunacağını belirleyen ilk şey kanıt durumudur.
    // URL'siz "dogrulanmis" buraya zaten gelemez, audit.ts onu geçersiz sayar (§6.2).
    // Doğrulanmış iddiaya ARAMA PARÇASI eklenir (§6.2 M2-C): kanıt defteri URL ile birlikte o
    // URL'nin arama sonucundaki başlığını taşır. Rozetin dayanağı okunabilir olmalı.
    const parca = c.evidence === "dogrulanmis" ? alintilar.find((a) => a.url === c.url)?.title : undefined;
    satirlar.push(
      `- ${c.evidence} | ${c.claim} | ${c.source || "kaynak belirtilmedi"} | ${c.url || "URL yok"}` +
        (parca ? ` | arama sonucu: ${parca}` : ""),
    );
  }
  if (audit.weakestLink.trim()) satirlar.push(`En zayıf halka: ${audit.weakestLink.trim()}`);
  return satirlar.join("\n");
}

/**
 * Hüküm turunu okunur metne çevirir: kriter başına durum, blocking işareti ve Denetçi'nin HAM
 * metni. Ham metin buraya dahildir, çünkü §6.4'ün muhalefet notu onun üstüne kuruludur ve
 * savunma turunun neye cevap verdiğini bilmesi gerekir.
 */
export function renderJudgment(items: readonly JudgmentItem[], summary = ""): string {
  const satirlar = ["HÜKÜM TURU"];
  if (summary.trim()) satirlar.push(`Özet: ${summary.trim()}`);
  if (items.length === 0) {
    satirlar.push("(madde listelenmedi)");
    return satirlar.join("\n");
  }
  for (const it of items) {
    satirlar.push(`- ${it.criterion}: ${it.status}${it.blocking ? " [BLOCKING]" : ""}`);
    if (it.rawText.trim()) satirlar.push(`  "${it.rawText.trim()}"`);
  }
  return satirlar.join("\n");
}
