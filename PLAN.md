# Divan: build planı (M0-M5)

Tek gerçek kaynak `DESIGN.md`; bu plan onun inşa sırasıdır. Model stratejisi ve süreç disiplini: `CLAUDE.md`.

## Review protokolü
- Her milestone sonunda: `/model claude-fable-5` → "M<X> bitti, PLAN.md'deki M<X> kontrol listesini uygula" → bulgular kapanmadan milestone kapanmaz → Opus'a dön.
- **M2 ve M5:** TAZE bir Fable oturumu (bu klasörden aç); sadece repo + DESIGN + PLAN üzerinden bağımsız review.
- Kural: kanıtsız "bitti" yok; her kabul kriteri test çıktısı veya çalışan örnekle gösterilir.
- **Gerçek para harcayan her koşumdan önce Fable masası kodu satır satır okur; plan "tamam" dediği için koşulmaz.**
- **Kanıt repoda koşulabilir olmalı; oturum-içi scratchpad çıktısı kanıt sayılmaz.** (M1'den itibaren: `npm run e2e`, anahtarsız stub'larla deterministik, düşen senaryoda non-zero exit.)

---

## M0: İskelet
**Kapsam:** git init + Next.js (App Router, TS) + LangGraph.js kurulumu; config şeması (koltuk-model eşleme, pin+fallback, bütçe tavanı, arama kapları); koltuk kontrolü (şema probu); `.env.local` anahtar yönetimi.

**Kabul kriterleri:**
- `npm run dev` açılıyor; koltuk kontrolü 7 koltuğu probluyor ve sonucu gösteriyor.
- Config dosyadan okunuyor; geçersiz config anlaşılır hata veriyor.

**Fable kontrol listesi:**
- [ ] Çekirdek (graf/olay) ile UI ayrık mı (DESIGN §7 + §10 event-bus ilkesi)?
- [ ] Koltuk kontrolü DESIGN §7 tanımına uyuyor mu (şema-kritik çağrı yönlendirmesi dahil)?
- [ ] Anahtar istemciye sızmıyor mu (network kanıtı)?

## M1: Çekirdek graf
**Kapsam:** 6 faz + 3 kapı + 3 olay-tetikli dönüş, STUB ajanlarla uçtan uca; F0 triyajı (tam kurul / küçük kurul dallanması); F4 revizyon/savunma döngüsü (mekanik kapanma); SQLite checkpointer; interrupt = Şah kapıları; re-table (tek-hedefli resume); faz özeti sıkıştırması; SSE endpoint + olay şeması.

**Kabul kriterleri:**
- Stub'larla tam oturum akıyor: F0→F5, kapılarda duruyor, resume çalışıyor.
- Bir fazı re-table edip checkpoint'ten yeniden koşturma kanıtı.
- SSE olay akışı curl ile izlenebiliyor.
- İki yol da uçtan uca koşuyor ve çağrı sayımı DESIGN §5 ile uyumlu (tam kurul 26-28, küçük kurul ~13).
- F4 revizyon döngüsü koşuyor ve kapanışı sayı karşılaştırmasıyla oluyor (ajan beyanı değil).
- Bütçe kapısı faz BAŞLAMADAN açılıyor; Şah kapıda tavanı yükseltebiliyor.
- Kilit ihlali sessiz bitişe düşmüyor: yeniden koşum, sonra HUKUM_EKSIK kapısı.
- Revizyonla düşen blocking itiraz KAPI 3'te iz olarak görünüyor (§6.4).

**Fable kontrol listesi:**
- [ ] Graf DESIGN §5 tablosuna BİREBİR mi? Sessiz sapma var mı?
- [ ] Erken-uzlaşı kilidi kenar koşulu grafta gerçekten var mı (F5 geçiş şartları)?
- [ ] Bağlam sıkıştırması: geç fazlara ham transkript taşınmıyor (token sayım kanıtı)?
- [ ] F0 triyajı İKİ yolu da gerçekten kuruyor mu (küçük kurul ayrı düğümler mi, yoksa kozmetik bir bayrak mı)?
- [ ] F4 revizyon döngüsünün kapanışı MEKANİK mi: koşul şema sayımına mı bakıyor, yoksa bir ajanın "çözüldü" beyanına mı?
- [ ] Bütçe tavanı "aşıldı mı" değil "aşılacak mı" mantığıyla mı, ve her pahalı fazın girişinde mi kontrol ediliyor?
- [ ] Kilit blok dalı END'e düşüyor mu? (Düşüyorsa sessiz bitiş = arıza.) Retry ve Şah kapısı canlı kanıtlı mı?
- [ ] Revizyonla düşen itiraz izi gerçek mi: kriter eşleştirmesi neye göre yapılıyor, gerçek modelde ad değişirse ne olur?
- [ ] Stub'daki test işaretleri ([TEST:...]) mekanikleri kanıtlıyor mu, yoksa mekaniği taklit mi ediyor?

## M2-A3: Bağlam mimarisi revizyonu (capstone ÖNCESİ zorunlu)

Fable masasının satır satır kod incelemesinden (2026-09-04) çıktı. Bulgular ve yeniden üretim
adımları: `docs/M2-A3-BULGULAR.md`. Tasarım kararları DESIGN'a yazıldı (D-1..D-8).

**Kapsam (Blok 1):** test zinciri, yerel bağlanma, maskeleme sınırı, çift sayım, çağrı başına
kullanım kaydı, özet zinciri, kimlik katmanı + oturum zarfı, F5 girdileri.

**Kabul kriterleri** (her biri önce KIRMIZI test, sonra düzeltme):
- `npm test` tek komutta tsc + bütün birim testleri + e2e koşuyor; kasıtlı bozulan bir birim testi zinciri düşürüyor.
- Sunucu yalnız `127.0.0.1`'e bağlanıyor (lsof kanıtı raporda).
- Maskeleme sözcük içini bozmuyor: "Mimari kararlar" ve "marketing" dokunulmuyor, "Mimar dedi" maskeleniyor.
- Maliyeti BİLİNEN kesilmiş çağrı "maliyeti bilinmeyen" sayılmıyor.
- Her koltuk çağrısı için kullanım kaydı tutuluyor; stub koşumda alanlar boş kalıyor, uydurulmuyor.
- Özet zinciri: F5 SON F4 özetini okuyor; özet kaydı bir daha özet girdisi olmuyor; hüküm yeniden koşumunda özet bir kez yenileniyor; `judgmentHistory` tur numarasını açıkça taşıyor.
- Seçilen HMW metni F2 ve sonrasındaki her ajan çağrısının girdisinde; F3/F5'te koltuğun kimlik metni sistem promptunda; bağlam sıkıştırması kanıtı yine 0 sızıntı veriyor.
- Taslak karar girdisi muhalefet notunun ham metnini içeriyor; final denetim girdisi taslağı içeriyor.

**Blok 3 (capstone SONRASI, borç):** U-9 tek koltuk-çağrısı yolu (AbortSignal ile gerçek iptal,
her yerde tek yeniden deneme, graf-global tamponun kalkması); U-10 kapı sözleşmesi tablosu (D-5);
U-11 iki katlı tavan (D-8); U-12 seçenek defteri, sıralama şeması, Kendall tau, tam-uyum bayrağı,
numaralı itiraz ve yönlendirme (D-3, D-4); U-13 ek belge eşiği ve maliyet ölçümü (D-7); U-14
sürücüde çökmüş oturum teşhisi; U-15 altyapı kesilmesinin transkriptte doğru etiketlenmesi.

**Fable kontrol listesi:**
- [ ] Zarf her çağrıda mı, KAPI 2'den sonra donuyor mu?
- [ ] F3/F5'te kimlik gerçekten sistem promptunda mı?
- [ ] Taslak ve final denetim girdileri boş olabilir mi?
- [ ] Özet kaydı bir daha özet girdisi olabilir mi?
- [ ] Çağrı başına kayıt stub'da uydurma değer üretiyor mu?
- [ ] Sunucu gerçekten yalnız 127.0.0.1'de mi?

## M2: Gerçek modeller + mekanikler (KRİTİK KAPI: taze Fable oturumu)
**Kapsam:** OpenRouter entegrasyonu (pin+fallback); anonimleştirme katmanı; kanıt kapısı (3 durum, URL zorunluluğu); web plugin (kaplı); hüküm turu (şema-bağlı); gömülemez muhalefet; sıralama-puanlama + Kendall tau; maliyet sayacı. **Ayrıca DESIGN §5.1:** kadronun dinamikleştirilmesi (koltuk listeleri config + KAPI 1 seçiminden gelir, kodda sabit dizi kalmaz), F0 triyajının gözlem şeması + eşik sınıflandırması, kadro kapısı (öneri + Şah düzenlemesi, Denetçi kilidi, en az üç rol, çeşitlilik uyarısı).

**Kabul kriterleri:**
- Gerçek bir fikirle tam oturum + karar belgesi çıkıyor.
- Anonimleştirme: F3/F5 çağrı payload'larında ajan kimliği YOK (log kanıtı).
- URL'siz iddia "Doğrulanmış" etiketi alamıyor (negatif test).
- Blocking "karşılanmadı" maddesi muhalefet notunda HAM duruyor (test).
- **Beyan bütünlüğü:** geçersiz şema çıktısı düzeltilmiyor; bir kez gerekçesiyle iade ediliyor, ikinci kez de geçersizse Şah kapısı açılıyor. İlk denemenin ham hali transkriptte kalıyor ve iade çağrısı bütçeye yazılıyor (test).
- Kadro KAPI 1'de değiştirilebiliyor; Denetçi çıkarılamıyor ve üç rolün altına inilemiyor (negatif test); iki aileden az kadroda uyarı çıkıyor.
- **Türkçe prompt varsayımı ölçüldü:** şema-kritik koltuklar (Denetçi, Baş Danışman) Türkçe sistem promptu altında şema disiplinini koruyor mu? Sallantı varsa ilk çare karma yapı (içerik Türkçe, şema iskeleti İngilizce). Prompt dili GERİ ALINABİLİR bir varsayımdır, ölçülmeden kalıcı sayılmaz.
- Triyaj sınıflandırması KODDAN geliyor: aynı gözlem seti her koşumda aynı sonucu veriyor, model beyanı sınıfı belirlemiyor (test).

**Fable kontrol listesi:**
- [ ] Her mekanik için "implementasyon tiyatrosu" avı: mekanik KOD ile mi zorlanıyor, yoksa prompt'ta rica mı ediliyor?
- [ ] Triyaj: model "küçük mü" diye mi soruluyor (YANLIŞ), yoksa gözlem üretip sınıfı kod mu veriyor (§5.1)? Şüphede tam kurula mı düşülüyor?
- [ ] Kadro kilitleri gerçekten kilit mi: Denetçi'siz veya iki rollü bir kurul kurulabiliyor mu (denenmeli)? Çeşitlilik uyarısı hangi eşikte çıkıyor?
- [ ] Şema-kritik çağrılar yalnız probu geçen koltuklara mı gidiyor? **F0 triyaj gözlemleri (§5.1) de bu sınıfa dahil mi?** Kurul boyutu, probu geçmemiş bir modelin bozuk şemasına bırakılamaz.
- [ ] Gerçek oturum çağrı sayısı DESIGN §5 bütçe tablosuyla uyumlu mu (SAYIM)?
- [ ] Maliyet sayacı OpenRouter usage ile tutarlı mı?
- [ ] Hüküm turu kriterleri KALICI KİMLİK taşıyor mu? Denetim itirazlarına id verilir, hüküm şeması id ile döner. §6.4 düşen itiraz izi kriter ADI eşleşmesine bağlı kalamaz: gerçek modelde ad turlar arası oynarsa sahte-düşme veya kaçırma üretir. (M1 kapısında Fable'ın açtığı borç.)
- [ ] Bütçe kapısının yanıt sözleşmesi açık mı (`devam` | yeni tavan sayısı | `abort`)? Sayı olmayan her yanıtın sessizce "devam" sayılması kabul edilemez; yazım hatası akışı sürdürmemeli.
- [ ] Probe sadakati: pin + her fallback TEK TEK problanır (models dizisi maskesi yok); şema-kritik yönlendirme yalnız tek-başına-geçen modellere gider; pass-via-fallback ve eko-uyuşmazlık dalları mock kanıtıyla gösterilir.

## M3: Çıktılar
**Kapsam:** karar belgesi + kodlama promptu üretimi (`templates/` birebir); `karar.json`; Denetçi final topraklamalı denetimi (bağımlılık listesi doğrulaması).

**Kabul kriterleri:**
- Çıktılar şablonlara birebir uyuyor (yapı testi).
- Listede olmayan bağımlılık prompt'a giremiyor (negatif test).

**Fable kontrol listesi:**
- [ ] Şablon sadakati + muhalefet notu bütünlüğü?
- [ ] Kod promptu gerçekten yapıştır-çalıştır mı (bir kodlama AI'sında smoke test)?

## M4: UI (2.5D oda)
**Kapsam:** PixiJS v8 + Pixi React izometrik oda; Kenney asset pipeline (karakter paketi seçimi burada doğrulanır); 7 avatar + konuşma balonları; SSE tüketimi; transkript/karar paneli; kurulum sihirbazı; tam-uyum bayrağı + anlaşmazlık haritası görselleştirmesi.

**Kabul kriterleri:**
- Canlı oturum odada gerçek zamanlı izleniyor.
- Oda = saf renderer: UI kapalıyken oturum aynen akıyor (kanıt).

**Fable kontrol listesi:**
- [ ] Event-bus ayrımı korunmuş mu (çekirdekte UI importu SIFIR)?
- [ ] 7 eşzamanlı stream'de akıcılık?

## M5: Eval + cila + README (KRİTİK KAPI: taze Fable oturumu)
**Kapsam:** kör eval modu (ÜÇ kol: tam kurul / küçük kurul / tek güçlü model, DESIGN §8); kayıttan-oynatma demo modu (anahtarsız); README (dürüst-vaat dili, mekanizma tablosu, Delphi soyağacı, kaynaklar); CI; istenirse divan.vercel.app demo deploy.

**Kabul kriterleri:**
- Kör eval uçtan uca: aynı fikir üç yoldan (tam kurul / küçük kurul / tek model), kör sunum, seçim kaydı.
- **Triyaj isabeti ayrı bir ölçüm satırı:** F0'ın "küçük" dediği fikirlerde küçük kurul kör seçimde ne sıklıkla kaybediyor? Gözlemler model çıktısı olduğu için mekanizmanın kendisi de ölçülmeli (M1 kapısında Fable'ın notu).
- Demo modu anahtarsız çalışıyor.
- **Kanıt paketi CI'da otomatik yenileniyor:** `npm run e2e` + tsc + build çıktıları her ana-dal koşumunda `docs/M<X>-KANIT.md` dosyasına yeniden yazılır ve üretildiği commit damgalanır. Elle yenileme kalmaz. (M1 kapısında doğan bulgu: kanıt paketi repoya girdiği anda yaşayan doküman olur ve her doküman değişikliğinde eskir; Şah'ın açık talimatı, unutulmayacak.)

**Fable kontrol listesi:**
- [ ] README iddia-kanıt eşleşmesi: kanıtsız hiçbir üstünlük iddiası yok?
- [ ] Vaat dili DESIGN §1 ile tutarlı ("yok eder" YOK; "zorlaştırır + görünür kılar" VAR)?
- [ ] Temiz kurulumdan karar belgesine bağımsız uçtan uca oturum?
- [ ] **Kanıt paketleri CI'da otomatik mı üretiliyor?** Elle güncellenen kanıt dosyası eskir; eskimiş kanıt kanıt değildir.
