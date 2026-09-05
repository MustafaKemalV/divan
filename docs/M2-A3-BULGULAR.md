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
