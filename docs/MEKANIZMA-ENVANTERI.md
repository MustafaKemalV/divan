# Mekanizma zorlama envanteri

Divan'ın her iddiasının karşısında bir soru vardır: **bu mekanizma neyle zorlanıyor?** Bir mekanik
yalnızca promptta duruyorsa zorlanmıyor demektir; model o gün unutabilir, yumuşatabilir, atlayabilir
ve kimse fark etmez. Bu tablo o soruyu tek tek cevaplar.

Katmanlar, zayıftan güçlüye: **sadece-prompt** (rica) < **kod** (çalışma anında denetlenir) <
**şema** (çıktı yapısı zorunlu) < **graf** (geçiş koşulu, ihlal edilemez). Her satırın yanında
kanıtı vardır: kanıtsız satır bu tabloya giremez.

`SADECE-PROMPT` ve `YOK` satırları **borç listesidir** ve M2 kapısında koda karşı denetlenecektir.

**Köken** sütunu trend içindir: bir satır o milestone'da yeni mi doğdu, yoksa önceki listede borç
olan bir kalem mi kapandı? M2 kapısı bu sütundan borç eğrisini okuyacak.

Son güncelleme: M2-A1 (prompt altyapısı + gerçek runner iskeleti + premortem şeması).

## §3 Arıza modu tablosu

| Mekanizma | Zorlayan katman | Kanıt | Köken |
|---|---|---|---|
| Heterojen aileler (6 aile / 7 koltuk) | config | `divan.config.json`, 7/7 canlı probe (M0) | M0 |
| Anonimleştirme (F3/F5 kimliksiz) | **YOK** | M2-C borcu | borç (M2-C) |
| Erken uzlaşı kilidi | graf + test | `lock.ts` koşullu kenar, `lock.test.ts`, e2e S05/S06 | M1 |
| Yargıçlık mekanik (blocking gömülemez) | kod + test | `bd_draft` ham metin kopyası, e2e S03 | M1 |
| Topraklama (kanıt etiketi) | şema + kod + test | `schemas.ts` AUDIT.claims.evidence, `audit.ts`, `audit.test.ts` | M2-A yeni |
| Topraklama (URL'siz "doğrulanmış" olamaz) | şema + kod + test | `audit.ts` `isSourceUrl`, `audit.test.ts`, e2e S12. **Kalan borç:** URL'nin İÇERİĞİ doğrulanmıyor (M2-C gerçek arama) | M2-A: borç kapandı |
| Değişmemiş muhalefet notu | kod + test | `bd_draft`, e2e S03 | M1 |
| Düşen itiraz izi | kod + test | `judgmentHistory`, e2e S04. **Borç:** eşleştirme kriter ADIYLA (M2 kapısı notu) | M1 |
| Tam-uyum bayrağı | **YOK** | M4 borcu | borç (M4) |
| Kör A/B (ölçüm) | **YOK** | M5 borcu | borç (M5) |
| Denetçi divergent fazlarda sessiz | graf + test | kadro listeleri, prompt kapsamı testi (sapmayı bu test yakaladı) | M2-A: sapma düzeltildi |

## §5 Akış

| Mekanizma | Zorlayan katman | Kanıt | Köken |
|---|---|---|---|
| 3 planlı kapı (Şah kararı) | graf + test | `interrupt`, e2e S01/S02 | M1 |
| 4 olay-tetikli dönüş | graf + test | e2e S03 (erken brifing), S06 (hüküm eksik), S08 (bütçe), S12 (denetim eksik) | M1 (+1 M2-A) |
| F4 revizyon döngüsü, mekanik kapanma | kod + test | `revision.ts` sayı karşılaştırması, `revision.test.ts`, e2e S03 | M1 |
| Bütçe: "aşılacak mı" + faz girişi | kod + test | `budget.ts`, `budget.test.ts`, e2e S08 | M1 |
| Bütçe yanıt sözleşmesi (devam / sayı / iptal) | graf + kod + test | kapı payload'ı sözleşmeyi ilan eder; e2e S08 (devam tavanı değiştirmez, sayı yükseltir), S14 (sözleşme dışı yanıt ve iptal akışı durdurur, çağrı sayacı sabit kalır) | M2-A2: borç kapandı |
| Bütçe kapısı payload'ı: kesin ölçüm / kestirim ayrımı | kod + test | `estimate.ts` koltuk bazlı kestirim, `estimate.test.ts`, e2e S08 (kestirim açıkça etiketli, gözlemsiz koltuk sayılır) | M2-A2 yeni |
| Bütçe kapısının sözleşme dışı yanıtta YENİDEN AÇILMASI | **YOK** | borç: LangGraph resume semantiği tek düğüm içinde yeniden sormaya izin vermedi; şu an güvenli duruş var, yeniden sorma yok. Kapının ayrı düğüme çıkarılması gerekiyor | borç (M2-B) |
| Re-table (tek hedefli yeniden koşum) | kod + test | `route.ts` getStateHistory, e2e S09 | M1 |
| Bağlam sıkıştırması (ham taşınmaz) | graf + test | BD faz özetleri, e2e parmak-izi ölçümü (3 fazda 0 sızıntı) | M1 |
| Faz kilidi (şapka disiplini) | **SADECE-PROMPT** | borç: fazın modu prompt metninde, yapıda değil | borç (sadece-prompt) |
| §5.1 Triyaj: gözlem + kod sınıflandırması | kısmi | sınıf hâlâ model beyanı (M2-B borcu), ama KAPI 1'de "kanaat" işaretiyle sunuluyor (e2e S01) | kısmen M2-A |
| §5.1 Kadro kilitleri (Denetçi kaldırılamaz, min 3 rol, çeşitlilik uyarısı) | **YOK** | M2-B borcu | borç (M2-B) |
| §5.1 Ölü-uç kuralı (BD şemayı geçemezse tam kurul) | **YOK** | M2-A2 borcu | borç (M2-A2) |

## §6 Anti-yağcılık mekanikleri

| Mekanizma | Zorlayan katman | Kanıt | Köken |
|---|---|---|---|
| Beyan bütünlüğü (değiştirme yok: taşı ya da iade et) | graf + kod + test | `runAuditWithReturn`, e2e S12/S13 | M2-A yeni |
| İade semantiği (tek iade, ham iz kalır, iade bütçeye yazılır) | graf + kod + test | e2e S12 (retries=1, 28 çağrı), S13 (iadede düzelme) | M2-A yeni |
| 6.1 Anonimleştirme | **YOK** | M2-C borcu | borç (M2-C) |
| 6.2 Kanıt kapısı, üç durum etiketi | şema + kod + test | denetim şemasında zorunlu enum, `audit.test.ts` | M2-A yeni |
| 6.2 URL zorunluluğu (rozet yapısal olarak hak edilir) | şema + kod + test | e2e S12; ilk gerçek çağrıda tetiklendi, kural öne çekildi | M2-A: borç kapandı |
| 6.3.1 Zorunlu premortem + >=3 sınanmış iddia | şema + kod + test | `schemas.ts` AUDIT, `audit.ts`, `audit.test.ts`, e2e S11 | M2-A: borç kapandı |
| 6.3.2 Tam-uyum bayrağı | **YOK** | M4 borcu | borç (M4) |
| 6.3.3 Hüküm turu tamamlanmadan F5 açılmaz | graf + test | `lock.ts`, e2e S05/S06 | M1 |
| 6.4 Gömülemez muhalefet | kod + test | e2e S03 (ham metin KAPI 3'te) | M1 |
| 6.5 Anlaşmazlık sinyali (Kendall tau) | **YOK** | M2-D borcu | borç (M2-D) |

## §7 Orkestrasyon ve operasyon

| Mekanizma | Zorlayan katman | Kanıt | Köken |
|---|---|---|---|
| Anahtar istemciye sızmaz | kod (mühür) | `server-only`, M0 bundle kanıtı | M0 |
| Koltuk probu (şema uyumu ölçümü) | kod | `probe.ts`, 7/7 canlı | M0 |
| Şema-kritik çağrı yönlendirmesi (probu geçmeyene gitmez) | **YOK** | M2-A2 borcu: prob sonucu graf koşumuna bağlı değil | borç (M2-A2) |
| Prob önbelleği (config-hash + TTL + asimetri) | kod + test | `probeCache.ts`, `probeCache.test.ts`; canlı: 2. koşum 0 ms / 0 çağrı (docs/M2-OLCUMLER.md) | M2-A2: borç kapandı |
| Prob maliyeti: sayaca girmez ama kayıtta taşınır | kod | `probe.ts` kayıt başına `costNanoUsd` + `probedAt`, `/api/seat-check` ayrı özet; canlı 7/7 kayıt | M2-A2: borç kapandı |
| Prompt dosyaları (sessiz varsayılan yok) | kod + test | `prompts/load.ts` hata verir, e2e prompt kapsamı (36 çift, 0 eksik) | M2-A yeni |
| Runner modu damgası | kod + test | done olayı `runnerMode`, e2e S01 | M2-A yeni |
| Maliyet sayacı (bilinmeyen tahmin edilmez) | kod + test | `usage.ts`, `usage.test.ts`, e2e S01 (stub koşumda 27/27 çağrı "maliyeti bilinmiyor") | M2-A2: borç kapandı |

## §9 Çıktılar

| Mekanizma | Zorlayan katman | Kanıt | Köken |
|---|---|---|---|
| Şablon sadakati (`templates/` birebir) | **YOK** | M3 borcu | borç (M3) |
| Listede olmayan bağımlılık prompta giremez | **YOK** | M3 borcu | borç (M3) |
| Oturum künyesi (stub oturumu rozeti) | kod | done olayı `runnerMode`; belgeye basımı M3 | M2-A yeni |

## Özet

Zorlanan mekanizma sayısı 26, borç 12. Borçların dağılımı: M2-A2 iki, M2-B dört, M2-C iki,
M2-D bir, M3 üç, M4 iki, M5 bir. (Kanıt rozetinin URL kuralı M2-C'den M2-A'ya ÇEKİLDİ: ilk gerçek
çağrıda bir iddia hak etmediği rozeti aldı, borcu ertelemek yerine kapatmak gerekti.)

Tek **SADECE-PROMPT** satırı faz kilididir (şapka disiplini). Şu an fazın modu yalnız prompt
metninde duruyor; bir koltuk yanlış modda konuşursa hiçbir yapı bunu durdurmaz. Bunun kodla
zorlanması, çıktıya mod alanı eklemek veya faz-rol eşleşmesini şemaya bağlamak demektir; M2
kapısında tartışılacak.
