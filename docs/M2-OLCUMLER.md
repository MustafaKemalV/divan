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

### İkinci ölçüm: 2.500 de yetmedi, 6.000'e çıktı (2026-09-11, T4-1)

Capstone koşumları o "yeniden bakma"yı getirdi ve 2.500'ün de dar olduğunu gösterdi. Önemli olan
şu: tavan içeriği değil AKIL YÜRÜTMEYİ kesiyor, yani kesilen çağrı parayı harcayıp cevabı
vermiyor.

| Koşum | Koltuk (model) | Faz | Çıktı token | Bunun düşünmesi | Sonuç |
|---|---|---|---|---|---|
| 7 Eylül | Denetçi (deepseek-v4-pro) | F5 sıralama | 2.500 | **2.494** | kesildi, içerik yok |
| 9 Eylül | Denetçi (sonnet-5) | F5 sıralama | 2.500 | **2.500** | kesildi, içerik yok |
| 9 Eylül | Baş Danışman (sonnet-5) | F5 taslak | 4.168 | 3.197 | tavan 6.000'di, bitti |
| 9 Eylül | Denetçi (sonnet-5) | F5 sıralama (yeniden) | 2.993 | 2.137 | tavan 6.000'di, bitti |

İki ayrı model ailesi, iki ayrı koşum, hepsi geç faz. 7 Eylül'deki kesilmede 2.500 token'ın
2.494'ü düşünmeye gitti: sağlayıcı işi yaptı, faturaladı, ve geriye altı token kaldı.

Ana `divan.config.json` bu ölçümle 6.000'e çıkarıldı. Deney kolu (`eval/divan.config.claude.json`)
9 Eylül koşumunun ortasında zaten çıkarılmıştı; iki config arasındaki bu açık, ana config ile
koşulacak bir sonraki oturumun aynı duvara çarpması demekti.

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

**Kör karşılaştırma (2026-09-09):** Şah iki taslağı kaynağını bilmeden okudu ve **denk** buldu.
Yani tek aileli kolun iki katına yakın faturası, Şah'ın gözünde daha iyi bir karara dönüşmedi.
Tek gözlem, n=1, ve kör seçim yöntemi M5'in eval modunda kurulacak; ama şimdilik kayda geçen şey
şu: pahalı kol, ödediği farkı bu koşumda geri vermedi.

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

---

## M2-C öncesi prob: web eklentisi + şema aynı istekte (2026-09-11, T4-7)

M2-C'nin en merkezi vaadi, "Doğrulanmış" rozetinin o çağrının ARAMA SONUÇLARINDAKİ bir URL'ye
bağlanması. Bu ancak arama ile şema aynı istekte birlikte çalışırsa kurulabilir, ve OpenRouter
dokümanı bu bileşimi açıkça söylemiyor. Pahalı bir mekanizmayı kurmadan önce ucuz bir ölçüm:
iki gerçek çağrı, biri Denetçi koltuğunun modeliyle Exa, biri bir Anthropic koltuğuyla native.

İstek gövdesi repodaki `client.ts` ile birebir, üstüne `plugins: [{ id: "web", engine, max_results: 5 }]`
ve gerçek F4 denetim şeması (`response_format: json_schema`, `strict: true`).

| | deepseek-v4-pro + **exa** | claude-sonnet-5 + **native** |
|---|---|---|
| `finish_reason` | stop | stop |
| Şema | **GEÇERLİ** (4 iddia, 4'ü URL'li) | **GEÇERLİ** (4 iddia, 4'ü URL'li) |
| `annotations` | **5 url_citation** | **0** |
| Girdi token | 1.900 | **19.752** |
| Çıktı token | 1.771 | 1.500 |
| Bildirilen `cost` | $0.010919 | $0.074504 |
| `upstream_inference_cost` | $0.003919 | $0.074504 |
| Fark (arama kalemi) | **$0.007000** | **$0** |
| Süre | 8.7 sn | 9.7 sn |

### Üç sonuç

**1. Arama ve şema aynı istekte çalışıyor.** İkisinde de `finish_reason: stop` ve çıktı gerçek
denetim şemasından geçti. M2-C'nin temel varsayımı ayakta.

**2. `annotations` yalnız Exa'da geliyor.** Exa beş `url_citation` döndürdü ve alanları tam da
§6.2'nin istediği şey: `url, title, content, start_index, end_index`. Native'de **sıfır
annotation** geldi. Model yine URL'li iddialar yazdı ama bunlar OpenRouter'ın doğruladığı arama
sonuçları değil, modelin metninden çıkan URL'ler; yani §6.2'nin "arama sonuçlarında bulunan URL"
kuralı native ile SINANAMAZ. **M2-C `engine: "exa"` kullanmalı; native, kanıt kapısı için
kullanılamaz.**

**3. Arama ücreti Exa'da ayrılabiliyor, native'de ayrılamıyor.** Exa çağrısında
`cost - upstream_inference_cost = $0.0070002`, yani dokümandaki $0.007 birebir. §6.2'nin "arama
maliyeti kayda ayrı kalemle girer" cümlesi bu çıkarımla kurulabilir. Native'de fark sıfır: arama
ücreti ayrı bir kalem değil, GİRDİ TOKENI olarak geliyor. Girdi 19.752 token, Exa çağrısının
1.900'üne karşılık; aradaki 17.852 token enjekte edilen arama sonuçları (doğrudan ölçülmedi,
iki çağrının girdi farkından çıkarıldı). Sonnet fiyatıyla bu tek başına $0.0395.

### Probun maliyeti: $0.085423 (kestirimin üstünde)

Kestirim 1-2 sentti, gerçekleşen 8.5 sent. Sebebi tamamen ikinci çağrı: native arama, pahalı bir
modelin girdisine on sekiz bin token enjekte etti ve o çağrı tek başına $0.0745 tuttu. Exa çağrısı
$0.0109'du, yani kestirim Exa tarafı için doğruydu.

Bu aşım da bir bulgu: **native arama ucuz görünen ama girdiden faturalanan bir mekanizma.** M2-C
bütçesi Exa üzerinden kurulmalı, ve faz başına arama kapı (§6.2, varsayılan 3) gerçek bir fren.

### Karar

Prob OLUMLU: M2-C'ye girilebilir. İki kısıt kayda geçti: engine `exa` olacak, ve kanıt kapısı
`annotations`'a bağlanacağı için native engine bu kapının kaynağı olamaz.

---

## Önbellek eşik probu (2026-09-12, M2-C-1)

C-2 ölçtü ki Anthropic tarafında önbellek kendiliğinden çalışmıyor: `cache_control` işareti
gerekiyor. İşaretlemenin bir eşiği var ve iki kaynak farklı söylüyordu:

- OpenRouter dokümanı: Opus 4.8 için **4.096** token
- Anthropic dokümanı: Opus 4.8 ve Sonnet 5 için **1.024** token

Doğrulanmamış bir sayı tasarıma giremeyeceği için D-1'in sıra kararı bu ölçüme bağlandı. Yöntem:
iki sabit sistem bloğu, `cache_control: {type:"ephemeral"}` ile işaretli, her biri 60 saniye içinde
iki kez çağrıldı. İlk çağrı yazar, ikincisi okur. Betik: `eval/prob-onbellek.mjs`.

| Model | Girdi token | 1. çağrı (yazma) | 2. çağrı (okuma) | Sonuç |
|---|---|---|---|---|
| opus-4.8 | 5.806 | yazılan 5.784, $0.036435 | okunan **5.784**, $0.003177 | çalıştı |
| opus-4.8 | 2.338 | yazılan 2.316, $0.014760 | okunan **2.316**, $0.001418 | **çalıştı** |
| sonnet-5 | 5.806 | yazılan 5.784, $0.014574 | okunan **5.784**, $0.001271 | çalıştı |
| sonnet-5 | 2.338 | yazılan 2.316, $0.005994 | okunan **2.316**, $0.000667 | **çalıştı** |

Prob maliyeti: $0.078296.

### Sonuç: OpenRouter'ın 4.096 rakamı bu ölçümle bağdaşmıyor

Opus 4.8, **2.316 tokenlik** bir ön eki önbelleğe aldı ve ikinci çağrıda okudu. 4.096 eşiği doğru
olsaydı bu satır "çalışmadı" derdi. Anthropic'in 1.024 rakamı ölçümle ÇELİŞMİYOR, ama bu prob onu
DOĞRULAMIYOR da: 1.024'ün altında bir uzunluk denenmedi, yani ölçümün söylediği tek şey eşiğin
**2.316 token ya da daha küçük** olduğudur. Kesin değeri pinlemek için 1.024'ün altında bir üçüncü
ölçüm gerekir ve bu turda yapılmadı.

Not: hedef uzunluklar (~3.000 ve ~1.200) tutmadı, gerçek girdiler 5.806 ve 2.338 çıktı; kaba
karakter/token oranı yanıldı. Ölçümün sonucunu değiştirmiyor (ikisi de eşiğin üstünde çıktı) ama
alt sınırı ölçemememizin sebebi bu.

### Önbelleğin ekonomisi (liste fiyatlarıyla, doğrulanmış çarpanlarla)

| | Düz çağrı | İşaretli ilk çağrı | İşaretli tekrar |
|---|---|---|---|
| opus-4.8, 5.784 token | $0.028920 | $0.036150 (+25%) | $0.002892 (-90%) |
| sonnet-5, 2.316 token | $0.004632 | $0.005790 (+25%) | $0.000463 (-90%) |

İşaretleme ilk kullanımda %25 pahalı, her tekrarda %90 ucuz. Başa baş noktası **0,28 tekrar**:
aynı ön ek bir kez bile yeniden kullanılırsa işaretleme kendini fazlasıyla ödüyor.

Divan'da her koltuk çağrısı aynı kimlik + zarf + fikir + ek bloğuyla başlıyor ve bir oturumda 27
çağrı var. Yani ön ek defalarca tekrarlanıyor; bu ölçüme göre işaretleme oturum başına belirgin
bir tasarruf demek. **Sıra kararı (zarf + fikir + ek özetinin faz talimatının önüne alınması)
yine de Şah'ındır ve M2-C-5 o karar gelmeden yazılmaz.**

---

## Arama probu 2: eski eklenti, sunucu aracı (2026-09-15, P-1)

11 Eylül probu KISA bir soruyla koşuldu ve eski web eklentisinin sorguyu PROMPT'UN TAMAMINDAN
türettiğini göremedi. Divan'ın gerçek denetim çağrısı 35k karakterlik README metinleriyle başlar.
Bu prob aynı çağrıyı GERÇEK UZUNLUKTA kurdu: kullanıcı mesajı 50.802 karakter (üç ek belgenin tam
metni + 7 Eylül koşumunun F4 fizibilite metinleri), sistem mesajı 2.382 karakter (Denetçi kimliği
+ F4 denetim talimatı), gerçek denetim şeması. Betik: `eval/prob-arama-2.mjs`, ham cevaplar
`oturum-ciktisi/prob-arama2-2026-09-15T12-56-32-236Z.json`.

| | (i) eski eklenti | (ii) sunucu aracı | (iii) sunucu aracı |
|---|---|---|---|
| Model | deepseek-v4-pro | deepseek-v4-pro | openai/gpt-5.1 |
| HTTP | 200 | 200 | **402 (kredi yetmedi)** |
| Süre | 4,6 sn | **102,1 sn** | ölçülemedi |
| Şema | GEÇERLİ (5 iddia) | **GEÇERSİZ: markdown döndü** | ölçülemedi |
| `annotations` | 5 | **15** | ölçülemedi |
| Sonuçlar alakalı mı | **HAYIR** | **EVET** | ölçülemedi |
| Girdi token | 17.165 | **33.701** (1,96x) | ölçülemedi |
| Çıktı token | 2.563 | 4.673 | ölçülemedi |
| Arama kalemi | $0,007 (1 arama) | $0,021 (3 arama) | $0 |
| Toplam | $0,044500 | $0,071192 | 0 |

Prob toplamı: **$0,115692**. Kestirim ~5 sentti; aşımın sebebi prompt'un gerçek uzunluğu ve
sunucu aracının prompt'u turlar arası yeniden göndermesi. Koşumdan önce bu risk belirtilmişti.

### (i) Eski eklenti: arama çalışıyor ama YANLIŞ ŞEYİ arıyor

Beş sonucun tamamı Şah'ın kütüphaneleriyle ilgisiz:

```
github.com                   RestDB/webhook-verify
github.com                   JacobStephens2/webhook-verify
www.linkedin.com             Webhook signatures are calculated over bytes, not JSON objects.
www.interviewexplainer.com   Webhook HMAC-SHA256 Signature Verification in Spring Boot
github.com                   vinkurov/webhook-kit
```

Sorgu prompt'un tamamından türediği ve prompt webhook-verify README'siyle başladığı için Exa
"webhook verify" arayıp BAŞKALARININ aynı adlı projelerini getirdi. Denetimin sorduğu soruların
(Java 25 / Boot 4.1 benimsemesi, org yeniden adlandırmanın Maven koordinatlarına etkisi) hiçbiri
aranmadı. Fable masasının teşhisi birebir doğrulandı: rozet bu sonuçlarla hak edilirse, kaynak
disiplini bir tiyatroya dönüşür.

### (ii) Sunucu aracı: aramalar MÜKEMMEL, ama şema bozuldu

On beş sonucun hepsi denetimin gerçekten sorduğu sorulara ait:

```
openjdk.org / oracle.com      JDK 25
spring.io / github.com        Spring Boot 4.1 ve 4.0 surum notlari
docs.github.com / github.blog GitHub org yeniden adlandirma ve silme
maven.apache.org              Guide to relocation
central.sonatype.org          Can I change/modify/delete a component on Central
docs.gradle.org               The Maven Publish Plugin
```

`usage.server_tool_use_details`: `{"web_search_requests":3,"tool_calls_requested":3,"tool_calls_executed":3}`.
Üç arama yapıldı, ücret $0,021 (3 x $0,007) ve `cost - upstream` ile ayrılabiliyor.

**Ama `response_format: json_schema` ONURLANMADI.** `finish_reason: "stop"` gelmesine rağmen
içerik JSON değil markdown:

```
"# Denetim Raporu\n\n---\n\n## premortem\n\n**Bir yıl sonra, Eylül 2027. Plan başarısız oldu..."
```

Yani bu model/sağlayıcıda `tools` ile `json_schema` aynı istekte BİRLİKTE çalışmıyor: araç turu
varken şema sessizce düşüyor. Sessizce, çünkü HTTP 200 ve `finish_reason: stop`; hata yok, yalnız
istenen biçim yok.

Prompt yeniden gönderiliyor: girdi 33.701 token, tek turluk (i) kolunun 17.165'inin **1,96 katı**.
Yani araç turu başına prompt bir kez daha faturalanıyor ve 50k karakterlik bir denetim çağrısında
bu, aramanın kendisinden pahalı.

Süre 102,1 saniye: mevcut `timeouts.perCallMs` 120.000'e yakın. Üç arama yapan bir denetim
çağrısı, bugünkü zaman aşımı tavanının içinde ama payı dar.

### (iii) Ölçülemedi

HTTP 402: "This request would exceed your available credits". OpenRouter bakiyesi tükendi. Müh-1
kolunun (gpt-5.1) davranışı bilinmiyor; iki ailenin bir arada çalışıp çalışmadığı ölçülmedi.

### Yan ölçüm (P-3): şema ile `cache_control` BİRLİKTE çalışıyor

(ii) kolunda `tools` ile `json_schema` birlikte çalışmadığı görülünce aynı soru işaretleme için de
soruldu: M2-C-5 `cache_control`'ü bütün çağrılara koyuyor ve şema-kritik çağrılar da onların
arasında. Ölçüm (sonnet-5, 2.673 tokenlik işaretli sistem bloğu, gerçek `divan_faz_ozeti` şeması,
60 saniye içinde iki çağrı):

| | 1. çağrı | 2. çağrı |
|---|---|---|
| Önbelleğe yazılan | 2.632 | 0 |
| Önbellekten okunan | 0 | **2.632** |
| Maliyet | $0,008612 | $0,002598 |
| `finish_reason` | stop | stop |
| Şema | | **GEÇERLİ (2 madde)** |

Yani sessiz düşme `tools`'a özgü: işaretleme şemayı bozmuyor, şema da işaretlemeyi engellemiyor.
M2-C-5'in kurduğu yapı bu yönden sağlam. Maliyet $0,011210.

### Karar kuralının sonucu: DUR

Şah'ın verdiği kural şuydu: "(ii) şemayı geçip annotations döndürüyorsa M2-C-2 sunucu aracına
geçer; (ii) çalışmıyorsa DUR". (ii) annotations döndürdü ama **şemayı geçmedi**. Koşul
karşılanmadığı için M2-C-2 sunucu aracına GEÇİRİLMEDİ ve eski eklenti kodu SİLİNMEDİ; iki adımlı
tasarım (önce sorgu üret, kod arasın, sonra denetle) Fable masasına ve Şah'a döner.

Bu tablonun eklediği üç şey, o tasarım konuşulurken ölçülmüş veri olarak masada durur:
şema ile araç turunun birlikte çalışmaması, prompt'un tur başına yeniden faturalanması, ve
aramaların sorgu modelden geldiğinde gerçekten isabetli olması.
