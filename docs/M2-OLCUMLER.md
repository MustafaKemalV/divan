# M2 canlı ölçümler

Bu dosya tahminleri değil, gerçek koşumların bıraktığı sayıları tutar. Her satırın tarihi ve
koşulduğu koltuk bellidir; bir sayı burada yoksa henüz ölçülmemiş demektir.

## İlk gerçek çağrılar (2026-09-02, M2-A)

Stub'lardan gerçek modellere geçişin ilk iki çağrısı. Amaç dört şeyi ölçmekti: Türkçe promptun
karşılığı, şema disiplini, OpenRouter'ın maliyet bildirimi ve gerçek fiyat.

| Koltuk | Model (cevabı veren) | Faz | Süre | Token | Maliyet |
|---|---|---|---|---|---|
| Baş Danışman | anthropic/claude-sonnet-5 (pin) | F0 brifing + triyaj | 11.5 sn | 1027 | $0.003926 |
| Denetçi | deepseek/deepseek-v4-pro (pin) | F4 denetim | 30.0 sn | 1505 | $0.002649 |

İkisi de pin modele gitti, fallback'e düşme olmadı.

## Bulgular

**Maliyet bildirimi geliyor.** OpenRouter `usage` nesnesinde `prompt_tokens`, `completion_tokens`,
`total_tokens` ve `cost` (USD) döndürüyor. `cost` için ayrıca bir istek parametresi göndermek
gerekmedi, iki farklı sağlayıcıda da geldi. Maliyet sayacı (M2-A2) bu alana dayanabilir.

**Türkçe prompt varsayımı tuttu.** Her iki şema-kritik koltuk da Türkçe sistem promptu altında
şemaya birebir uydu: fazladan alan yok, eksik alan yok, tür hatası yok. Çıktı dili Türkçe. Karma
yapıya (şema iskeleti İngilizce) geçmeye gerek kalmadı; varsayım şimdilik ayakta, ama tek koşumluk
kanıt kalıcı hüküm değildir, tam oturumda tekrar bakılacak.

**Denetim mekaniği gerçek modelde çalıştı.** Denetçi'nin çıktısı zorunlu premortemi somut bir
senaryoyla doldurdu, üç sınanmış iddia verdi ve üç iddianın üçünde de farklı kanıt etiketi kullandı
(`model-bilgisi`, `dogrulanmis`, `varsayim`). Canlı çıktı `validateAudit` denetiminden geçti.
Tonu da doğru yerde: "Fikir ham. Mimari kararlar oturmamış." Bu tek koşumda yağcılık izi görülmedi;
**n=1**, yani bir gözlem, bir bulgu değil. Yağcılık iddiası ancak kör karşılaştırmanın verisiyle (§8, M5)
kurulabilir; buradaki not sadece "ilk temasta ton doğru yerdeydi" demektir.

**§6.2 borcu ilk çağrıda kendini gösterdi.** Denetçi bir iddiaya `dogrulanmis` etiketi verdi ama
kaynak alanına URL değil gerekçe yazdı ("Node.js dokümantasyonu ve topluluk deneyimi"). Tasarım
URL'siz hiçbir iddianın doğrulanmış sayılamayacağını söylüyor, ama bu kural henüz kodda yok.
Yani mekanizma envanterindeki borç teorik değil: ilk gerçek çağrıda bir iddia hak etmediği rozeti
aldı. M2-C'de kapatılacak.

**Triyaj model beyanına bırakılamaz, doğrulandı.** Baş Danışman'a kısa ve basit bir fikir verildi
("Divan için küçük bir CLI aracı yazmak"); model `full` dedi. Stub'ın uzunluk kuralı `small` derdi.
Hangisinin doğru olduğu tartışılır, asıl mesele şu: sınıf, ölçülebilir bir gözlem değil bir kanaat
olarak geldi. DESIGN §5.1'in gözlem + kod sınıflandırması (M2-B) tam bunun için var.

**Süre, tasarımı etkileyecek bir sayı.** Tek çağrı 11 ile 30 saniye arasında. Tam kurul 27 çağrı
ve şu an fazlar içinde koltuklar SIRAYLA çalışıyor, yani bir oturum kabaca yedi ile on beş dakika
sürer. F2 fazı tanımı gereği "birbirini görmeden" üretim yapıyor, yani o çağrılar arasında
bağımlılık yok ve paralel koşabilirler; aynısı F3, F4 fizibilite ve F5 sıralama için de geçerli.
Paralelleştirme bir hız iyileştirmesi değil, kullanılabilirlik şartı olabilir. M2-A2'de tartışılacak.

## Prob önbelleği (2026-09-02, M2-A2)

Yedi koltuğun şema probu, aynı config ile üç kez koşuldu:

| Koşum | Süre | Gerçek çağrı | Önbellekten |
|---|---|---|---|
| İlk (önbellek boş) | 12.5 sn | 7 | 0 |
| İkinci (önbellek dolu) | **0 ms** | **0** | 7 |
| Elle tazeleme (`refresh`) | 5.9 sn | 7 | 0 |

Yedi koltuğun yedisi de pin modelinde geçti, düşen koltuk olmadı. Önbellek dosyasında anahtar
izi yok (kontrol edildi).

Bunun anlamı: prob artık oturum başına değil, config başına ve günde bir koşuyor. Yedi çağrılık
bir maliyet her oturumda tekrarlanmıyor.

### Prob maliyeti ve koltuk fiyat farkı

Prob maliyeti oturum sayacına **girmez** (hesap saflığı: prob grafın dışında ve farklı ritimde
koşar), ama kayıtsız da kalmaz: her önbellek kaydı kendi maliyetini ve zaman damgasını taşır,
koltuk kontrolü ekranında toplanır.

Aynı küçük prob, yedi koltukta:

| Koltuk | Model | Prob maliyeti |
|---|---|---|
| Vizyoner | x-ai/grok-4.6 | $0.002208 |
| Mimar | anthropic/claude-opus-4.8 | $0.001915 |
| Baş Danışman | anthropic/claude-sonnet-5 | $0.000848 |
| Müh-1 | openai/gpt-5.1 | $0.000369 |
| Pazar Sesi | google/gemini-3.7-flash | $0.000348 |
| Denetçi | deepseek/deepseek-v4-pro | $0.000273 |
| Müh-2 | qwen/qwen3-max | $0.000102 |
| **Toplam** | | **$0.006063** |

**Kalibrasyon uyarısı:** buradaki 21 kat, bu prob iş yükünün oranıdır, evrensel bir sabit
DEĞİLDİR. Prob küçük ve tek biçimli bir çağrıdır; gerçek fazlarda girdi bağlamı, çıktı uzunluğu ve
akıl yürütme token'ları koltuktan koltuğa başka türlü dağılır. Oranı gerçek haliyle ancak ilk tam
oturum verecek. Bu sayı bir yön göstergesidir, bir katsayı değil.

Bu tablo yine de bir öngörüyü düzeltiyor: **koltuklar arası fiyat farkı bu ölçümde yirmi bir kata
çıktı** (Vizyoner ile Müh-2 arasında). Yani "çağrı başına ortalama × 27" biçimindeki projeksiyon yanıltıcıdır; gerçek
maliyeti belirleyen şey çağrı sayısı değil, hangi koltuğun kaç kez ve ne kadar bağlamla konuştuğu.
Pahalı koltuklar (Vizyoner, Mimar) üretim ve değerlendirme fazlarında çok konuşuyor, ucuz koltuklar
(Müh-2) az. Tam oturum ölçümü bu yüzden tahminden ayrışabilir.

## Maliyet: ölçülen ve öngörülen

Ölçülen (kesin, sağlayıcının bildirdiği rakamlar):

| | USD |
|---|---|
| Baş Danışman, F0 brifing | 0.003926 |
| Denetçi, F4 denetim | 0.002648802 |
| **İki çağrı toplamı** | **0.006574802** |
| Çağrı başına ortalama | 0.003287401 |

Tam kurul projeksiyonu, 27 çağrı × ölçülen ortalama = **$0.0888**. Bu sayı bir ALT SINIR tahminidir
ve iki yönden sapar: geç fazlarda taşınan bağlam büyüdüğü için girdi token'ı artar, ve kadronun
fiyatları eşit değildir (Mimar Opus sınıfı, Denetçi ve Pazar Sesi daha ucuz). Yani gerçek rakamın
bu tahminin üstünde çıkmasını bekliyoruz. Kesin sayı ilk tam oturumda ölçülüp buraya yazılacak;
o ölçüm gelene kadar $0.0888 bir tahmindir, bir vaat değildir.
