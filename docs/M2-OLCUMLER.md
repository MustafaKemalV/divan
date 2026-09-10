# M2 canlı ölçümler

> **Bu koşumlarda EKSİK olan mekanizmalar.** Buradaki sayılar M2-A aşamasında alındı ve o
> aşamada şunlar henüz yok: **anonimleştirme** (ajanlar F3/F5'te birbirinin kim olduğunu görüyor),
> **web doğrulaması** (kaynak gösterme zorunlu ama gösterilen kaynağın içeriği kontrol edilmiyor),
> ve **belge üretimi** (çıktı ham transkript, §9 şablonuna basılmış karar belgesi değil). Yani
> aşağıdaki n=1 gözlemler "Divan böyle çalışıyor" değil, "Divan'ın bu aşaması böyle çalışıyor"
> diye okunmalı. Tam mekanizma seti M2-C ve M3 sonunda kurulur; ölçümler o zaman tekrarlanacak.

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

### İlk tam oturum denemesi: iptal, ve iki hata (2026-09-03)

Fikir gerçekti (Şah'ın üç Spring Boot kütüphanesini nasıl konumlandıracağı). Oturum F4 denetiminde
Şah tarafından iptal edildi. Kayda geçen rakamlar:

| | |
|---|---|
| Çağrı | 18 |
| Token | 46.106 |
| Maliyet | **$0.208651** |
| Süre | 713 sn (11.9 dk) |
| Bitiş | Şah iptali (denetim boş döndü) |

Koltuk dağılımı: Mimar (opus-4.8) $0.066 / %36, Baş Danışman (sonnet-5) $0.050 / %28, Vizyoner
(grok-4.6) $0.030 / %16, Müh-1 (gpt-5.1) $0.025 / %14, kalan üç koltuk toplam $0.011 / %6.
**İki Anthropic koltuğu faturanın %64'ü.**

> **DÜZELTME (bu tablo eksiktir, kayıt silinmedi).** Yukarıdaki koltuk dağılımında Denetçi'nin F4
> denetim çağrıları YOK. Sebebi bir hataydı: denetim yardımcısı maliyet izleyicisini baypas edip
> modeli doğrudan çağırıyordu, dolayısıyla o çağrılar koltuk bazlı kayda hiç girmedi. Toplam fatura
> doğru ($0.208651), yalnızca dağılım eksik. Hata düzeltildi (tek kapı kuralı, aşağıda) ama bu
> ölçüm o düzeltmeden ÖNCE alındığı için burada eksik haliyle duruyor.

**Bulunan iki hata.** Birincisi: Denetçi'nin çağrısı token tavanına çarpıp boş dönüyordu. İkincisi
ve daha ciddisi: kodumuz bunu "şemaya uymadı" diye rapor ediyordu, oysa sağlayıcı `finish_reason`
alanıyla kesildiğini açıkça söylüyordu ve o alan hiç okunmuyordu.

### Kesilme teşhisi: ölçümler (2026-09-03)

Denetçi koltuğuna aynı gerçek bağlamla dokuz kontrollü çağrı yapıldı, toplam **$0.074**:

| Tavan | Düşünme kontrolü | Bitiş | Düşünme tokenı | İçerik | Maliyet |
|---|---|---|---|---|---|
| 256 | yok | length | 256 (hepsi) | **boş** | $0.0019 |
| 512 | yok | length | 512 (hepsi) | **boş** | $0.0060 |
| 2048 | yok | length | 2048 (hepsi) | **boş** | $0.0080 |
| 2048 | "düşük" | length | 1725 | yarım JSON | $0.0054 |
| 4096 | "düşük" | length | 3142 | yarım JSON | $0.0090 |
| **8192** | yok | **stop** | 2938 | **geçerli, şemadan geçti** | $0.0088 |

Üç sonuç. Birincisi: akıl yürüten modeller cevaptan önce düşünme tokenı harcıyor ve şema gerektiren
çağrılarda 2048'lik tavan tamamen düşünmeye gidiyordu. İkincisi: düşünme miktarını "düşük"e çekmek
**işe yaramadı**, model yine binlerce token düşündü; bu yüzden o yol seçilmedi ve deneysel parametre
geri alındı. Üçüncüsü ve en önemlisi: **düşük tavan parayı kurtarmıyor.** Kesilen çağrı da
faturalanıyor ($0.0080) ve karşılığında hiçbir şey vermiyor; başarılı çağrı neredeyse aynı parayı
($0.0088) alıp işi bitiriyor. Tavan artık ayar dosyasında: `limits.schemaMaxTokens = 8192`.

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

## Faz içi paralellik (2026-09-03, M2-A2)

Aynı fazda birbirini görmeyen koltuklar artık paralel koşuyor (üretim, çapraz tozlaşma,
fizibilite, savunma, sıralama turları). Hız kazancı **henüz ölçülmedi**: sahte koşumda çağrılar
zaten anlık döndüğü için ölçüm anlamsız olurdu. Gerçek kazanç ilk tam oturumda ölçülecek.

Beklenti, ölçülen tek çağrı sürelerinden: en yavaş koltuk 30 saniye sürüyordu ve dört koltuklu
bir faz sırayla koşarken yaklaşık bu sürelerin toplamı kadar, paralel koşarken yaklaşık en
yavaşı kadar sürer. Bu bir beklentidir, ölçüm değil.

Paralelliğin ön koşulu olarak çağrı zaman aşımı eklendi: `timeouts.perCallMs = 120000`, yani
ölçülen en yavaş çağrının dört katı. Gerekçe: sıralı koşumda asılı bir üye yalnız yavaşlatır,
paralel koşumda bütün oturumu asar.

## Sağlayıcı kararı (kapandı, 2026-09-04)

OpenRouter'da kalınıyor. Kredi komisyonu bu ölçekte ihmal edilebilir (yüz oturumda birkaç dolar),
buna karşılık maliyet sayacı, fallback dizisi, web eklentisi ve tek anahtarla BYOK deneyimi zaten
onun üzerine kurulu. Konu ancak aylık harcama gerçek paraya dönüşürse yeniden açılır; o gün ilk
bakılacak yer sağlayıcı komisyonu değil, **yirmi bir kata çıkan koltuk fiyat farkı** olur.

## Maliyet: tahmin nasıl yanıldı

**Eski tahmin: $0.0888.** İki tek çağrının ortalaması (F0 brifingi ve bir denetim) alınıp 27 ile
çarpılmıştı, ve açıkça "alt sınır" diye etiketlenmişti.

**Ölçüm: yarım oturum (18 çağrı) $0.208651.** Çağrı başına $0.0116, yani tahmindeki ortalamanın
üç buçuk katı. 27 çağrılık tam kurul için bu, kabaca **$0.31 ile $0.40** bandı demek; üst uçtaki
pay geç fazlara (F5 sıralamasında Mimar ve Baş Danışman yine konuşuyor) ve düzeltilmiş token
tavanına ait.

Tahmin neden bu kadar yanıldı? Çünkü yanlış işten örneklenmişti. Prob çağrısı iki alanlık bir JSON
döndürür; gerçek faz çağrısı binlerce token bağlam okur ve paragraflarca cevap yazar. Küçük bir
çağrının fiyatından büyük bir çağrının fiyatını çıkarmak, birim fiyat sabitmiş gibi davranmaktır ve
değildir. **Ders: bir ölçüm yalnız ölçtüğü iş yükü için geçerlidir.** Bu satır burada duruyor ki
bir sonraki projeksiyon aynı hatayla kurulmasın.

Ölçülen tek tek rakamlar (sağlayıcının bildirdiği, kesin):

| Ölçüm | USD |
|---|---|
| Baş Danışman, F0 brifing (tek çağrı) | 0.003926 |
| Denetçi, F4 denetim (tek çağrı, kesilmemiş) | 0.008777 |
| Yedi koltuk şema probu (toplam) | 0.006063 |
| Kesilme teşhisi, 9 kontrollü çağrı | 0.074 |
| **Yarım oturum, 18 çağrı** | **0.208651** |

Tam oturumun gerçek rakamı henüz **yok**: capstone koşumu iptal edildi ve yeniden koşulacak. O
ölçüm geldiğinde buradaki band ya doğrulanacak ya da yine revize edilecek, ve hangisi olursa
yazılacak.

## Capstone öncesi hazırlık (2026-09-07)

Bu bölüm ölçüm değil HAZIRLIKTIR. İçindeki maliyet rakamı **kestirimdir** ve öyle etiketlidir;
gerçek rakamı capstone koşumunun kendisi verecek. Ölçülmüş olan tek şey, aşağıda ayrıca
işaretlenen yarım oturumdur.

### Kadro canlı doğrulandı (ölçüm)

Config'deki 14 model kimliği (7 pin + 7 fallback) OpenRouter'ın ücretsiz model listesinden
sorgulandı: hepsi bugün mevcut, düşen kimlik yok. Listelenen fiyatlar (2026-09-07):

| Koltuk | Model | Girdi $/M | Çıktı $/M |
|---|---|---|---|
| Mimar | anthropic/claude-opus-4.8 | 5.00 | 25.00 |
| Baş Danışman | anthropic/claude-sonnet-5 | 2.00 | 10.00 |
| Müh-1 | openai/gpt-5.1 | 1.25 | 10.00 |
| Vizyoner | x-ai/grok-4.6 | 2.00 | 6.00 |
| Müh-2 | qwen/qwen3-max | 0.78 | 3.90 |
| Pazar Sesi | google/gemini-3.7-flash | 0.75 | 3.75 |
| Denetçi | deepseek/deepseek-v4-pro | 0.96 | 1.91 |

Mimar'ın çıktı fiyatı Denetçi'ninkinin on üç katı. Yarım oturumda iki Anthropic koltuğunun
faturanın %64'ünü tutması bir tesadüf değil, bu tablonun doğrudan sonucudur.

**Prob önbelleği bayat:** 2 Eylül'de yazılmış, TTL 24 saat. Bu yüzden koşumun İLK adımı prob
tazelemesidir (ölçülmüş maliyeti $0.006063). Gerekçe: bir model şema disiplinini kaybettiyse bunu
kırk sentlik koşumda değil, altı milyemlik probda öğrenmek gerekir.

### Çağrı planı: 27 (ölçüm, para harcamadan)

Stub oturumunun ham olay günlüğünden çıkarıldı, DESIGN §5'in 26-28 bandının içinde:

| Faz | Çağrı | | Koltuk | Çağrı |
|---|---|---|---|---|
| F0 brifing + HMW | 2 | | Baş Danışman | 6 |
| F1 çerçeve | 1 | | Denetçi | 5 |
| F2 üretim + özet | 5 | | Müh-1 | 5 |
| F3 çapraz + özet | 5 | | Mimar | 5 |
| F4 fizibilite + denetim + revizyon + hüküm + özet | 8 | | Pazar Sesi | 3 |
| F5 sıralama + taslak + final denetim | 6 | | Vizyoner | 2 |
| **Toplam** | **27** | | Müh-2 | 1 |

### Maliyet: kestirim (ölçüm DEĞİL)

İptal edilen koşum tam olarak 18 çağrıda durmuştu (17 planlı + 1 denetim iadesi) ve $0.208651
harcamıştı; bu ÖLÇÜMDÜR. Geriye kalan 10 çağrı şunlar: revizyon 2, hüküm 1, F4 özeti 1, F5
sıralama 4, taslak 1, final denetim 1. Hepsi geç faz çağrısı, yani bağlamları daha ağır; ucuz
olmaları beklenmiyor.

**KESTİRİM: $0.32 ile $0.41** (prob tazelemesi dahil). Bu bandın sınırı açıkça söylenmeli:
"çağrı başına ortalama çarpı 27" hesabı bu repoda bir kez yanıldı ve neden yanıldığı yukarıda
yazılı. Band, ortalamayla değil, ölçülmüş yarım oturumun üstüne kalan on çağrının KOLTUK
dağılımına bakılarak kuruldu; yine de kestirimdir ve koşum sonrası ya doğrulanacak ya revize
edilecek.

**Süre:** yarım oturum 713 saniye sürmüştü ama o koşum sıralıydı. F2, F3, F4 fizibilite, revizyon
ve F5 sıralama artık paralel koşuyor; kazanç henüz ölçülmedi, bu koşum onu da ölçecek.

### Bu koşumda EKSİK olacak mekanizmalar

- **Web araması kodda yok.** `search.perPhaseCap` yalnız config şemasında duruyor; `client.ts`,
  `gateway.ts` ve `openrouterRunner.ts`'in hiçbirinde plugin yok. Denetçi "Doğrulanmış" rozetini
  gerçek aramayla değil, hafızasından çıkardığı bir URL ile hak edecek. URL zorunluluğu kodda var,
  URL'nin gerçekliği yok (§6.2'nin bilinen sınırı, M2-C).
- **Karar belgesi şablona basılmayacak.** `templates/` altındaki iki şablon hiçbir kaynak
  dosyadan referans edilmiyor; belge üretimi M3. Çıktı, sürücünün yazdığı transkript ve künyedir.
- **Triyaj sınıfı hâlâ model kanaati** (M2-B), KAPI 1'de "kanaat" işaretiyle gelecek.
- **§6.1'in adanmış katmanı yok.** Fazlar arası taşınan her metin maskeden geçiyor ve F3 yalnız
  maskelenmiş F2 özetini görüyor; açık kalan, dolaylı tanıma (üslup, konu, ima).

### Parayı yakabilecek üç yer (kod okunarak çıkarıldı)

1. **Tek koltuklu çağrılarda ne zaman aşımı var ne yeniden deneme (U-9).** `runPhaseSeats`
   korkulukları yalnız çok koltuklu fazlara uygulanıyor: 27 çağrının 17'si korumalı, **10'u
   değil** (iki F0, F1 çerçeve, üç faz özeti, denetim, hüküm, taslak, final denetim). Geçici bir
   sağlayıcı hatası bunların herhangi birinde düğümü çökertir. Karar: Blok 3'te kalıyor, çünkü
   para koşumundan hemen önce on çağrı yerine dokunmak fazladan risktir.
2. **Çöken oturum kurtarılamıyor (U-14).** Düğüm çökünce route bir `error` olayı gönderip akışı
   kapatıyor; sürücü `--devam`'da bekleyen kapı bulamayınca oturumu bitmiş sayıyor. Yani 22.
   çağrıda çöken bir oturumda ödenmiş 22 çağrı çöpe gidiyor. Route tarafı zaten hazır
   (`reTableToNode` checkpoint geçmişinden sürüyor). **Karar: U-14 capstone öncesine çekildi.**
3. **İade, yeniden deneme ve özet çağrıları hiçbir tavana sayılmıyor (U-11).** Geçen koşumda
   denetim bir kez iade edilmişti; 27 planlı çağrı pratikte 28-30'a çıkabilir ve tavan 30.

### Ek belgelerin maliyet payı (kestirim, T3-9)

Yukarıdaki band ekler OLMADAN kuruldu. Ek iliştirilirse tam metin yalnız F0 brifingine, üç
fizibilite çağrısına ve denetime gider (§5 bütçe bilinçli enjeksiyon); diğer fazlar BD'nin ek
özetini görür.

Ölçülen dosya boyutları (`wc -m`, 2026-09-07):

| Dosya | Karakter |
|---|---|
| `fikir.txt` | 809 |
| webhook-verify README | 5.337 |
| audit-chain README | 18.518 |
| idem-client README | 11.561 |
| **Üç README toplamı** | **35.416** |

35.416 karakter, kaba ölçüyle (3,8 karakter/token) yaklaşık **9.300 token**. Bu, tam metni gören
beş çağrının her birine ayrı ayrı gider; girdi fiyatları koltuktan koltuğa değiştiği için toplam
çağrı sayısıyla değil, HANGİ koltuğun gördüğüyle belirlenir:

| Çağrı | Koltuk | Girdi $/M | Ek payı |
|---|---|---|---|
| F0 brifing | Baş Danışman | 2,00 | $0,0186 |
| F4 fizibilite | Müh-1 | 1,25 | $0,0117 |
| F4 fizibilite | Müh-2 | 0,78 | $0,0073 |
| F4 fizibilite | Mimar | 5,00 | $0,0466 |
| F4 denetim | Denetçi | 0,96 | $0,0089 |
| **Toplam** | | | **$0,093** |

Bir denetim iadesi olursa $0,102. Yani **ek girdi payı kabaca 9-12 sent**, ve yarısı tek başına
Mimar'ın: en pahalı koltuk aynı zamanda tam metni gören koltuklardan biri.

**Ekli band: $0,42 ile $0,53.** (Eksiz band $0,32-0,41 idi.) Bu bir KESTİRİMDİR; ek metnin
çıktı uzunluğunu da artırması muhtemel, o pay burada hesaplı değil.

**Hangi ekler iliştirilecek: Şah koşum günü seçer.** Üçünü de iliştirmek kararın kalitesi
açısından tutarlıdır, çünkü sorulan şey üçlünün ORTAK konumlandırması; ekleri kısmak, kurula
karşılaştıramayacağı bir soru sormak olur.

D-7'nin ek belge boyut EŞİĞİ hâlâ borç (U-13): şu an bir üst sınır yok, yani çok büyük bir ek
sessizce pahalıya mal olabilir. Bu koşumda ekler elle seçildiği için risk kontrollü.

### Metin tavanı 1600 -> 2500 (2026-09-07, T3-6)

Şema çağrılarının tavanı ölçümle 8192'ye çıkarılmıştı; metin çağrılarının tavanı 1600'de kalmıştı
ve bu sayı ölçüme dayanmıyordu.

3 Eylül oturumunun (18 çağrı, gerçek modeller) metin çıktıları uzunluk sırasıyla:

| Koltuk | Faz | Karakter |
|---|---|---|
| Müh-1 | F4 fizibilite | **3.554** |
| Müh-1 | F3 çapraz | 2.209 |
| Mimar | F4 fizibilite | 1.525 |
| Pazar Sesi | F3 çapraz | 1.295 |
| Denetçi | F1 çerçeve | 1.089 |

**n=1'in söylediği:** o koşumda hiçbir metin çıktısı kesilmedi, hepsi tam bitti. Ama en uzun çıktı
3.554 karakter, yani kaba ölçüyle 900-1000 token, ve akıl yürütme tokenı da aynı tavana sayılıyor.
Yani Müh-1 tavanın yakınında çalışıyordu ve payı bilmiyoruz.

**Karar:** tavan 2500. Gerekçe kesilme ölçümünün dersiyle aynı: kesilen çağrı da faturalanıyor ve
karşılığında hiçbir şey vermiyor, yani düşük tavan parayı KURTARMIYOR, sadece karşılığını
kaybettiriyor. Kullanılmayan tavan da para etmez: model kısa cevap veriyorsa tavan yüksek diye
uzun yazmaz, çıktı token'ı ne üretildiyse o kadar faturalanır.

Bu bir n=1 gözlemine dayanan ayardır ve capstone koşumundan sonra gerçek dağılımla yeniden
bakılacak.

---

## İlk tam gerçek oturum (2026-09-07)

> **Bu koşumda olmayan mekanizmalar.** Web araması KODDA YOK, yani "Doğrulanmış" rozeti gerçek
> aramayla değil modelin hafızasındaki URL ile hak edilebilir. Karar belgesi `templates/`
> şablonuna basılmıyor (M3), çıktı ham transkript ve künyedir. Triyaj sınıfı hâlâ modelin
> kanaati (M2-B). §6.1'in adanmış anonimleştirme katmanı yok; taşınan metinler maskeli ama
> dolaylı tanıma açık. Aşağıdaki sayılar "Divan böyle çalışıyor" değil, "Divan'ın bu aşaması
> böyle çalıştı" diye okunmalıdır.

Kadro: ana `divan.config.json`, altı aile. Fikir: Şah'ın üç Java kütüphanesinin konumlandırması
(`fikir.txt`, 808 karakter) artı üç README eki. Bütün sayılar oturumun ham olay günlüğünden
(`oturum-2026-09-07T12-46-45-900Z.jsonl`) `eval/karsilastir.mjs` ile yeniden üretilir.

| | |
|---|---|
| Çağrı | 28 (27 planlı + 1 terk edilen deneme) |
| Maliyet | **$0.708066** |
| Token | 213.843 |
| Süre | 1.607 sn = model 615 sn + kapıda bekleme 993 sn |
| Önbellekten okunan | 10.676 token |
| Revizyon turu | 1 | 
| Denetim mekanik şartları | tam |
| Susan koltuk | yok |

**Kapıda bekleme model süresinin bir buçuk katı.** Şah üç kapıda toplam 993 saniye düşündü, kurul
615 saniye konuştu. Bu bir arıza değil ölçü: Divan'ın darboğazı model hızı değil, insan kararı.

### Koltuk başına maliyet

| Koltuk | Model | Çağrı | Maliyet | Pay |
|---|---|---|---|---|
| Mimar | claude-opus-4.8 | 5 | $0.281140 | **39.7%** |
| Baş Danışman | claude-sonnet-5 | 6 | $0.219534 | 31.0% |
| Müh-1 | gpt-5.1 | 5 | $0.082236 | 11.6% |
| Denetçi | deepseek-v4-pro | 6 | $0.076200 | 10.8% |
| Vizyoner | grok-4.6 | 2 | $0.025808 | 3.6% |
| Pazar Sesi | gemini-3.7-flash | 3 | $0.014553 | 2.1% |
| Müh-2 | qwen3-max | 1 | $0.008594 | 1.2% |

İki Anthropic koltuğu faturanın **%70.7'si**. Yarım oturumda %64 ölçülmüştü; tam oturumda pay
büyüdü, çünkü Mimar geç fazlarda da konuşuyor ve bağlamı her fazda ağırlaşıyor.

### Ek belgelerin payı: kestirim tuttu

Tam metni gören çağrıların girdi büyüklüğü, aynı koltuğun özet gören çağrılarıyla kıyaslanınca
ekin yükü doğrudan görünüyor:

| Çağrı | Girdi token | Aynı koltuğun özet gören çağrısı |
|---|---|---|
| Müh-1, F4 fizibilite | 10.752 | F4 revizyon 2.649 |
| Mimar, F4 fizibilite | 17.217 | F5 sıralama 5.886 |
| Denetçi, F4 denetim | 13.980 | F1 çerçeve 1.810 |
| Baş Danışman, F0 brifing | 14.693 | F0 HMW 2.358 |

Müh-1'in farkı 8.103 token; T3-9'da 9.300 token diye kestirilmişti. Kestirim biraz yüksekti ama
bandın içinde: ek girdi payı **8-9 sent** mertebesinde ve bunun yarısı yine Mimar'ın, çünkü en
pahalı koltuk aynı zamanda tam metni görenlerden biri.

### Önbellek: yalnız DeepSeek okudu

`cachedTokens` toplamı 10.676 ve neredeyse tamamı tek bir çağrıdan: Denetçi'nin F4 denetimi
(deepseek-v4-pro) 10.548 token'ı önbellekten okudu. Vizyoner'de (grok-4.6) 128 token. **Anthropic
koltuklarının hepsinde sıfır.** D-1'in "sabit katmanlar başta durur ki sağlayıcı önbelleği
işleyebilsin" varsayımı bu koşumda Anthropic tarafında ÖLÇÜLEREK yanlışlandı: sıra doğru olsa da
Anthropic önbelleği `cache_control` işareti olmadan çalışmıyor (C-2).

### F5'te zaman aşımı ve iptal edilmeyen istek

`f5_ranking` düğümü 180.5 saniye sürdü, yani çağrı başına 120 saniyelik tavanın üstünde. Olan şu:
Denetçi'nin ilk çağrısı zaman aşımına uğradı, `runPhaseSeats` bir kez daha denedi ve ikinci deneme
başarıyla döndü. Ama terk edilen ilk istek İPTAL EDİLMEDİ (U-9: `AbortSignal` geçilmiyor); arka
planda koşmaya devam etti ve sonunda metin tavanına çarparak (2.500 çıktı token) döndü. Faturası
$0.015950 ve toplama dahil.

Bu denemenin kayda düşme biçimi iki ayrı borç doğuruyor:

- Kayıtta **deneme numarası 1** yazıyor, oysa bu koltuğun o fazdaki ikinci çağrısıydı. Numara
  çağrı BAŞLARKEN hesaplanıyor ve geç dönen ilk deneme henüz tampona girmemişti (C-3).
- Oturum künyesi bu koşumu tertemiz gösteriyor: susan koltuk yok, `costUnknownCalls` sıfır,
  altyapı arızası kaydı yok. Yani başarısız ama faturalanan bir deneme metriklerde HİÇ görünmüyor
  (C-1).

### Denetim ve hüküm

Denetim 3 sınanmış iddia getirdi, **üçü de `model-bilgisi`**, hiçbirinde URL yok. Yani §6.2'nin
rozet kuralı bu koşumda hiç sınanmadı: kimse "doğrulanmış" demedi. Hüküm turu tek turda kapandı,
8 kriter: 7 karşılandı, 1 kısmen, blocking yok.

---

## Aynı aile deneyi (2026-09-09)

> **Bu koşumda olmayan mekanizmalar.** Yukarıdaki uyarının tamamı burada da geçerlidir: web
> araması yok, karar belgesi şablona basılmıyor, triyaj kanaat, §6.1 katmanı yok. Ek olarak bu
> koşum bir KONTROLLÜ DENEY DEĞİL, tek gözlemdir (n=1) ve aşağıda sayılan karıştırıcıları taşır.

Soru: §3'ün tek kaynaklı kazancı heterojenlikten geliyorsa, aynı kadroyu tek aileden kurmak ne
kaybettirir? Kadro `eval/divan.config.claude.json` (yalnız Anthropic), fikir ve kapı yanıtları 7
Eylül koşumuyla aynı. Kaynak: `oturum-2026-09-09T13-14-14-099Z.jsonl`.

| | 7 Eylül (altı aile) | 9 Eylül (tek aile) |
|---|---|---|
| Çağrı, state | 28 | 30 |
| Çağrı, olay günlüğü | 28 | **34** |
| Maliyet, state | $0.708066 | $1.250261 |
| Maliyet, olay günlüğü | $0.708066 | **$1.387532** |
| Token | 213.843 | 340.085 |
| Önbellekten okunan | 10.676 | **0** |
| Revizyon turu | 1 | 2 |
| Hüküm turu | 1 | 2 |

**Fatura iki katına yakın arttı (%96).** Ama bu farkın tamamı kadrodan değil: aşağıdaki
karıştırıcılar okunmadan bu sayı bir sonuç değildir.

### Terk edilen dal: state'in görmediği $0.137

F5 sıralaması iki kez koştu. İlk dalgada Denetçi'nin çağrısı metin tavanına çarptı (2.500 çıktı
token) ve transkripte `[KOLTUK SUSTU: cevap token tavanına çarptı...]` diye geçti; hemen ardından
karar taslağı çağrısı AYNI tavana çarpıp düğümü çökertti. Fable metin tavanını 2.500'den 6.000'e
çıkarıp `f5_ranking` düğümünden re-table yaptı; ikinci dalga sorunsuz koştu.

Sayıların söylediği:

- Terk edilen dal **4 çağrı, $0.137271**. Bu para harcandı ama `state.callCount` ve
  `state.costNanoUsd` onu görmüyor, çünkü re-table checkpoint'i geri sardı (C-7).
- Çöken taslak çağrısının faturası **hiçbir yerde yok**. Düğüm çöktüğü için `flushUsage`
  koşmadı; sağlayıcı o çağrıyı üretti, biz ödedik, kayıt tutmadık (C-8).
- İkinci dalgada Denetçi 2.993 çıktı token üretti, yani 2.500 tavanı gerçekten yetmiyordu (C-9).
- `[KOLTUK SUSTU]` etiketi yanıltıcı: koltuk susmadı, tavan kesti. Bu altyapı arızası (U-15).

### Koltuk başına maliyet

| Koltuk | Model | Çağrı | Maliyet | Pay |
|---|---|---|---|---|
| Denetçi | claude-sonnet-5 | 7 | $0.421248 | 30.4% |
| Mimar | claude-opus-4.8 | 7 | $0.416305 | 30.0% |
| Baş Danışman | claude-sonnet-5 | 6 | $0.266994 | 19.2% |
| Müh-1 | claude-sonnet-5 | 7 | $0.192948 | 13.9% |
| Vizyoner | claude-sonnet-5 | 2 | $0.040536 | 2.9% |
| Pazar Sesi | claude-haiku-4.5 | 4 | $0.034635 | 2.5% |
| Müh-2 | claude-haiku-4.5 | 1 | $0.014866 | 1.1% |

Denetçi 7 Eylül'de faturanın %10.8'iydi, burada %30.4. Sebep açık: DeepSeek'ten sonnet-5'e geçti
ve DeepSeek'in çıktı fiyatı $1.91/M, sonnet-5'inki $10/M. **Ucuz bir denetçi, denetimi ucuzlatır.**

### Önbellek: sıfır

Bu koşumda `cachedTokens` toplamı **0**. Yedi koltuğun yedisi de Anthropic olduğu için, 7
Eylül'de DeepSeek'in getirdiği 10.5k'lık önbellek kazancı tamamen kayboldu. Aynı aileye geçmek
önbellek açısından kazanç değil kayıp oldu (C-2).

### Konformite ölçüsü

`eval/karsilastir.mjs` faz içi görüşlerin ikili KOSİNÜS benzerliğini hesaplar (kelime frekans
vektörleri). Ölçü anlamı değil kelime örtüşmesini ölçer ve mutlak bir eşik değildir; kollar arası
karşılaştırma için anlamlıdır.

| Faz | 7 Eylül (altı aile) | 9 Eylül (tek aile) |
|---|---|---|
| F2 sessiz üretim | 0.409 | 0.349 |
| F3 çapraz tozlaşma | 0.357 | 0.376 |
| F5 sıralama | 0.420 | 0.270 |

**Beklenen bulgu çıkmadı.** Tek aileli kurul, üretim fazında altı aileli kuruldan daha benzer
yazmadı; tersine F2'de biraz daha AYRIK çıktı. Yani "aynı aile = konformite" beklentisi bu tek
gözlemde doğrulanmadı.

Ama başka bir yerde çok net bir sinyal var. 9 Eylül F5'inde en yüksek ikili benzerlik
**Müh-1 / Denetçi 0.86**, en düşüğü Pazar Sesi / Denetçi 0.10. Müh-1 ve Denetçi o kolda AYNI
MODELİ (claude-sonnet-5) kullanıyordu. Karşılaştırma için: 7 Eylül'de en yüksek ikili 0.51'di ve
o iki koltuk farklı ailelerdendi.

Yani ölçülen şey aile benzerliği değil, **aynı modelin iki koltukta oturması**. Bir koltuk
diğerinin görüşünü görmüyor bile olsa, aynı model aynı girdiye çok benzer cevap veriyor ve
"bağımsız iki ses" iddiası orada sahiden zayıflıyor. Kadro kuralı adayı bu ölçümden doğdu (C-10).

### Kararların farkı

İki kurul aynı fikirden farklı yönler önerdi. 7 Eylül taslağı: üç kütüphaneyi bağımsız
repo/artifact olarak tut, ortak marka icat etme. 9 Eylül taslağı: webhook-verify'ı öne çıkar,
idem-client'ı (SNAPSHOT, kurulamıyor) profilden şimdilik çıkar, marka kararını ertele.

İkincisi daha keskin ve daha uygulanabilir görünüyor, ama bunu kadroya yazmak için elimizde
gerekçe yok: iki koşum arasında kadro dışında da çok şey değişti.

### Karıştırıcılar (bu karşılaştırmanın sınırı)

1. **Metin tavanı koşum ORTASINDA değişti** (2.500 -> 6.000). İkinci kolun sıralama ve taslak
   çağrıları daha uzun yazabildi; uzun çıktı hem maliyeti hem benzerlik ölçüsünü etkiler.
2. **Re-table var.** İkinci kol F5'i iki kez koştu; ikinci dalga, ilk dalganın çöküşünden sonra
   ve farklı tavanla üretildi.
3. **Revizyon turu sayısı farklı** (1'e karşı 2). İkinci kolda kurul bir tur daha tartıştı, bu tek
   başına maliyeti ve F4 sonrası bağlamı büyütür.
4. **Önbellek asimetrisi.** İlk kolda 10.676 token önbellekten okundu, ikincisinde 0.
5. **n=1.** İki koşum bir eğilim değil, iki gözlemdir.

Bu yüzden "%96 daha pahalı" cümlesi kadronun maliyeti değil, BU İKİ KOŞUMUN farkıdır. Kadroya
atfedilebilecek tek temiz bulgu, aynı model iki koltukta oturduğunda görüşlerin belirgin biçimde
yakınsamasıdır (0.86).
