# M2-A3 bulguları (Fable masası, 2026-09-04)

Satır satır kod incelemesi. Her bulgu koşularak doğrulandı ve her biri bir kırmızı testin tohumudur.
İnceleme anındaki durum: `tsc` temiz, 10 birim testi geçiyor, e2e 21/21.

## B1. F5 taslağı kör

`bd_draft` düğümü Baş Danışman'a yalnız `state.idea` veriyor. Sıralamalar, F4 özeti, muhalefet notu
ve düşen itirazlar gitmiyor. `f5_output` (Denetçi'nin final denetimi) hiçbir bağlam almıyor.

**Yeniden üretim:** casus runner ile `F5:draft` çağrısının `input.context` uzunluğu 0.

## B2. Çerçeve F2'ye ulaşmıyor

`f2_ideation` bağlamı yalnız `state.approvedFrame`, yani Şah'ın KAPI 2'ye yazdığı metin.
`selectedHmw` ve `frameObjection` F2'ye ve sonrasına hiç gitmiyor.

**Yeniden üretim:** KAPI 2'ye "cerceve" yazıldığında F2 ideatörlerinin gördüğü bütün bağlam
"cerceve" kelimesinden ibaret.

## B3. Maskeleme sözcük içini bozuyor

`anonymizeSummary` harf sınırı tanımıyor.

**Yeniden üretim:** "Mimari kararlar oturmamis; marketing plani yok" girdisi
"bir koltuki kararlar oturmamis; bir koltuking plani yok" çıktısına dönüşüyor.

## B4. Hüküm yeniden koşumu özet zincirini bozuyor

`[TEST:nojudgment]` ile dört ayrı kırılma:
- F4 özeti iki kez üretiliyor (fazladan bir BD çağrısı),
- `summaryOf` ilk eşleşeni aldığı için F5 BAYAT özeti okuyor,
- `"F4:"` öneki `"F4:summary"` ile de eşleştiğinden ikinci özet çağrısında BD kendi özetini ham
  bağlam olarak alıyor ve `speakingSeats` onu "konuşan koltuk" sayıp kotaya sokuyor,
- `judgmentHistory`'ye boş tur giriyor ve düşen itiraz izindeki `[tur N]` numarası kayıyor.

## B5. Kesilen çağrı çift sayılıyor

`TruncatedResponseError` harcanan parayı taşıyınca maliyet toplamına giriyor (doğru), ama
`runPhase` aynı denemeyi `costUnknownCalls`'a da ekliyor.

**Yeniden üretim:** market koltuğu F2'de kesilir; maliyet toplama girer ve `costUnknownCalls` 1 olur.

## B6. F3 ve F5 promptlarında kimlik yok

Dört `*-F3-cross.md` dosyası başlık satırı hariç bayt bayt aynı; `market`, `engineer1` ve
`architect` için `*-F5-ranking.md` dosyaları da aynı. Sistem promptu tek kimlik taşıyıcısı olduğu
için model bu iki fazda hangi koltuk olduğunu bilmiyor.

## B7. Sunucu tüm arayüzlere bağlanıyor

`oturum.mjs` ve `e2e.mjs`, `next dev`i host vermeden başlatıyor. `lsof` çıktısı `*:port`. Aynı
ağdaki herkes `/api/council` ile Şah'ın anahtarını harcayabilir ve GET ile transkript okuyabilir.
Kimlik doğrulama yok.

## B8. Birim testler hiçbir komuta bağlı değil

`package.json`'da `test` betiği yok; commit kapısı yalnız e2e koşuyor, `tsc` zincirde değil.

## Okuma bulguları (koşulmadı, Blok 3 borcu)

Zaman aşımı isteği iptal etmiyor (`AbortSignal` hiç geçilmiyor) ve yalnız paralel fazlarda var;
tek koltuklu düğümlerde yeniden deneme yok ve düğüm çökünce `--devam` oturumu "tamamlanmış"
sanıyor; kapı sözleşmeleri tutarsız (DENETIM_EKSIK "iptal" dışındaki her şeyi devam sayıyor,
HUKUM_EKSIK "retry" dışındakini iptal sayıyor ve kabul ettiğini ilan etmiyor, ERKEN_BRIFING yanıtı
yok sayıyor); maliyet tamponu graf-global (eş zamanlı iki oturumda karışır); iade, yeniden deneme
ve özet çağrıları tavana sayılmıyor; ek belge boyut sınırı ve maliyet ölçümü yok; F5 sıralamanın
ortak seçenek ve kriter listesi yok (Kendall tau hesaplanamaz); altyapı kesilmesi transkripte
"KOLTUK SUSTU" diye yazılıyor.

---

# İkinci tur (Fable masası, 2026-09-06)

Blok 1 kapandıktan sonraki inceleme. Yukarıdaki B-serisi kapatılan bulgulardı; bu tur, kapatılan
işin KENDİSİNİ denetledi. Bulgular iki sınıfa ayrıldı: `F-` düzeltme gerektiren arızalar,
`K-` kapanış turunda temizlenecek kalemler.

## F-1. Ağ sınırı kullanıcının koştuğu komutta yok (kapandı, `ddc4ece`)

D-6 yarım kalmıştı: sunucuyu `127.0.0.1`'e bağlayan düzeltme yalnız test ve oturum sürücüsüne
uygulanmıştı, README'nin kullanıcıya verdiği `npm run dev` hâlâ bütün arayüzlere bağlanıyordu.
Güvenlik sınırını kullanıcının kullanmadığı yola koymak, sınır koymamaktır.

**Ölçüm:** `lsof` kırmızıda `node -> *:3000`, yeşilde `node -> 127.0.0.1:3000`. `start` komutu da
aynı şekilde bağlandı.

## F-2. Kestirim böleni arızalı oturumda fazı ucuz gösteriyor (kapandı, `5dd96e7`)

U-7'nin yan etkisi: her deneme (başarısız olan dahil) tampona girdiği için `seatCalls` büyüdü ve
`estimatePhaseCost` bilinen maliyeti daha büyük bir bölene bölmeye başladı. Bütçe kapısı tam da
arızalı oturumlarda fazı olduğundan ucuz gösteriyordu.

**Ölçüm:** iki başarılı çağrı (ortalama 1.000.000 nano) bir zaman aşımı eklenince 666.667'ye
düşüyordu, yani %33 ucuz. Düzeltme: ayrı sayaç `seatCostCalls`, yalnız `usage.cost` tanımlıyken
artar. `callLog` ve `seatCalls` bütün denemeleri tutmaya devam eder, denetim izi eksilmez.

## F-3. Sıralama kimliksizliği yalnız ön ekte (kapandı, `6a018a0`)

F5 sıralamaları "SIRALAMALAR (kimliksiz)" başlığıyla veriliyordu ama kimliksizleştirme yalnız
`market: ` ön ekini kesiyordu; sıralamanın METNİ içinde geçen koltuk adı olduğu gibi Baş
Danışman'a ve final denetime gidiyordu. Başlık verdiği sözü tutmuyordu, bu yüzden sızıntı sadece
bir eksik değil, yanıltıcı bir eksikti.

**Ölçüm:** kırmızıda her iki düğümde de sızıntı `market, engineer1, architect, auditor`; yeşilde
yok. Maskeleyici `anonymizeSummary`'den çıkıp `maskSeatNames` olarak dışa açıldı: kimliksizlik
özetin değil, ajanlar arasında taşınan HER metnin kuralıdır (§6.1).

## K-1. Persona çiftlenmesi (kapandı, `0481bd0`)

Kimlik katmanı (D-1) gelince faz talimatlarındaki persona paragrafları borç oldu: aynı cümle her
çağrıda iki kez gidiyordu. Token israfından önce bakım tuzağı: kimliği değiştiren kişi faz
dosyasındaki kopyayı unutur ve koltuk iki farklı şey söylemeye başlar.

**Ölçüm:** aynı ölçerle, kırmızıda 40 çiftlenme (26 birebir cümle + 14 altı kelime ve üzeri ortak
dizi), yeşilde 0. Muhafız `persona.test.ts`. Kapanış turunda üç düzeltme aldı: negatif kontrol
boştu (iki örnek de eşiğin altındaydı, bozuk bir ölçer de 0 döndürürdü), eşik yorumu yanlış
gerekçe taşıyordu (ölçülen gerçek: n=5'te 0 bulgu, n=4'te tek yanlış pozitif "birinci mühendisin
ve mimarın"), ve hüküm turu promptuna faza özgü sonuç cümlesi geri kondu.

## K-2. Kullanıcı mesajının kuruluşu doğrulanamıyordu (kapandı, `44d8204`)

Zarfın İÇERİĞİ `context.test.ts`'te denetleniyordu, MODELE BASIMI hiçbir yerde. İkisi ayrı
iddiadır: içeriği doğru bir zarf mesajın sonuna basılırsa tasarım yine bozulur.

**Ölçüm:** `buildUserMessage` `openrouterRunner` içindeyken bir birim testi onu import edemiyordu,
zincir `gateway` üzerinden `server-only` mührüne çarpıyordu (`Error: This module cannot be
imported from a Client Component module`). Saf `userMessage.ts`'e taşındı; test sırayı bekliyor:
zarf İLK blok, sonra FİKİR, sonra ek metin ya da özeti, sonra dinamik bağlam.

## K-3. Doküman tutarlılığı (kapandı, bu commit)

PLAN.md review protokolünün ilk satırı ve CLAUDE.md hatırlatma maddesi hâlâ oturum içi `/model`
geçişini anlatıyordu, oysa masalar ayrılalı çok oldu. CLAUDE.md'ye çalışma anayasası yazıldı
(Fable karar verir ve ayrı oturumdur, Opus uygular, mesajları Şah taşır, her tur ilgili bulgular
dosyasına işlenir) ve DESIGN'da §5.2, §5.1'in ardına alındı.

## K-4. Envanter kuralı (Şah onaylı)

Envanter satırı = DESIGN'da yazılı bir vaat. Bir düzeltme yeni satır AÇMAZ, var olan satırın
kanıtını günceller; köken sütunu "M2-A3: kanıt güncellendi" der. Süreç güvenceleri (kaynağı
CLAUDE.md olanlar, örneğin test zinciri) tablonun dışında ayrı bir başlıkta durur ve vaat sayısına
girmez.

## Bugünkü karar: U-14 öne çekildi (2026-09-07)

**U-14 Blok 3'ten capstone ÖNCESİNE alındı.** Gerekçe: çöken bir oturumun ödenmiş çağrıları
kurtarılamıyor. Düğüm çöktüğünde route bir `error` olayı gönderip akışı kapatıyor, sürücü ise
`--devam`'da bekleyen kapı bulamadığı için oturumu bitmiş sayıyor. Route tarafı hazır:
`reTableToNode` checkpoint geçmişinden o düğümün öncesini bulup oradan sürüyor; eksik olan yalnız
sürücünün bunu kullanması.

U-9'un dar hali (tek koltuklu çağrılara zaman aşımı + yeniden deneme) **yapılmayacak**, Blok 3'te
kalıyor: U-14 çökmeyi kurtarılabilir yaptığı için para koşumundan hemen önce on çağrı yerine
dokunmak fazladan risktir, üstelik kesilme zaten yeniden denenmez.

---

# Tur 3 (Fable masası, 2026-09-07)

Kapanış turunun (K-1..K-4, U-14) ardından, capstone'dan ÖNCE yapılan satır satır okuma. Şah bütün
maddeleri onayladı; sıra bağlayıcıdır ve her madde önce kırmızı ölçüm, sonra düzeltme, sonra
commit olarak işlenir. Bu bölüm koddan ÖNCE yazıldı: anayasa gereği transkriptte kalan bulgu,
kaybolan bulgudur.

## T3-1. Şema fazlarında transkript sadık değil, denetim içeriği state'te yok

`openrouterRunner` şema fazlarında `content = data.summary` yapıyor. Denetimin premortem'i,
etiketli iddiaları, kaynak URL'leri ve en zayıf halkası doğrulanıp ATILIYOR: `runAuditWithReturn`
içindeki `outs` dizisi hiç okunmuyor ve grafta da state'te de "claims" geçmiyor. Hüküm turunun
kriter tablosu da yalnız `state.judgment`'ta duruyor, transkripte girmiyor.

Sonuç: Denetçi'nin ürettiği kanıt defteri hiçbir sonraki çağrının önüne gelmiyor ve karar
belgesine taşınacak ham malzeme kaydedilmiyor.

## T3-2. Savunma turu denetimi ve hükmü görmüyor

`f4_revision` bağlamı `rawOfPhase("F4:audit")`, yani yalnız denetim kayıtları. İkinci ve üçüncü
turda savunucular hangi maddenin "karşılanmadı" kaldığını görmüyor. Üstelik iade edilmiş
`[GEÇERSİZ]` ilk deneme de bağlama giriyor: reddedilen bir çıktı savunmaya malzeme oluyor.

## T3-3. Kapı sözleşmesi yalnız bütçe kapısında var (D-5'in bugünkü payı)

`HUKUM_EKSIK` "retry" dışındaki her yanıtta sebepsiz bitiyor (endReason yok, `done` olayı normal
görünüyor). `DENETIM_EKSIK` "iptal" dışındaki her şeyi devam sayıyor. `ERKEN_BRIFING` yanıtı hiç
okumuyor. İki kapının payload'ında `kabulEdilen` yok ve sürücü ham JSON basıyor. Yazım hatası bir
onay yerine geçemez kuralı bu üç kapıda geçerli değil.

## T3-4. İade çağrıları kesilme korumasında değil

Denetimin ikinci (iade) çağrısı ve özetin ikinci çağrısı `try` dışında; kesilme düğümü çökertir.
İlk çağrı için zaten var olan ALTYAPI ARIZASI dalı ikisine de uygulanmalı.

## T3-5. F5 girdisinde F3 özeti yok

Sıralama ve taslak yalnız F4 özetini görüyor; seçeneklerin doğduğu F3 özeti gitmiyor. Seçenek
defteri (D-3) Blok 3'te geleceği için bu, o güne kadarki köprü.

## T3-6. Metin tavanı ölçüme göre düşük

`limits.textMaxTokens` 1600. 3 Eylül oturumunda bütün metin çıktıları tam bitti (n=1) ama Müh-1'in
F4 çıktısı 3.9k karakterle tavana yakındı ve akıl yürütme tokenı da tavana sayılıyor.
Kullanılmayan tavan para etmez; kesilen çağrı hem parayı hem cevabı kaybettirir.

## T3-7. KAPI 1 notu dürüst değil

`councilModeNote` "Değiştirebilirsiniz" diyor ama kapı yalnız HMW yanıtını okuyor. Kadro kapısı
M2-B'de; not bugünkü gerçeği söylemeli.

## T3-8. Zarf tekrarı

`f1_frame` bağlamı `selectedHmw`, `f2_ideation` bağlamı `approvedFrame`, `f2s_ideation` bağlamı
`selectedHmw` taşıyor. Üçü de oturum zarfında zaten var, yani aynı metin bir çağrıda iki kez
gidiyor.

## T3-9. Ek belge maliyeti kestirimde yok

Hazırlık bandı ekler olmadan kuruldu. Ekler iliştirilirse tam metin F0 brifingine, üç fizibilite
ve bir iki denetim çağrısına gider; band değişir.

## T3-10. Hijyen

`.idea/` git'te (JAVA_MODULE ilan eden IntelliJ dosyaları), `envelope.test.ts` başlığındaki dosya
adı ve `GATEWAY_TEST_OK` etiketi yanlış, `summary.test.ts`'te iki tane "7)" maddesi, `oturum.mjs`'te
ölü `|| []`, e2e'de etkisiz bir `DIVAN_CHECKPOINT_DB` ataması (checkpointer singleton).

## Blok 3 borçları (bu turda kod yazılmayacak, kayıt için)

- `graph.ts` içindeki saf mantık modüle çıkarılmalı: bütçe yanıtı ayrıştırma, düşen itiraz izi,
  kimliksiz sıralama, özet iadesi ve yedi kopya bütçe iptal bloğu.
- Graf önbelleği runner'ı ilk istekte donduruyor; config özetiyle anahtarlanmalı.
- Rota config hatasını yutuyor ve gövde doğrulaması yok.
- Konumsal anonimlik: oturuma bağlı deterministik karıştırma (M2-C).
- Altyapı arızası kaydı özet kotasına giriyor (U-15).
- Geç gelen zaman aşımı cevabı sonraki düğümün tamponuna düşüyor (U-9).
- Final denetim sonuçsuz ve KAPI 3 payload'ında taslak yok (M3/M4).
- `package.json` `"type": "module"` (Next ile doğrulanarak) ve eslint config.
- F4 fizibilite de hafif şemaya bağlanmalı (iddia + etiket); "bitti tanımı çıktı üretir" ilkesi,
  M2-C adayı.
- `.env.local` anahtar rotate'i 31 Ağustos'tan beri açık.

---

# Capstone bulguları (2026-09-07 ve 2026-09-09 koşumlarından)

İlk tam gerçek oturum ve aynı-aile deneyi, stub'ların gösteremeyeceği şeyleri gösterdi. Her bulgu
ham olay günlüğünden ölçüldü; sayılar `docs/M2-OLCUMLER.md`'de, ölçüm aracı
`eval/karsilastir.mjs`.

## C-1. Başarısız ama faturalanan deneme metriklerde yok

7 Eylül F5'inde Denetçi'nin bir çağrısı zaman aşımına uğradı, terk edilen istek arka planda koştu
ve kesilerek döndü; $0.015950 faturaya girdi. Buna rağmen oturum künyesi koşumu tertemiz
gösteriyor: susan koltuk yok, `costUnknownCalls` 0, altyapı arızası kaydı yok.

Yani bir oturum para yakarken künyesinde bunun izi kalmıyor. Metriklere "başarısız deneme sayısı"
girmeli; aksi halde "27 çağrıya $0.70 harcandı" cümlesi 28. çağrıyı gizler.

## C-2. Anthropic önbelleği sıfır okudu, `cache_control` gerekiyor

D-1 sabit katmanları başa koyarken gerekçesi "sağlayıcı önbelleği işleyebilsin" idi ve etkisinin
ÖLÇÜLECEĞİ yazılmıştı. Ölçüldü: 7 Eylül'de `cachedTokens` toplamı 10.676 ve neredeyse tamamı
DeepSeek'in tek denetim çağrısından (10.548); Anthropic koltuklarının hepsinde 0. Tek aileli 9
Eylül koşumunda toplam 0.

Anthropic'te önbellek kendiliğinden çalışmıyor, istek gövdesinde `cache_control` işareti
istiyor. Sıra doğru kurulmuş ama kazanç alınmıyor.

## C-3. Geç dönen deneme "deneme 1" olarak kaydediliyor

Aynı olayda iki çağrı da `attempt: 1` yazıyor. Deneme numarası çağrı BAŞLARKEN tampondan
sayılıyor; zaman aşımına uğrayan ilk deneme henüz tampona girmemiş olduğu için yeniden deneme de
kendini birinci sanıyor. Kayıt, aynı koltuğun aynı fazdaki iki ayrı denemesini ayırt edemiyor.

## C-4. F5:output çıktısı prompt'u yankılıyor

Final topraklama denetiminin çıktısı, kendisine verilen talimatın başlıklarını ve sorularını
tekrar ediyor. Denetim yapıyor ama biçimi bir kontrol listesinin doldurulmuş hali gibi; §9.1'in
kanıt defterine dönüştürülebilir bir yapı üretmiyor. M3 belge üretimi bu çıktının üstüne kurulacak,
o yüzden biçimi orada şemaya bağlanmalı.

## C-5. Kanıt kapısı web olmadan sınanamıyor

7 Eylül'de denetim 3 iddia getirdi, üçü de `model-bilgisi`, hiçbirinde URL yok: rozet kuralı hiç
devreye girmedi. 9 Eylül'de 4 iddiadan biri `dogrulanmis` etiketiyle ve URL'li geldi; kod URL'nin
BİÇİMİNİ doğrulayıp geçirdi, ama URL'nin var olup olmadığı ya da iddiayı destekleyip
desteklemediği kontrol edilmedi, çünkü web araması kodda yok.

Yani bugünkü haliyle rozet, kaynak GÖSTERME disiplinini zorluyor, kaynağın doğruluğunu değil ve bu
sınır artık teorik değil: gerçek bir koşumda doğrulanmamış bir URL "doğrulanmış" rozetiyle geçti.
M2-C'nin M2-B'den öne alınmasının gerekçesi budur.

## C-6. Sürücü çöken oturumda 0 ile çıkıyor

9 Eylül'de taslak çağrısı düğümü çökertti; rota bir `error` olayı gönderdi, sürücü onu bastı ve
oturumu bitirip **çıkış kodu 0** ile döndü. U-14 çöken oturumu KURTARILABİLİR yaptı ama çıkış kodu
hâlâ "her şey yolunda" diyor. Otomasyon (deney kolları, M5 kör değerlendirmesi) çıkış koduna
bakar; çöken bir koşumu başarılı sayar.

## C-7. Terk edilen dalın maliyeti state'te yok

Re-table checkpoint'i geri sardığı için `state.callCount` 30, `state.costNanoUsd` $1.250261
gösteriyor; oysa olay günlüğünde 34 çağrı ve $1.387532 var. Aradaki $0.137271 gerçekten harcandı.
Şah'ın gördüğü künye, kurtarma yapılan bir oturumda harcamayı OLDUĞUNDAN AZ gösteriyor.

## C-8. Tek koltuklu düğüm çökünce fatura hiç kaydedilmiyor

Çöken taslak çağrısı olay günlüğünde de yok. `run` başarısız denemeyi tampona yazıyor ama tamponu
state'e boşaltan `flushUsage` düğüm normal dönerken koşuyor; düğüm çökerse tampon kayboluyor.
Sağlayıcı o çağrıyı üretti ve faturaladı, bizde kaydı yok. U-9'un parçası.

## C-9. Metin tavanı 2.500 yetmiyor

Aynı koşumda iki ayrı çağrı 2.500 çıktı token tavanına çarptı (F5 sıralaması ve karar taslağı).
Tavan 6.000'e çıkarıldıktan sonra Denetçi'nin sıralaması 2.993 token üretti, yani gerçekten
2.500'ün üstünde bir cevap gerekiyormuş. Akıl yürütme tokenı da aynı tavana sayıldığı için geç
fazların (sıralama, taslak) payı daha da dar.

## C-10. Aynı model iki koltukta oturmamalı (kadro kuralı adayı, DESIGN §4)

9 Eylül F5'inde Müh-1 ve Denetçi aynı modeli (claude-sonnet-5) kullanıyordu ve ikili benzerlikleri
0.86 çıktı; aynı fazdaki en düşük ikili 0.10, 7 Eylül'ün en yüksek ikilisi 0.51. Bir koltuk
diğerinin görüşünü görmese bile, aynı model aynı girdiye çok benzer cevap veriyor.

§3'ün çeşitlilik kazancı "farklı aile" diye yazılmıştı; bu ölçüm daha keskin bir kural öneriyor:
**aynı model iki koltuğa atanamaz.** Aile kısıtı korunur, üstüne model tekliği eklenir. DESIGN §4
değişikliği olduğu için Şah onayıyla ayrıca işlenecek.

---

# Tur 4 (Fable masası, 2026-09-11): M2-C öncesi

Capstone bulguları (C-serisi) okunduktan sonra verilen kararlar ve bu turda yapılacak işler.
Amaç M2-C'ye girmeden önce ölçüm aletini ve koşum sağlamlığını düzeltmek: M2-C gerçek arama
ekleyeceği için koşum başına maliyet artacak, ve bozuk bir sayaçla pahalı bir deney koşulmaz.

## Dört karar

1. **Ana config metin tavanı 2.500'den 6.000'e çıkar.** Deney kolunda çıkarılmıştı, ana config
   açık kalmıştı. Gerekçe C-9 ve ikinci bir ölçüm (aşağıda T4-1).
2. **C-10 kadro kuralı DESIGN §4'e girer ve KODLA zorlanır.** Aynı model iki koltukta oturamaz.
   Bir deney kolu bunu bilerek yapacaksa config'de açık istisna beyan eder; beyan oturum kaydına
   ve künyeye damgalanır. Ölçümün doğurduğu ilk kadro kuralı budur.
3. **M2-C'nin tasarım cümleleri onaylandı** (DESIGN §6.2, §7 D-1, §6.1). Kod bu turda yazılmaz;
   tasarım önce yazılır, sapma sonra değil önce kayda geçer.
4. **M2-C kodundan ÖNCE bir prob koşulur** (1-2 sent, gerçek çağrı): web eklentisi + json_schema
   aynı istekte çalışıyor mu, arama ücreti `cost`'a yansıyor mu, şema bozuluyor mu. Olumsuzsa
   M2-C'ye girilmez, Fable masasına dönülür. Pahalı bir mekanizma, ucuz bir ölçümle sınanmadan
   kurulmaz.

## T4-1. Metin tavanı: ikinci ölçüm

C-9 tek bir kesilmeye dayanıyordu. İki koşumun çağrı kayıtları birlikte okununca, tavanın dar
olduğu iki ayrı model ailesinde birden görünüyor ve sebebi de görünüyor: tavan İÇERİĞİ değil
AKIL YÜRÜTMEYİ kesiyor.

- 7 Eylül, Denetçi (deepseek-v4-pro), F5 sıralama: çıktı 2.500 token, bunun **2.494'ü düşünme**.
  Yani kesilen çağrıda içerik neredeyse hiç üretilmemiş; para düşünmeye gitmiş, cevap gelmemiş.
- 9 Eylül, Denetçi (sonnet-5), F5 sıralama: **2.500/2.500 düşünme**, içerik sıfır, kesildi.
- 9 Eylül, Baş Danışman (sonnet-5), F5 taslak: 4.168 çıktı, 3.197'si düşünme. Tavan 6.000
  olmasaydı bu çağrı da kesilirdi.

İkisi de 2.500'ün üstünde ve ikisi de geç faz. Düşük tavan parayı kurtarmıyor, karşılığını
kaybettiriyor (aynı ders kesilme ölçümünde de çıkmıştı).

## T4-2. C-10 kadro kuralı: koda

DESIGN §4'e kural cümlesi, ardından config yüklemede zorlama. Aynı `model` iki koltukta geçiyorsa
anlaşılır hata; config'de boş olmayan `kadroIstisnasi` metni varsa yükleme geçer ve beyan
görünür kalır (sürücü açılışta basar, `done` olayı ve md künyesi taşır). Fallback listeleri
kurala girmez: kural hangi modelin KONUŞTUĞU hakkındadır, hangisinin yedekte beklediği hakkında
değil.

## T4-3. U-9'un iptal kısmı

Zaman aşımı bugün yalnız beklemeyi bırakıyor, isteği İPTAL ETMİYOR: `client.ts` bir `signal`
alıyor ama hiçbir yerden geçirilmiyor. 7 Eylül'de terk edilen istek arka planda koşup faturalandı
ve geç cevabı bir sonraki tampona düştü; deneme numarası da bu yüzden tekrar etti (C-3).

Bu turda: `AbortSignal` ile gerçek iptal, iptal edilen isteğin geç cevabının tampona düşmemesi,
deneme numarasının aynı koltuk+faz için 1, 2 diye doğru sayılması. Ayrıca tek koltuklu düğümlere
(F0 iki çağrı, F1, taslak, final denetim) zaman aşımı + tek yeniden deneme + kesilme koruması;
C-8 (çöken düğümde fatura kaybı) böyle kapanır. Graf-global tamponun kalkması U-9'un kalan
kısmıdır ve bu turda değildir.

## T4-4. C-1 metriği

State'e `failedAttempts` ve `failedCostNanoUsd`. KAPI 3 payload'ı, `done` metrikleri ve sürücü
bunu basar. Bugün para yakan bir koşum künyesinde tertemiz görünüyor.

## T4-5. C-7 künyesi

Sürücü re-table yaptığında JSONL'e zaten `{type:"re-table"}` yazıyor. Md künyesine "kayıtlı
maliyet" satırının yanına "terk edilen dal (olay günlüğünden)" satırı eklenir; hesap
`eval/karsilastir.mjs` ile aynı yöntemi kullanır, yani iki yerde iki farklı sayı çıkmaz.

## T4-6. M2-C tasarım cümleleri (onaylandı, kod yok)

DESIGN §6.2'ye kanıt kapısının arama şartı, §7 D-1'e `cache_control` işaretlemesi, §6.1'e konumsal
anonimlik (deterministik karıştırma). Üçü de M2-C'nin kapsamı; bu turda yalnız tasarım metni.

## T4-7. Prob: web eklentisi + şema aynı istekte

Denetçi koltuğuna (deepseek) `engine: exa`, `max_results: 5` ile web eklentisi ve `json_schema`
aynı istekte gönderilir. Ölçülecekler: `annotations` (url_citation) dönüyor mu, arama ücreti
`cost`'a yansıyor mu, şema bozuluyor mu. Aynı prob bir Anthropic koltuğunda `native` engine ile
tekrarlanır. Sonuç `docs/M2-OLCUMLER.md`'ye yazılır.

**Bu prob M2-C kodundan ÖNCEDİR ve olumsuz çıkarsa durulur.** Kanıt kapısının arama şartı, aramanın
şemayla aynı istekte çalışmasına bağlı; çalışmıyorsa mekanizmanın tasarımı değişir, kodu değil.
