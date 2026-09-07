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
