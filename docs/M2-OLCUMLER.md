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
Tonu da doğru yerde: "Fikir ham. Mimari kararlar oturmamış." Yağcılık izi yok.

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

## Maliyet tahmini (kaba)

İki çağrının ortalaması yaklaşık $0.0033. Tam kurul 27 çağrı ise bir oturum kabaca **$0.09**
civarında görünüyor, ama bu sayı iyimser: geç fazlarda bağlam büyür ve koltukların fiyatları
farklıdır (Mimar Opus, Vizyoner Grok). Gerçek rakam ilk tam oturumda ölçülecek; o ölçüm bu
dosyaya eklenecek.
