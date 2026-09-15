# Mekanizma zorlama envanteri

Divan'ın her iddiasının karşısında bir soru vardır: **bu mekanizma neyle zorlanıyor?** Bir mekanik
yalnızca promptta duruyorsa zorlanmıyor demektir; model o gün unutabilir, yumuşatabilir, atlayabilir
ve kimse fark etmez. Bu tablo o soruyu tek tek cevaplar.

Katmanlar, zayıftan güçlüye: **sadece-prompt** (rica) < **kod** (çalışma anında denetlenir) <
**şema** (çıktı yapısı zorunlu) < **graf** (geçiş koşulu, ihlal edilemez). Her satırın yanında
kanıtı vardır: kanıtsız satır bu tabloya giremez.

`SADECE-PROMPT` ve `YOK` satırları **borç listesidir** ve M2 kapısında koda karşı denetlenecektir.

**Satır kuralı (Şah onaylı, M2-A3).** Bir satır = DESIGN'da yazılı BİR VAAT. Bir arızanın
düzeltilmesi yeni satır AÇMAZ; var olan satırın kanıtını günceller ve kökeni "kanıt güncellendi"
der. Aksi halde envanter, vaatleri değil yapılan işleri sayan bir günlüğe dönüşür ve sayı her
düzeltmede kendiliğinden şişer. Kaynağı DESIGN değil `docs/SUREC.md` olan güvenceler tabloların dışında,
"Süreç güvenceleri" başlığındadır ve sayıya girmez.

**Köken** sütunu trend içindir: bir satır o milestone'da yeni mi doğdu, yoksa önceki listede borç
olan bir kalem mi kapandı? M2 kapısı bu sütundan borç eğrisini okuyacak.

Son güncelleme: M2-A3 (bağlam mimarisi revizyonu; Blok 1 kapandı, kapanış turu işlendi).

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
| Güvenli duruşun KURTARILABİLİR olması | graf + test | e2e S15 zinciri: ihlal -> sebepli duruş -> re-table -> durum ve sayaç intakt -> devam -> tamamlanma. Duruş mesajı kurtarma yolunu hedef düğüm adıyla söyler | M2-A2 yeni |
| Bütçe kapısının sözleşme dışı yanıtta YENİDEN AÇILMASI | **YOK** | borç: LangGraph resume semantiği tek düğüm içinde yeniden sormaya izin vermedi (iki deney, koda yorum olarak yazıldı). Şu an güvenli duruş var ve KURTARILABİLİR; eksik olan yalnız yerinde yeniden sorma. Ödemeden önce ayrı-kapı-düğümü deseni için upstream doküman/issue taraması yapılacak; önceliği M4 düğmelerinden sonra yeniden tartılacak | borç (M2-B) |
| Re-table (tek hedefli yeniden koşum) | kod + test | `route.ts` getStateHistory, e2e S09 | M1 |
| Ek bağlam: bütçe bilinçli enjeksiyon | graf + test | tam metin yalnız F0-BD ve F4 (değerlendirenler + Denetçi); e2e KANIT bloğu izinsiz faza sızıntıyı sayıyla gösteriyor (0) | M2-A yeni |
| Oturum zarfı: çerçeve HER çağrıda (D-2) | kod + test | `context.ts` `buildEnvelope` kademeli görünürlük, `userMessage.ts` zarfı İLK bloğa basar; `context.test.ts` + `userMessage.test.ts`; e2e "zarfsız geç faz çağrısı: 0". Kırmızı: F2 ve sonrasındaki 19 ajan çağrısının hiçbiri seçilen HMW'yi görmüyordu | M2-A3 yeni |
| Bağlam sıkıştırması (ham taşınmaz) | graf + test | BD faz özetleri, e2e parmak-izi ölçümü (3 fazda 0 sızıntı). Özet ZİNCİRİ de mekanik: `context.ts` son özeti seçer, özet kaydı bir daha ham bağlam olmaz, `judgmentHistory` tur numarası taşır (`context.test.ts`) | M2-A3: kanıt güncellendi |
| Faz kilidi (şapka disiplini) | **SADECE-PROMPT** | borç: fazın modu prompt metninde, yapıda değil | borç (sadece-prompt) |
| Faz içi paralellik: kanonik sıra | kod + test | `phaseRun.ts` (Promise.all girdi sırasını korur), `phaseRun.test.ts` (tamamlanma sırası bilerek ters çevrilir), e2e KANIT bloğu: gecikme iki farklı koltukta, transkript kanonik ve bayt-özdeş | M2-A2 yeni |
| Çağrı zaman aşımı (paralelliğin ön koşulu) | config + kod + test | `timeouts.perCallMs` (ölçülen 30 sn'nin 4 katı), `phaseRun.test.ts` zaman aşımı dalı | M2-A2 yeni |
| Eksik ses sessiz geçilmez (koltuk sustu) | kod + test | iki deneme sonra `faz/koltuk` kaydı; e2e S16: KAPI 3 ve done'da görünür, susan koltuk için sıralama UYDURULMAZ, yeniden denemeler sayaca yazılır | M2-A2 yeni |
| Cevapsız denemenin maliyeti "bilinmiyor" | kod + test | e2e S16: 30 çağrının 30'u bilinmeyen maliyet; başarısız deneme sıfır sayılmaz | M2-A2 yeni |
| §5.1 Triyaj: gözlem + kod sınıflandırması | kısmi | sınıf hâlâ model beyanı (M2-B borcu), ama KAPI 1'de "kanaat" işaretiyle sunuluyor (e2e S01) | kısmen M2-A |
| §5.1 Kadro kilitleri (Denetçi kaldırılamaz, min 3 rol, çeşitlilik uyarısı) | **YOK** | M2-B borcu | borç (M2-B) |
| §5.1 Ölü-uç kuralı (BD şemayı geçemezse tam kurul) | **YOK** | M2-A2 borcu | borç (M2-A2) |

## §6 Anti-yağcılık mekanikleri

| Mekanizma | Zorlayan katman | Kanıt | Köken |
|---|---|---|---|
| Beyan bütünlüğü (değiştirme yok: taşı ya da iade et) | graf + kod + test | `runAuditWithReturn`, e2e S12/S13 | M2-A yeni |
| ÖZET KOTASI: özetleyici bir koltuğu düşüremez | şema + kod + test | `summary.ts` (konuşan her koltuk >=1 madde), `summary.test.ts`, e2e S17. Susan koltuk muaf; kayıt hali koltuk etiketli, taşınan hali kimliksiz | M2-A yeni |
| Ajanlar arası taşınan metinde kimlik sızıntısı (etiket + metin içi ad) | kod + test | `maskSeatNames` harf sınırı tanır ("Mimari kararlar" ve "marketing" bozulmaz, "Mimar dedi" maskelenir) ve yalnız özetin değil, F5 sıralamalarının da kapısıdır (`bd_draft` ve `f5_output` aynı kapıdan geçer); `summary.test.ts`, e2e ANON-SIRALAMA. **Bilinen sınırlar:** (a) büyük harfli "MİMAR" maskelenmez, regex'in `i` bayrağı Unicode varsayılan katlaması yapar ve `İ` küçük harfe iki kod noktasına düşer (gerçek modelde nadir, kayda geçti); (b) "market" sıradan bir kelime olduğu için tek başına da maskelenir (M2-B "kadro = veri" borcu); (c) dolaylı tanıma (üslup, konu, ima) M2-C'nin işi | M2-A3: kanıt güncellendi |
| İade semantiği (tek iade, ham iz kalır, iade bütçeye yazılır) | graf + kod + test | e2e S12 (retries=1, 28 çağrı), S13 (iadede düzelme) | M2-A yeni |
| 6.1 Anonimleştirme | **YOK** | M2-C borcu | borç (M2-C) |
| 6.2 Kanıt kapısı, üç durum etiketi | şema + kod + test | denetim şemasında zorunlu enum, `audit.test.ts` | M2-A yeni |
| 6.2 URL zorunluluğu (rozet yapısal olarak hak edilir) | şema + kod + test | e2e S12; ilk gerçek çağrıda tetiklendi, kural öne çekildi | M2-A: borç kapandı |
| 6.2 Üç adımlı topraklama (sorgu turu -> kod arar -> denetim) | kod + test | e2e S27 (sorgu ve arama turları transkriptte), S41 (sorgusuz denetim rozet alamaz) | M2-C-2 yeni |
| 6.2 Alıntı şartı ("dogrulanmis" için URL + birebir alıntı) | şema + kod + test | `audit.test.ts` (uydurma alıntı reddedilir), e2e S40 | M2-C-2 yeni; U-16'nın yarısı |
| 6.3.1 Zorunlu premortem + >=3 sınanmış iddia | şema + kod + test | `schemas.ts` AUDIT, `audit.ts`, `audit.test.ts`, e2e S11 | M2-A: borç kapandı |
| 6.3.2 Tam-uyum bayrağı | **YOK** | M4 borcu | borç (M4) |
| 6.3.3 Hüküm turu tamamlanmadan F5 açılmaz | graf + test | `lock.ts`, e2e S05/S06 | M1 |
| 6.4 Gömülemez muhalefet | kod + test | e2e S03 (ham metin KAPI 3'te). Taslağı yazan ve denetleyen artık GÖREREK çalışır: `bd_draft` sıralamaları, F4 özetini, muhalefet notunun ham metnini ve düşen itirazları alır, `f5_output` taslağı görür (kırmızı: ikisinin de bağlam uzunluğu 0'dı) | M2-A3: kanıt güncellendi |
| 6.5 Anlaşmazlık sinyali (Kendall tau) | **YOK** | M2-D borcu | borç (M2-D) |

## §7 Orkestrasyon ve operasyon

| Mekanizma | Zorlayan katman | Kanıt | Köken |
|---|---|---|---|
| Anahtar istemciye sızmaz | kod (mühür) | `server-only`, M0 bundle kanıtı | M0 |
| §10 Ağ sınırı: sunucu yalnız `127.0.0.1` (D-6) | kod + ölçüm | `dev`, `start`, e2e ve oturum sürücüsü `--hostname 127.0.0.1`; lsof kırmızı `node -> *:3000`, yeşil `node -> 127.0.0.1:3000`. Anahtar VE harcama yetkisi makineden çıkmaz | M2-A3 yeni |
| Katmanlı prompt mimarisi (D-1): kimlik + zarf + faz + bağlam | kod + test | yedi `<koltuk>-kimlik.md` sistem promptunda (F3/F5 dahil), prompt kapsamı testi kimlikleri de sayar; `userMessage.test.ts` blok sırasını bekler; `persona.test.ts` kimliğin faz dosyasında ÇİFTLENMEDİĞİNİ bekler (kırmızı 40, yeşil 0). **Önbellek etkisi ÖLÇÜLDÜ ve varsayım kısmen yanlışlandı:** D-1 sabit katmanları başa koyarken gerekçe "sağlayıcı önbelleği işleyebilsin" idi; 7 Eylül koşumunda `cachedTokens` toplamı 10.676 ve neredeyse tamamı DeepSeek'in tek denetim çağrısından (10.548), Anthropic koltuklarının hepsinde 0. Tek aileli 9 Eylül koşumunda toplam 0. Sıra doğru, kazanç Anthropic'te alınmıyor: `cache_control` gerekiyor (C-2, M2-C) | M2-A3: kanıt güncellendi |
| Çağrı başına kullanım kaydı (zarfın ve ekin maliyet payı ölçülebilsin) | kod + test | `callLog`: koltuk, faz, deneme, cevabı veren model, token dökümü, maliyet; e2e stub koşumda alanların uydurulmadığını doğrular | M2-A3 yeni |
| Faz-ortası çökme sonrası resume (§7 kalıcılık) | kod + test | sürücü `--devam`'da bekleyen KAPI yoksa bekleyen DÜĞÜMÜ tanır ve `reTableToNode` ile oradan sürdürür; e2e S19: çökmede 19 çağrı, kurtarma sonrası toplam 27, yeniden koşan tamamlanmış düğüm 0. Kırmızı: eski sürücü bu durumu "oturum tamamlanmış" sayıyordu ve ödenmiş çağrılar çöpe gidiyordu | M2-A3 yeni (U-14) |
| TEK KAPI: model çağrısı tek yoldan geçer | kod + tarama | `gateway.callModel`; ham çağrı (`chatRaw`) dışa kapalı, baypas taraması commit'te koşuldu | M2-A: borç kapandı (izleyici baypası) |
| Cevap zarfı okunur, sessiz yoksayma yok | kod + test + doküman | `envelope.ts` `classifyEnvelope`, `envelope.test.ts`, alan envanteri `docs/CEVAP-ZARFI.md` | M2-A yeni |
| Kesilme (tavan) ALTYAPI arızası sayılır | kod + test | `TruncatedResponseError`: iade işlemez, yeniden deneme yapılmaz, koltuğun şema siciline yazılmaz, harcanan para hatayla taşınır | M2-A yeni |
| Koltuk probu (şema uyumu ölçümü) | kod | `probe.ts`, 7/7 canlı | M0 |
| Şema-kritik çağrı yönlendirmesi (probu geçmeyene gitmez) | **YOK** | M2-A2 borcu: prob sonucu graf koşumuna bağlı değil | borç (M2-A2) |
| Prob önbelleği (config-hash + TTL + asimetri) | kod + test | `probeCache.ts`, `probeCache.test.ts`; canlı: 2. koşum 0 ms / 0 çağrı (docs/M2-OLCUMLER.md) | M2-A2: borç kapandı |
| Prob maliyeti: sayaca girmez ama kayıtta taşınır | kod | `probe.ts` kayıt başına `costNanoUsd` + `probedAt`, `/api/seat-check` ayrı özet; canlı 7/7 kayıt | M2-A2: borç kapandı |
| Prompt dosyaları (sessiz varsayılan yok) | kod + test | `prompts/load.ts` hata verir, e2e prompt kapsamı (36 çift, 0 eksik) | M2-A yeni |
| Runner modu damgası | kod + test | done olayı `runnerMode`, e2e S01 | M2-A yeni |
| Maliyet sayacı (bilinmeyen tahmin edilmez) | kod + test | `usage.ts`, `usage.test.ts`, e2e S01 (stub koşumda 27/27 çağrı "maliyeti bilinmiyor"). Sayım TEK kaynaktan: maliyeti BİLİNEN kesilmiş çağrı artık "bilinmeyen" sayılmıyor (e2e S18); kestirimin böleni yalnız maliyeti bilinen çağrılar, yoksa arızalı oturumda faz ucuz görünüyordu (`estimate.test.ts` madde 6) | M2-A3: kanıt güncellendi |

## Fable M2-A3 incelemesinden çıkan borçlar (Blok 3)

| Mekanizma | Zorlayan katman | Kanıt | Köken |
|---|---|---|---|
| Tek koltuk-çağrısı yolu (tek düğümlerde de yeniden deneme, gerçek iptal) | **YOK** | zaman aşımı `AbortSignal` taşımıyor, istek iptal edilmiyor; yeniden deneme yalnız paralel fazlarda | borç (U-9) |
| Kapı sözleşmesi (D-5) | kod + test (asgari) | dört kapı da `kabulEdilen` ilan eder ve yanıtı okur; tanınmayan yanıt akışı sürdürmez, sebepli duruş üretir (`gate.ts`, `gate.test.ts`, e2e S06 + S20). **Kalan borç (U-10):** tek sözleşme TABLOSU yok, kabul listeleri düğüm başına yazılı; sözleşme dışı yanıtta kapı yerinde YENİDEN AÇILMIYOR, güvenli duruş + re-table ile kurtarma var | M2-A3: kanıt güncellendi |
| İki katlı tavan (mekanizma çağrıları sert tavana tabi) | **YOK** | iade, yeniden deneme ve özet çağrıları hiçbir tavana sayılmıyor | borç (U-11) |
| Seçenek defteri + şema-bağlı sıralama (Kendall tau'nun ön şartı) | **YOK** | ortak seçenek ve kriter listesi yok | borç (U-12) |
| Kalıcı kimlikli itiraz ve kriter | **YOK** | düşen itiraz izi hâlâ ADLA eşleşiyor (M1 kapısı borcu) | borç (U-12) |
| Ek belge boyut eşiği ve MALİYET ÖLÇÜMÜ | **YOK** | DESIGN "ölçülür ve kaydedilir" diyor; ölçüm aleti (çağrı başına kayıt) Blok 1'de geliyor, eşik ve rapor Blok 3'te | borç (U-13) |
| Altyapı kesilmesinin doğru etiketlenmesi | **KISMİ** | state'te ayrı tutuluyor ama transkripte "KOLTUK SUSTU" yazılıyor | borç (U-15) |

## §9 Çıktılar

| Mekanizma | Zorlayan katman | Kanıt | Köken |
|---|---|---|---|
| Şablon sadakati (`templates/` birebir) | **YOK** | M3 borcu | borç (M3) |
| Listede olmayan bağımlılık prompta giremez | **YOK** | M3 borcu | borç (M3) |
| Oturum künyesi (stub oturumu rozeti) | kod | done olayı `runnerMode`; belgeye basımı M3 | M2-A yeni |

## Süreç güvenceleri (envanter DIŞI, sayıya girmez)

Bunların kaynağı DESIGN değil `docs/SUREC.md`'dir: Divan'ın kullanıcıya verdiği bir söz değil, bu
repoda çalışma biçimimizin güvencesidir. Vaat saymadıkları için yukarıdaki tabloların ve özet
sayısının dışında dururlar.

| Güvence | Zorlayan katman | Kanıt |
|---|---|---|
| Tek test zinciri ve commit kapısı | komut | `npm test` tek komutta `tsc --noEmit` + bütün birim testleri + e2e koşar; commit `npm test && git commit` zinciriyle atılır, test düşerse commit çalışmaz. Kırmızı: kasıtlı bozulan bir birim testi zinciri düşürdü. Öncesinde on birim testi hiçbir komuta bağlı değildi ve `tsc` zincirde yoktu |

## Özet
Bu tablolarda **48 zorlanan mekanizma, 20 borç** var (toplam 68 satır); sayılar satır satır
sayıldı, tahmin edilmedi. Borçların dağılımı: sonraki milestone'lara planlı 12 (M2-A2 iki, M2-B
iki, M2-C iki, M2-D bir, M3 iki, M4 iki, M5 bir), Fable M2-A3 incelemesinden 6 (U-9, U-11, U-12
iki satır, U-13, U-15), bir SADECE-PROMPT satırı ve bir kısmi satır. Blok 3 borcu sekizden altıya
indi: U-14 capstone öncesine çekilip kapandı, U-10 ise asgari haliyle (dört kapının sözleşmeyi
ilan etmesi ve yanıtı okuması) kapandı, tek tablo hâlâ borç.

**Sayı bu turda düştü, ama kaybedilen bir mekanizma yok.** Sebep satır kuralı: M2-A3 Blok 1'in
dokuz kalemi kendi başlarına satır olmaktan çıkıp ait oldukları VAADİN kanıtına işlendi. Örnek:
maskelemenin harf sınırı tanıması ayrı bir mekanizma değil, §6.1 anonimleştirme vaadinin kanıtının
güçlenmesidir. Ayrıca eski özetin yayımladığı "46 zorlanan / 20 borç" rakamı kendi tablolarıyla
tutmuyordu: o dosyada aslında 51 zorlanan ve 22 borç satırı vardı. Yeni sayı, aynı sayaçla ve
sayılarak üretildi.

Tek **SADECE-PROMPT** satırı faz kilididir (şapka disiplini). Şu an fazın modu yalnız prompt
metninde duruyor; bir koltuk yanlış modda konuşursa hiçbir yapı bunu durdurmaz. Bunun kodla
zorlanması, çıktıya mod alanı eklemek veya faz-rol eşleşmesini şemaya bağlamak demektir; M2
kapısında tartışılacak.

(Kanıt rozetinin URL kuralı M2-C'den M2-A'ya ÇEKİLDİ: ilk gerçek çağrıda bir iddia hak etmediği
rozeti aldı, borcu ertelemek yerine kapatmak gerekti.)
