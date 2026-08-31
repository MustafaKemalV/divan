# Divan: build planı (M0-M5)

Tek gerçek kaynak `DESIGN.md`; bu plan onun inşa sırasıdır. Model stratejisi ve süreç disiplini: `CLAUDE.md`.

## Review protokolü
- Her milestone sonunda: `/model claude-fable-5` → "M<X> bitti, PLAN.md'deki M<X> kontrol listesini uygula" → bulgular kapanmadan milestone kapanmaz → Opus'a dön.
- **M2 ve M5:** TAZE bir Fable oturumu (bu klasörden aç); sadece repo + DESIGN + PLAN üzerinden bağımsız review.
- Kural: kanıtsız "bitti" yok; her kabul kriteri test çıktısı veya çalışan örnekle gösterilir.

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
- İki yol da uçtan uca koşuyor ve çağrı sayımı DESIGN §5 ile uyumlu (tam kurul 26-28, küçük kurul ~14).
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

## M2: Gerçek modeller + mekanikler (KRİTİK KAPI: taze Fable oturumu)
**Kapsam:** OpenRouter entegrasyonu (pin+fallback); anonimleştirme katmanı; kanıt kapısı (3 durum, URL zorunluluğu); web plugin (kaplı); hüküm turu (şema-bağlı); gömülemez muhalefet; sıralama-puanlama + Kendall tau; maliyet sayacı.

**Kabul kriterleri:**
- Gerçek bir fikirle tam oturum + karar belgesi çıkıyor.
- Anonimleştirme: F3/F5 çağrı payload'larında ajan kimliği YOK (log kanıtı).
- URL'siz iddia "Doğrulanmış" etiketi alamıyor (negatif test).
- Blocking "karşılanmadı" maddesi muhalefet notunda HAM duruyor (test).

**Fable kontrol listesi:**
- [ ] Her mekanik için "implementasyon tiyatrosu" avı: mekanik KOD ile mi zorlanıyor, yoksa prompt'ta rica mı ediliyor?
- [ ] Şema-kritik çağrılar yalnız probu geçen koltuklara mı gidiyor?
- [ ] Gerçek oturum çağrı sayısı DESIGN §5 bütçe tablosuyla uyumlu mu (SAYIM)?
- [ ] Maliyet sayacı OpenRouter usage ile tutarlı mı?
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
**Kapsam:** kör A/B eval modu; kayıttan-oynatma demo modu (anahtarsız); README (dürüst-vaat dili, mekanizma tablosu, Delphi soyağacı, kaynaklar); CI; istenirse divan.vercel.app demo deploy.

**Kabul kriterleri:**
- Kör A/B uçtan uca: aynı fikir iki yoldan, kör sunum, seçim kaydı.
- Demo modu anahtarsız çalışıyor.

**Fable kontrol listesi:**
- [ ] README iddia-kanıt eşleşmesi: kanıtsız hiçbir üstünlük iddiası yok?
- [ ] Vaat dili DESIGN §1 ile tutarlı ("yok eder" YOK; "zorlaştırır + görünür kılar" VAR)?
- [ ] Temiz kurulumdan karar belgesine bağımsız uçtan uca oturum?
