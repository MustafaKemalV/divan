# Divan

> *a parrhesia machine for your ideas*

Self-hosted, BYOK (kendi OpenRouter anahtarınla) çalışan bir LLM konseyi: ham fikrini 7 koltuklu, 6 farklı model ailesinden bir divan tartışır ve sana iki çıktı verir: bir karar belgesi ve kodlama AI'na yapıştıracağın topraklanmış bir kodlama promptu.

- **Durum:** Tasarım v2 TAMAMEN kilitli (2026-08-25; Fable eleştirisi → revizyon → çatal kararları; §9 onaylı, şablonlar `templates/`; §10 kilitli: PixiJS v8). Build planı: `PLAN.md` (M0-M5).
- **Konumlandırma:** Portfolyo projesi (TypeScript / Next.js / LangGraph.js).

---

## 1. Ne ve neden

LLM'lerin üç kronik arızası: yağcılık (sycophancy), sahte kesinlik, halüsinasyon. Divan bunları **yok etmez**; yapısal olarak zorlaştırır, görünür kılar ve bunu ölçer (kör A/B, §8). Bu dürüst vaat bilinçli bir karardır: "yok eder" iddiası mimari olarak taşınamaz (topraklamasız kanıt olmaz, RLHF'li modellerde kullanıcı-yönlü yağcılık sıfırlanamaz).

Kullanıcının unvanı **Şah**'tır: kararı her zaman insan verir, Divan müzakere eder.

## 2. İsim

- **Divan** (metinde böyle; kodda `divan`): Divan-ı Hümayun, padişahın danışma kurulu. Şah metaforuyla aynı dünya.
- Backronym (README easter egg'i): **D**iverse **I**ntelligence, **V**erified **A**dversarial **N**egotiation.
- Tagline'daki *parrhesia*: Antik Yunan'da güç sahibine karşı korkusuz açık sözlülük; yağcılığın (kolakeia) tam zıttı. (İsim olarak kullanılmadı: aynı nişte aktif bir proje mevcut, daiostech/parrhesia.)
- Metodolojik soyağacı: anonim turlar + moderatör özeti deseni, RAND'in **Delphi metodunun** (1950'ler) LLM'lere uyarlanmasıdır.

## 3. Arıza modu → mekanizma → kanıt durumu

| Arıza modu | Divan mekanizması | Kanıt durumu |
|---|---|---|
| Ajanlar arası konformite kaskadı | Heterojen aileler (6 aile / 7 koltuk) | Kaynaklı, mütevazı kazanç: arXiv 2502.08788 (benchmark-transfer uyarısıyla) |
| Kimlik-kaynaklı yağcılık, self-bias, çıpalama | Anonimleştirme: F3 ve F5'te görüşler kimliksiz ("Görüş A/B/C") | Kaynaklı: arXiv 2510.07517 (ACL 2026) |
| Erken sahte-konsensüs | Erken uzlaşı kilidi (§6.3) + hüküm turu | Kaynaklı: arXiv 2509.23055 |
| Yargıç-kaynaklı arıza | Yargıçlık mekanik: blocking maddeler gömülemez, takdir Şah'a çıkar | Kaynaklı: arXiv 2509.23055 |
| Rozetli halüsinasyon ("kanıt" beyanı) | Topraklama: URL'siz iddia "Doğrulanmış" etiketi alamaz (§6.2) | Tasarım kararı; arka plan: senin evidence-strict disiplinin |
| Şah'a yağcılık | TAM ÇÖZÜLEMEZ (dürüst sınır). Hafifletme: değişmemiş muhalefet notu, tam-uyum bayrağı, kör A/B | Sınır kaynaklı: arXiv 2604.02668 (çeşitlilik tek başına yetmez) |
| Erken eleştirinin üretimi bastırması | Denetçi divergent fazlarda sessiz; gerekçe: bağlam-kirliliği yönetimi (Nemeth İLHAM olarak anılır, kanıt olarak DEĞİL) | Nemeth 2001: insan-araştırması analojisi, transfer varsayım |

## 4. Kadro (7 koltuk, 6 aile)

| Koltuk | Aile | Baskın mod | Aktif fazlar | Araç |
|---|---|---|---|---|
| Vizyoner | xAI | Yeşil | F2, F3 | yok |
| Pazar Sesi | Google | Kırmızı | F2, F3, F5 | yok |
| Müh-1 | OpenAI | Beyaz/Sarı | F2, F3, F4, F5, kod-promptu | web (F4) |
| Müh-2 | Qwen | Beyaz | F4 (kısa) + final kod-promptu çapraz-denetimi | web (F4) |
| Mimar | Anthropic | Sarı | F2, F3, F4, F5 | yok |
| Denetçi | DeepSeek | Siyah | F1 (çerçeve itirazı), F4 (denetim + hüküm), F5 (puanlama + final denetim) | web (her denetimde) |
| Baş Danışman | Anthropic | Mavi | Her fazda moderatör; YARGIÇ DEĞİL | yok |

Gerekçe notları:
- Müh-2 = Qwen: çapraz-doğrulamanın değeri dekorelasyondan gelir; üretici ve yürütücü zincirde Anthropic zaten var (Mimar + taslak + muhtemelen Şah'ın kodlama AI'sı), denetleyiciler farklı aileden olmalı.
- Anthropic x2 (Mimar + Baş Danışman): güç pozisyonları ayrık; yargıçlık mekanikleştirildiği için moderatör dar boğaz değil.
- Koltuklar config'de model-pin'li; tek satırla değiştirilebilir.

## 5. Akış: 6 faz, 3 planlı kapı, 3 olay-tetikli dönüş

Şapka-kilidi faz-kilidi olarak uygulanır (herkes aynı anda aynı modda).

| Faz | Şapka | İçerik | Tipik çağrı |
|---|---|---|---|
| **F0** Brifing + HMW + triyaj | Mavi | BD fikri özetler, karmaşıklık sınıflar (küçük fikir → küçük kurul), 5 HMW üretir → **[KAPI 1]** Şah HMW seçer | 2 |
| **F1** Çerçeve itirazı | Siyah (tek slot) | Denetçi: yanlış soru mu, gömülü varsayım var mı → **[KAPI 2]** Şah onaylar/düzeltir | 1 |
| **F2** Sessiz ideation | Yeşil | Vizyoner, Pazar, Müh-1, Mimar birbirini görmeden üretir; eleştiri yasak | 4 |
| **F3** Çapraz-tozlaşma | Yeşil+Sarı | Aynı 4 ajan ANONİM transkript üzerinden build-on + BD faz özeti | 5 |
| **F4** Fizibilite + denetim + revizyon | Beyaz/Sarı→Siyah | Müh-1, Müh-2, Mimar değerlendirir (web'li) → Denetçi denetim (web'li, premortem zorunlu) → revizyon/savunma (≤3) → **Denetçi hüküm turu** (şema: karşılandı/kısmen/karşılanmadı) + BD özeti | 8-9 |
| **F5** Yakınsama + karar kapısı | Sıralama+Mavi | Pazar, Müh-1, Mimar, Denetçi kriter bazlı SIRALAR (skor değil) → BD taslak karar + değişmemiş muhalefet notu → **[KAPI 3]** Şah onayı → karar belgesi + kod promptu + Denetçi final topraklamalı denetim | 8-9 |

- **Bütçe:** tam kurul tipik **26-28 çağrı, tavan 30**; küçük kurul (3 ajan: üretici=Vizyoner, mühendis=Müh-1, Denetçi; F0+F2+F4+F5 kısaltılmış, F1/F3 ve F4 revizyon döngüsü atlanır) **~14**. (İlk taslakta 20-24, küçük kurul için ~10 denmişti; düğüm bazlı sayım ikisini de düzeltti: küçük kurulda da §6.5 sıralama turu ve faz özeti korunduğu için 14.) Kesim adayları, istenirse: F2/F3'te Müh-1'i çıkarmak (-2), F5 puanlayıcıyı 3'e indirmek (-1).
- **Bütçe kontrolü nerede:** tavan kontrolü her PAHALI fazın girişinde yapılır (F2, F3, F4, revizyon turu, F5) ve "aşıldı mı" değil "aşılacak mı" sorusunu sorar: `koşan çağrı + fazın maliyeti > tavan` ise faz BAŞLAMADAN Şah'a dönülür. Şah kapıda yeni bir tavan sayısı verirse tavan güncellenir, vermezse akış aynı tavanla devam eder.
- **Olay-tetikli Şah dönüşleri:** (a) bütçe tavanı aşılacaksa; (b) hüküm turunda blocking "karşılanmadı" kalırsa erken brifing; (c) hüküm turu bir kez yeniden koşturulmasına rağmen eksik kalırsa (§6.3 kilidi), oturum sessizce bitmez: `HUKUM_EKSIK` kapısıyla Şah'a çıkar.
- **F4 revizyon döngüsü, mekanik kapanma:** denetimden sonra savunma/revizyon turu koşar, ardından hüküm turu yeniden alınır. Döngü ancak şu üç koşuldan biriyle kapanır: blocking "karşılanmadı" sayısı 0'a indi, 3 tur doldu, ya da sayı bir önceki tura göre azalmadı (ilerleme yok). Kapanma kararı hiçbir ajanın beyanına bağlı değildir; Denetçi'nin "çözüldü" demesi kapıyı açamaz.
- **M3 bütçe uyarısı:** F5 kuyruğu M1'de 6 çağrıdır (sıralama + BD taslak + Denetçi final denetimi). §9.2 kod promptu üretimi (Müh-1) ve çapraz denetimi (Müh-2) M3'te eklenince tam kurul tipik toplamı ~29'a çıkar ve 30 tavanına yaslanır. M3'e girerken tavan ya da §5'teki kesim adayları yeniden değerlendirilir; bant sessizce delinmez.
- **Re-table:** Şah her kapıda tek-hedefli geri gönderebilir (hangi fazın yeniden koşulacağı belirtilir; checkpointer'dan resume).
- **Bağlam mimarisi:** fazlar arası ham transkript taşınmaz; BD'nin token-kapaklı faz özetleri taşınır. Ham transkript audit için state'te durur. (Karesel bağlam büyümesini öldürür.)

### 5.1 Kurul boyutu ve kadro seçimi [M2'de kurulur; M1'de sabit kadro + stub triyajı]

**İlke: model gözlem üretir, kod sınıflandırır, Şah karar verir.** Baş Danışman'a "bu fikir küçük mü" diye SORULMAZ. Sorulursa tahmin eder, aynı fikir iki koşumda farklı sınıflanır ve kurulun boyutu bir modelin o anki eğilimine kalır. Bunun yerine F0 brifingi şema-bağlı dört GÖZLEM döndürür:

1. **Yol sayısı:** fikri çözmenin kaç ayrı makul yolu var? Tek yol varsa orada müzakere değil uygulama vardır.
2. **Geri dönüş maliyeti:** yanlış çıkarsa geri almak gün / hafta / ay mertebesinde mi?
3. **Gereken uzmanlıklar:** hangi koltuklar gerçekten lazım (liste)? Üçü aşıyorsa fikir küçük değildir.
4. **Kanıt ihtiyacı:** kaç iddia dış doğrulama gerektiriyor? Hiçbiri gerektirmiyorsa topraklama mekanizmasının (§6.2) yapacak işi yoktur.

Sınıflandırmayı KOD yapar; eşikler `divan.config.json`'dadır, Şah ayarlar. **Asimetri kuralı: şüphede tam kurul.** Yanlış küçültme kalite kaybettirir, yanlış büyütme para kaybettirir; Divan'ın vaadi kalite üzerine kurulu olduğundan varsayılan güvenli taraf büyük kuruldur.

**Kadro = üç rol; koltuklar değişken.** Küçük kurul sabit bir üçlü değildir. Doldurulan şey, en küçük TAM müzakerenin üç rolüdür: öneri üretmek, yapılabilirliği ölçmek, itiraz etmek. Biri eksikse geriye müzakere kalmaz (öneri yoksa tartışılacak şey yok, ölçüm yoksa hayal, itiraz yoksa Divan'ın kuruluş sebebi yok).

| Rol | Aday koltuklar | Seçim ekseni |
|---|---|---|
| Öneren | Vizyoner / Pazar Sesi | ürün yönü mü, müşteri-fiyat mı |
| Ölçen | Müh-1 / Mimar | "nasıl yapılır" mı, "nasıl kurulmalı" mı |
| İtiraz eden | Denetçi | sabit, değişmez |

Baş Danışman fikrin eksenini bildirir, eşleştirmeyi config tablosu yapar. Hangi kombinasyon seçilirse seçilsin üç ajan üç FARKLI aileden gelir: §3'teki tek kaynaklı kazanç çeşitlilikten geldiği için, kadro küçülürken çeşitlilik pazarlık konusu değildir.

**[KAPI 1] aynı zamanda kadro kapısıdır.** Şah HMW seçerken önerilen kurul boyutunu ve kadroyu gerekçesiyle görür ("fiyatlandırma ekseninde durduğu için Pazar Sesi kondu"), tek dokunuşla kabul eder ya da kadroyu kendisi kurar. Her koltuğun görevi arayüzde tek cümleyle tanımlıdır (§4 tablosu).

Üç kilit, pazarlık konusu değildir:
- **Denetçi koltuğu kaldırılamaz.** Modeli değiştirilebilir, koltuk boş bırakılamaz. İtirazı isteğe bağlı yapan bir Divan, ucuzlatılmış bir yağcılık makinesidir.
- **En az üç rol dolu olmalı.** İkiye düşen kurul müzakere değil sohbettir.
- **Çeşitlilik uyarısı:** seçilen kadro ikiden az aileden geliyorsa UI uyarır. Engellemez (Şah bilerek yapıyor olabilir) ama sessizce de geçmez.

Bunun yapısal sonucu: **kadro veridir.** Graf, hangi fazda kimin konuşacağını koddaki sabit listelerden değil, config + KAPI 1 seçiminden alır. (M1'de listeler sabittir; M2'de dinamikleştirilir, PLAN M2.)

## 6. Anti-yağcılık mekanikleri (detay)

### 6.1 Anonimleştirme
F3 ve F5'te ajanlar birbirinin görüşlerini kimliksiz görür; kendi eski çıktısını da tanıyamaz. Tek maskeleme katmanı; kimlik-yağcılığı + self-bias + ilk-konuşan çıpalaması aynı anda hedeflenir.

### 6.2 Kanıt kapısı (3 durum)
- `Doğrulanmış`: URL zorunlu, web aramasıyla bulunmuş.
- `Model-bilgisi`: kaynaksız beyan, düşük-güven etiketiyle görünür.
- `Varsayım`: açıkça varsayım.
URL'siz hiçbir iddia `Doğrulanmış` rozetini alamaz. Web: OpenRouter web plugin (Exa, ~$0.007/arama), faz başına kap (varsayılan 3). Kapsam: Denetçi (her denetim) + Müh-1/Müh-2 (F4).

### 6.3 Erken uzlaşı kilidi
1. Denetçi denetimi, uyum derecesinden bağımsız **zorunlu premortem** içerir: en az 1 "bu neden başarısız olur" senaryosu + en az 3 sınanmış iddia.
2. **Tam-uyum bayrağı:** F5'te sıralamalar birebir aynıysa UI "şüpheli uybirliği" uyarısı gösterir.
3. Hüküm turu tamamlanmadan ve blocking maddeler listelenmeden F5'e geçilemez (graf kenar koşulu). Kilit tetiklendiğinde hüküm turu bir kez yeniden koşturulur; ikinci kez de eksik kalırsa oturum sessizce sonlanmaz, `HUKUM_EKSIK` kapısıyla Şah'a çıkar (§5 olay-tetikli dönüş c).

### 6.4 Gömülemez muhalefet
Hüküm turunda `karşılanmadı` + `blocking` işaretli her madde, Denetçi'nin HAM metniyle muhalefet notuna girer; hiçbir modelin (BD dahil) bunu yumuşatma/gömme yetkisi yok. Muhalefet notu karar belgesinin zorunlu bölümüdür.

Revizyon döngüsü bu kalkanda delik açamaz: bir turda `karşılanmadı` + `blocking` işaretlenen madde sonraki turda düşerse, muhalefet notu onu **düşen itiraz** olarak Denetçi'nin o turdaki HAM metniyle birlikte gösterir (hangi turda işaretlendiği dahil). İtiraz sessizce kaybolamaz; "revizyonla çözüldü mü, yoksa geri mi adım atıldı" takdiri Şah'a çıkar.

### 6.5 Anlaşmazlık sinyali
Mutlak skor yok; kriter başına sıralama. Anlaşmazlık = sıralama ters-dönmeleri (Kendall tau). Yüksek anlaşmazlık gizlenmez, "işte burada anlaşamıyoruz" olarak Şah'a sunulur.

## 7. Orkestrasyon + operasyon

- **Tek LangGraph.js grafı** (1.0 GA, Ekim 2025) + faz subgraph'leri. Dürüst adlandırma: "AutoGen tarzı" ayrı bir katman değildir; faz içi konuşmacı seçimi, BD'nin moderatör düğümü + koşullu kenarlardır (standart supervisor deseni).
- Şah kapıları = `interrupt()` (human-in-the-loop); kalıcılık = checkpointer (SQLite v1); faz-ortası sağlayıcı çökmesi → resume.
- Audit-trail: faz granülaritesinde deterministik; faz içi konuşmacı seçimi LLM kararıdır (non-deterministik olduğu dokümante edilir).
- **Koltuk kontrolü:** açılışta her config'li modele şema probu; structured-output stabil olmayan koltuğa şema-kritik çağrı (puanlama, etiket, hüküm) gitmez.
- Model-pin + koltuk başına fallback listesi (OpenRouter `models` dizisi).
- **Canlı maliyet sayacı:** OpenRouter usage alanından, UI'da oturum toplamı.

## 8. Eval modu (measure-before-claiming)

Aynı fikir üç yoldan koşulur: (a) tam kurul, (b) küçük kurul (§5.1), (c) tek güçlü model + sert eleştiri promptu. Şah kör seçim yapar; seçimler saklanır. Üçüncü kol şunun içindir: "küçük kurul yeterli mi" sorusu bir iddia değil, ölçüm sonucu olsun. README'deki "daha iyi karar" iddiası ancak bu veriyle yazılır. v1'de basit haliyle VAR (çatal kararı).

## 9. Çıktı formatları [ONAYLANDI, 2026-08-25; bağlayıcı şablonlar: `templates/`]

### 9.1 Karar Belgesi (`karar.md` + `karar.json`)
1. **Özet** (≤5 satır): seçilen yön + tek cümlelik neden.
2. **Çerçeve:** ham fikir → seçilen HMW → çerçeve itirazı sonucu.
3. **Seçenekler + sıralamalar:** kriter bazlı sıralama tablosu + anlaşmazlık haritası (Kendall tau).
4. **Kanıt defteri:** Doğrulanmış (URL'lü) / Model-bilgisi / Varsayım listeleri.
5. **Muhalefet notu:** Denetçi'nin ham metni, değiştirilemez blok.
6. **Riskler + premortem senaryosu.**
7. **Karar:** Şah'ın onayı + notu + tarih + oturum referansı.
JSON kopyası audit ve eval için saklanır.

### 9.2 Kodlama Promptu (`prompt.md`, yapıştır-çalıştır)
1. Rol + hedef tanımı.
2. Bağlam: karar özetinden otomatik süzülmüş ürün kararı.
3. Teknik gereksinimler: mimari kararlar, stack, kısıtlar (Mimar + mühendislerden).
4. **Doğrulanmış bağımlılık listesi:** ad + sürüm + doküman URL'si (Denetçi final denetiminden; listede olmayan bağımlılık promptta anılamaz).
5. Fazlı iş listesi: v0 iskelet → çekirdek → cila.
6. Kabul kriterleri + test beklentileri.
7. Bilinen riskler (muhalefet notundan süzülmüş).
8. Yasaklar: uydurma API kullanma, listede olmayan bağımlılık ekleme. (Divan'ın kanıt disiplini promptun içine taşınır.)

## 10. Arayüz + stack [KİLİTLİ, 2026-08-25]

- **Render:** PixiJS v8 + Pixi React (izometrik 2.5D oda; WebGPU, WebGL fallback). Asset: Kenney Furniture Kit (CC0; izometrik sprite'lar pakette hazır); karakter paketi seçimi M4'te doğrulanacak. Çekirdek = olay akışı, oda = değiştirilebilir renderer (ilke korunuyor).
- **Streaming:** LangGraph olayları → Next.js Route Handler SSE (ReadableStream) → istemcide tek olay-yayını → iki tüketici: oda renderer'ı + transkript/karar paneli. Aksiyonlar (kapı onayları) normal POST.
- **Kurulum UX'i:** ilk-çalıştırma sihirbazı: OpenRouter anahtarı (`.env.local`, anahtar makineden çıkmaz) → koltuk-model eşleme (varsayılanlar dolu) → koltuk kontrolü probu → bütçe tavanı + arama kapları.
- **Demo modu:** kayıttan-oynatma: örnek oturumun olay akışı JSON olarak repoda; anahtarsız canlı izlenir (divan.vercel.app portfolyo demosu; subdomain boş, doğrulandı).
- **Stack özeti:** Next.js (App Router, TS) + LangGraph.js 1.0 (SQLite checkpointer) + PixiJS v8/Pixi React + OpenRouter (BYOK + web plugin).

---

## Kaynaklar

- Nemeth, Brown & Rogers (2001), Devil's advocate versus authentic dissent, EJSP. (İlham; insan-araştırması, transfer varsayım.)
- arXiv 2502.08788, Stop Overvaluing Multi-Agent Debate. (Heterojenlik kazancı + tek-ajan baseline dersi.)
- arXiv 2604.02668, Too Polite to Disagree. (Yağcılık yayılımı; çeşitlilik tek başına yetmez.)
- arXiv 2509.23055, Peacemaker or Troublemaker. (Erken sahte-konsensüs; yargıç-kaynaklı arıza.)
- arXiv 2510.07517, When Identity Skews Debate (ACL 2026). (Anonimleştirme.)
- RAND Delphi metodu (1950'ler). (Anonim tur + moderatör özeti soyağacı.)
- LangGraph.js 1.0 GA (Ekim 2025): interrupt, checkpointer, subgraph.
- OpenRouter web plugin (Exa tabanlı, ~$0.007/arama).
