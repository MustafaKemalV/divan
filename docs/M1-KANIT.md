# M1 kanıt paketi (Divan, 2026-08-31)

> **Üretildiği commit: `3c63b9f` (bu satırın altındaki çıktılar o ağaçta koşuldu).**
>
> Bu dosya bir KOŞUM ÇIKTISIDIR, kaynak değil. Aşağıdaki her blok `npm run e2e`, `npx tsc --noEmit`,
> `npm run build` ve `node src/core/graph/<ad>.test.ts` komutlarının ham çıktısıdır; koşucunun kendisi
> `scripts/e2e.mjs` dosyasındadır. Kanıtı doğrulamak için bu dosyayı okumak değil, komutu koşmak gerekir.

Bu paket M1'in (çekirdek graf) kabul kriterlerinin kanıtıdır. Kural gereği kanıt **repoda
koşulabilir**: aşağıdaki çıktıların tamamı tek komutla yeniden üretilir.

```
npm run e2e     # 10 senaryo + bağlam sıkıştırması kanıtı, düşen senaryoda non-zero exit
```

Koşum anahtarsızdır: dev sunucusu `OPENROUTER_API_KEY` ortam değişkeni silinerek başlatılır,
graf `StubSeatRunner` ile derlenir, hiçbir sağlayıcıya çağrı gitmez. Checkpoint veritabanı her
koşumda geçici dizinde sıfırdan kurulur; thread id'ler sabit, sayılar deterministiktir.

Kaynak: `scripts/e2e.mjs`. Birim testleri: `src/core/graph/{lock,revision,budget}.test.ts`.

---

## 1. `npm run e2e` ham çıktısı (exit 0)

```
> divan@0.0.0 e2e
> node scripts/e2e.mjs


[S01] Tam kurul uctan uca (F0-F5, KAPI 1/2/3)
  kanit: callCount=27, revizyonTuru=1
  GECTI

[S02] Kucuk kurul yolu (triyaj), F1/F3 ve KAPI2 atlanir
  kanit: mode=small, callCount=14
  GECTI

[S03] F4 revizyon dongusu (israrci muhalefet) + ERKEN_BRIFING
  kanit: revizyonTuru=2, callCount=30
  GECTI

[S04] Revizyonla dusen itiraz iz birakir (§6.4)
  kanit: [tur 1] birim ekonomisi: Birim ekonomisi karşılanmadı; dağıtım maliyeti ...
  GECTI

[S05] Erken-uzlasi kilidi: bos hukum -> yeniden kosum
  kanit: judgmentRetries=1, callCount=29
  GECTI

[S06] Erken-uzlasi kilidi: HUKUM_EKSIK kapisi (sessiz bitis yok)
  kanit: kapi acildi, F5 kosmadi, oturum Sah kararyla kapandi
  GECTI

[S07] Kucuk kurul + israrci blocking -> ERKEN_BRIFING
  kanit: mode=small, callCount=14
  GECTI

[S08] Butce kapisi faz baslamadan + Sah tavani yukseltir
  kanit: kapi F2 girisinde (3+4>5), tavan 40'a cikti, toplam 27
  GECTI

[S09] Re-table: f1_frame checkpoint'ten yeniden kosar
  kanit: f1_frame | durak KAPI2
  GECTI

[S10] Cross-process resume: sunucu oldurulur, oturum devam eder
  kanit: sunucu yeniden basladi, e2e-s10 KAPI1'den KAPI2'ye devam etti
  GECTI

[KANIT] Baglam sikistirmasi: gec fazlara giden payload'da ham transkript var mi?
  F2:idea          ham  624 krk / ~ 84 token -> sonraki 17 ajan cagrisinda sizinti: 0
  F3:cross         ham  472 krk / ~ 72 token -> sonraki 13 ajan cagrisinda sizinti: 0
  F4:feasibility   ham  494 krk / ~ 60 token -> sonraki  6 ajan cagrisinda sizinti: 0
  ileri tasinan baglam (F3 ajan cagrisi): 81 krk / ~12 kaba token
  faz ICI ham (F4 denetim/hukum, ayni faz, tasarim geregi): en buyuk 811 krk
  GECTI (F2 ham -> F3 baglami sikistirma ~7.7x, sizinti 0)

======================================================================
SONUC: 11/11 gecti
```

---

## 2. Bağlam sıkıştırması: sayıyla

PLAN M1 maddesi "geç fazlara ham transkript taşınmıyor (token sayım kanıtı)". Ölçüm yöntemi:
grafı saran bir casus runner her koltuk çağrısının **girdi bağlamını** kaydeder, sonra her fazın
ham çıktısının parmak izi (ör. `[F2:idea `) sonraki fazların ajan çağrılarının bağlamında aranır.

| Faz ham çıktısı | Boyut | Sonraki ajan çağrısı | Ham sızıntı |
|---|---|---|---|
| F2:idea | 624 karakter / ~84 kaba token | 17 | **0** |
| F3:cross | 472 karakter / ~72 kaba token | 13 | **0** |
| F4:feasibility | 494 karakter / ~60 kaba token | 6 | **0** |

İleri taşınan bağlam (F3 ajan çağrısının gördüğü): **81 karakter / ~12 kaba token**.
F2 ham metnine göre yaklaşık **7.7x** sıkıştırma.

İki dürüstlük notu:
- "Kaba token" = boşluğa göre parçalama. Gerçek tokenizer bağımlılığı eklenmedi; bu sayıların bir
  sağlayıcının tokenizer'ıyla birebir eşleştiği iddia edilmiyor.
- Faz **içi** ham taşıma tasarım gereğidir (Denetçi kendi fazının çıktısını okur): F4 denetim/hüküm
  çağrılarında en büyük bağlam 811 karakter. Bu fazlar arası sızıntı değildir, ayrıca raporlanır.
- Çalışan oturumun uçtan uca ölçüsü SSE `done` olayında: `transcriptChars: 2754` (audit için
  state'te duran ham) karşısında `summaryChars: 243` (ileri taşınan).

---

## 3. SSE akışı: ham curl yakalaması

```
SSE AKISI: ham curl yakalamasi (dev sunucusu :3140, stub ajanlar, anahtar kullanilmadi)

==================================================================
A) TAM KURUL YOLU  (fikir 88 karakter -> triyaj: full)
==================================================================
$ curl -sN -X POST /api/council -d '{"threadId":"kanit-full","idea":"<88 karakterlik fikir>"}'
data: {"type":"phase-start","phase":"F0","threadId":"kanit-full"}

data: {"type":"node-update","node":"f0_briefing","keys":["councilMode","transcript","callCount"]}

data: {"type":"node-update","node":"f0_hmw","keys":["hmwOptions","transcript","callCount"]}

data: {"type":"gate","gate":"KAPI1","payload":{"gate":"KAPI1","councilMode":"full","options":["HMW-1: \"Kurumsal musterilere denetim izi cikaran, cok modelli bir karar konseyi SaaS urunu kurmak\" fikrini nasıl netleştiririz?","HMW-2: \"Kurumsal musterilere denetim izi cikaran, cok modelli bir karar konseyi SaaS urunu kurmak\" fikrini nasıl büyütürüz?","HMW-3: \"Kurumsal musterilere denetim izi cikaran, cok modelli bir karar konseyi SaaS urunu kurmak\" fikrini nasıl test ederiz?","HMW-4: \"Kurumsal musterilere denetim izi cikaran, cok modelli bir karar konseyi SaaS urunu kurmak\" fikrini nasıl farklılaştırırız?","HMW-5: \"Kurumsal musterilere denetim izi cikaran, cok modelli bir karar konseyi SaaS urunu kurmak\" fikrini nasıl gelir modeline bağlarız?"]},"threadId":"kanit-full"}


--- KAPI 1 onayi ---
data: {"type":"node-update","node":"gate1_hmw","keys":["selectedHmw"]}

data: {"type":"node-update","node":"f1_frame","keys":["frameObjection","transcript","callCount"]}

data: {"type":"gate","gate":"KAPI2","payload":{"gate":"KAPI2","frameObjection":"Çerçeve itirazı (stub): \"Kurumsal musterilere denetim izi cikaran, cok modelli bir karar konseyi SaaS urunu kurmak\" için seçilen HMW gömülü bir varsayım içeriyor olabilir; doğru soruyu mu soruyoruz?"},"threadId":"kanit-full"}


--- KAPI 2 onayi (F2 -> F5, revizyon dongusu dahil) ---
data: {"type":"node-update","node":"gate2_frame","keys":["approvedFrame"]}

data: {"type":"node-update","node":"f2_ideation","keys":["transcript","callCount"]}

data: {"type":"node-update","node":"bd_summary_f2","keys":["phaseSummaries","callCount"]}

data: {"type":"node-update","node":"f3_cross","keys":["transcript","callCount"]}

data: {"type":"node-update","node":"bd_summary_f3","keys":["phaseSummaries","callCount"]}

data: {"type":"node-update","node":"f4_feasibility","keys":["transcript","callCount"]}

data: {"type":"node-update","node":"f4_audit","keys":["transcript","callCount"]}

data: {"type":"node-update","node":"f4_revision","keys":["transcript","revisionRounds","callCount"]}

data: {"type":"node-update","node":"f4_judgment","keys":["judgment","judgmentHistory","judgmentComplete","prevUnmetCount","transcript","callCount"]}

data: {"type":"node-update","node":"bd_summary_f4","keys":["phaseSummaries","callCount"]}

data: {"type":"node-update","node":"blocking_check","keys":[]}

data: {"type":"node-update","node":"f5_ranking","keys":["rankings","transcript","callCount"]}

data: {"type":"node-update","node":"bd_draft","keys":["dissentNote","droppedObjections","transcript","callCount"]}

data: {"type":"gate","gate":"KAPI3","payload":{"gate":"KAPI3","rankings":["market: [F5:ranking market stub] kriter bazlı sıralama (skor değil).","engineer1: [F5:ranking engineer1 stub] kriter bazlı sıralama (skor değil).","architect: [F5:ranking architect stub] kriter bazlı sıralama (skor değil).","auditor: [F5:ranking auditor stub] kriter bazlı sıralama (skor değil)."],"dissentNote":"","droppedObjections":[]},"threadId":"kanit-full"}


--- KAPI 3 onayi -> done + metrikler ---
data: {"type":"node-update","node":"gate3_decision","keys":["decision"]}

data: {"type":"node-update","node":"f5_output","keys":["transcript","callCount"]}

data: {"type":"done","threadId":"kanit-full","selectedHmw":"HMW-1","councilMode":"full","metrics":{"callCount":27,"transcriptEntries":24,"transcriptChars":2754,"summaryChars":243,"revisionRounds":1,"judgmentRetries":0}}


--- RE-TABLE: ayni thread, f1_frame checkpoint'ten yeniden ---
data: {"type":"phase-start","phase":"RE-TABLE:f1_frame","threadId":"kanit-full"}

data: {"type":"node-update","node":"f1_frame","keys":["frameObjection","transcript","callCount"]}

data: {"type":"gate","gate":"KAPI2","payload":{"gate":"KAPI2","frameObjection":"Çerçeve itirazı (stub): \"Kurumsal musterilere denetim izi cikaran, cok modelli bir karar konseyi SaaS urunu kurmak\" için seçilen HMW gömülü bir varsayım içeriyor olabilir; doğru soruyu mu soruyoruz?"},"threadId":"kanit-full"}


==================================================================
B) KUCUK KURUL YOLU  (fikir 19 karakter -> triyaj: small)
==================================================================
data: {"type":"phase-start","phase":"F0","threadId":"kanit-small"}

data: {"type":"node-update","node":"f0_briefing","keys":["councilMode","transcript","callCount"]}

data: {"type":"node-update","node":"f0_hmw","keys":["hmwOptions","transcript","callCount"]}

data: {"type":"gate","gate":"KAPI1","payload":{"gate":"KAPI1","councilMode":"small","options":["HMW-1: \"Kucuk bir CLI araci\" fikrini nasıl netleştiririz?","HMW-2: \"Kucuk bir CLI araci\" fikrini nasıl test ederiz?","HMW-3: \"Kucuk bir CLI araci\" fikrini nasıl gelir modeline bağlarız?"]},"threadId":"kanit-small"}


--- KAPI 1 onayi (F1/F3 ve KAPI 2 atlanir) ---
data: {"type":"node-update","node":"gate1_hmw","keys":["selectedHmw"]}

data: {"type":"node-update","node":"f2s_ideation","keys":["transcript","callCount"]}

data: {"type":"node-update","node":"bd_summary_f2s","keys":["phaseSummaries","callCount"]}

data: {"type":"node-update","node":"f4s_feasibility","keys":["transcript","callCount"]}

data: {"type":"node-update","node":"f4s_audit","keys":["transcript","callCount"]}

data: {"type":"node-update","node":"f4s_judgment","keys":["judgment","judgmentHistory","judgmentComplete","transcript","callCount"]}

data: {"type":"node-update","node":"bd_summary_f4s","keys":["phaseSummaries","callCount"]}

data: {"type":"node-update","node":"blocking_check","keys":[]}

data: {"type":"node-update","node":"f5s_ranking","keys":["rankings","transcript","callCount"]}

data: {"type":"node-update","node":"bd_draft","keys":["dissentNote","droppedObjections","transcript","callCount"]}

data: {"type":"gate","gate":"KAPI3","payload":{"gate":"KAPI3","rankings":["engineer1: [F5s:ranking engineer1 stub] kriter bazlı sıralama (skor değil).","auditor: [F5s:ranking auditor stub] kriter bazlı sıralama (skor değil)."],"dissentNote":"","droppedObjections":[]},"threadId":"kanit-small"}


==================================================================
C) Response header'lari
==================================================================
HTTP/1.1 200 OK
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
cache-control: no-cache, no-transform
connection: keep-alive
content-type: text/event-stream
Date: Mon, 31 Aug 2026 09:46:08 GMT
Transfer-Encoding: chunked```

---

## 4. Commit geçmişi (`git log --format="%h %s%n%b"`)

```
3c63b9f docs: F0 triyaji sema-kritik sinifa, triyaj isabeti eval satirina
M1 kapisinda Fable'in iki notu:
- DESIGN §7 + PLAN M2: F0 triyaj gozlemleri sema-kritik cagri sinifina girer;
  kurul boyutu probu gecmemis bir modelin bozuk semasina birakilamaz.
- PLAN M5: gozlemler model ciktisi oldugu icin triyajin kendisi de olculur;
  kor eval'e "triyaj isabeti" ayri satir olarak eklendi.

339f5e3 docs: DESIGN §5.1 kurul boyutu ve kadro secimi (M2'de kurulur)
Sah'in sorusu: bir isin kucuk oldugunu neye dayanarak soyleyecegiz, ve uc ajan
olacaksa hangileri?

Karar: triyaj bir model YARGISI degil, gozlem + kod + insan onayi zinciri.
- BD dort GOZLEM dondurur (yol sayisi, geri donus maliyeti, gereken uzmanliklar,
  kanit ihtiyaci); sinifi KOD verir, esikler config'de; supheda tam kurul.
- Kucuk kurul sabit ucluk degil: uc ROL (oneren / olcen / itiraz eden) doldurulur,
  koltuk fikrin eksenine gore secilir, her kombinasyon uc FARKLI aileden gelir.
- KAPI 1 ayni zamanda kadro kapisidir: oneri gerekcesiyle sunulur, Sah kabul eder
  veya kadroyu kendisi kurar.
- Uc kilit: Denetci koltugu kaldirilamaz, en az uc rol dolu olmali, iki aileden az
  kadroda uyari.
- Yapisal sonuc: kadro VERIDIR; graf koltuk listelerini config + KAPI 1'den alir.

DESIGN §8: kor karsilastirma uc kola cikti (tam kurul / kucuk kurul / tek model),
"kucuk kurul yeterli mi" bir iddia degil olcum sonucu olsun diye.

PLAN: bu is M2 kapsamina, iki kabul kriteri ve iki Fable maddesiyle yazildi.
M1 kodu sabit kadro + stub triyaji ile kalir; §5.1 basligi bunu acikca soyler.

db62c94 docs: M1 kanit paketi repoya alindi (docs/M1-KANIT.md)
Kanit repoda kosulabilir olmali kurali cikti dosyasini da kapsar: paket artik
repoda, scratchpad'de degil. Icerik e2e/tsc/build/birim testi ham ciktilari,
baglam sikistirmasi sayimi, SSE curl yakalamasi, git log ve bilinen sinirlar.

6ec9156 docs: M3 butce uyarisi (DESIGN §5) + M2'ye iki borc (PLAN)
M1 kapisinda Fable'in actigi iki not:
- DESIGN §5: F5 kuyrugu M3'te 6'dan 8'e cikinca tipik toplam ~29 olur, tavan 30.
  Bant M3'te sessizce delinmesin diye acikca yazildi.
- PLAN M2: (a) hukum turu kriterleri kalici kimlik tasimali, dusen itiraz izi ad
  eslesmesine birakilamaz; (b) butce kapisinin yanit sozlesmesi acik olmali.

38f8fcd test: M1 uctan uca kanit kosucusu (npm run e2e)
10 senaryo + baglam sikistirmasi kaniti, tek komutla yeniden uretilebilir:
- S01 tam kurul (27 cagri), S02 kucuk kurul (14, F1/F3 ve KAPI2 atlanir)
- S03 F4 revizyon dongusu (israrci muhalefet, 2 tur, mekanik kapanma) + ERKEN_BRIFING
- S04 revizyonla dusen itiraz izi, S05 kilit yeniden kosumu, S06 HUKUM_EKSIK kapisi
- S07 kucuk kurulda blocking muhalefet, S08 butce kapisi faz baslamadan + tavan yukseltme
- S09 re-table, S10 cross-process resume (sunucu oldurulup yeniden baslatilir)
- KANIT: uc fazin ham ciktisi sonraki ajan cagrilarinda 0 sizinti; faz ICI ham ayri raporlanir

Kosucu dev sunucusunu kendisi baslatir, OPENROUTER_API_KEY ortamdan SILINIR (anahtarsiz),
checkpoint veritabani gecici dizinde sifirdan kurulur.

graph.ts: 6 runtime import .ts uzantili yapildi (Node ESM cozumlemesi icin sart;
next build ile dogrulandi, exit 0).

416bda1 docs: PLAN review protokolu, kanit repoda kosulabilir olmali
Oturum-ici scratchpad ciktisi kanit sayilmaz. M1'den itibaren kabul kriterleri
`npm run e2e` ile yeniden uretilebilir olmali (anahtarsiz stub, deterministik,
dusen senaryoda non-zero exit).

a3febfc feat: M1 kucuk kurul yolu + F4 revizyon dongusu + kilit kapisi + butce kapilari
DESIGN §5'in iki yapisal sapmasi kapatildi:
- F0 ikiye ayrildi (brifing+triyaj, HMW) = tablodaki 2 cagri
- Triyaj dallanmasi: kucuk fikir -> 3 ajanli kucuk kurul (F1/F3 ve revizyon yok)
- F4 revizyon/savunma dongusu (<=3 tur); kapanis revision.ts'te MEKANIK:
  blocking sayisi sifirlandi / tur tavani doldu / ilerleme yok. Ajan beyani girdi degil.

Oz-elestiriden cikan uc duzeltme:
- Butce kapisi her pahali fazin girisinde, faz BASLAMADAN; Sah kapida tavani yukseltebilir
  (budget_check dugumu kaldirildi, kontrol dugum icine tasindi)
- Erken-uzlasi kilidi END'e dusmuyor: judgment_retry, sonra HUKUM_EKSIK kapisi
- Hukum turu gecmisi + revizyonla dusen itiraz izi (KAPI3 payload'inda)

Kanit: tam kurul 27 cagri (DESIGN 26-28), kucuk kurul 14 (~14); 10 canli senaryo
curl ile dogrulandi; birim testleri lock/revision/budget; tsc temiz.

55612a1 docs: DESIGN kucuk kurul/butce/dusen itiraz + PLAN M1 kontrol listesi
DESIGN §5:
- 3 olay-tetikli donus (HUKUM_EKSIK eklendi)
- butce kontrolu her pahali fazin girisinde, "asildi mi" degil "asilacak mi"
- F4 revizyon dongusunun mekanik kapanma kurali
- kucuk kurul butcesi ~10 -> ~14 (siralama turu ve faz ozeti korundugu icin)

DESIGN §6.4:
- revizyonla dusen blocking itiraz, o turdaki ham metniyle iz birakir; sessizce kaybolamaz

PLAN M1: kapsam guncellendi, 5 kabul kriteri ve 6 Fable kontrol maddesi eklendi

fd31cf7 feat: M1 olay-tetikli donusler + re-table
- Olay-tetikli donus (a): butce tavani asilinca Sah'a interrupt (BUTCE); maxCalls
  config §5'ten okunur, kosullu (planli kapi degil).
- Olay-tetikli donus (b): hukum turunda blocking "karsilanmadi" varsa erken brifing
  (ERKEN_BRIFING).
- Re-table (§5): getStateHistory ile hedef fazin onceki checkpoint'i bulunup oradan
  null girdiyle yeniden kosulur; F1 re-table kanitli.

3cac17d feat: M1 grafi F1-F5 + KAPI 2/3 + erken-uzlasi kilidi + baglam sikistirmasi
- F1 (cerceve itirazi) + KAPI 2, F2 (sessiz ideation), F3 (capraz-tozlasma),
  F4 (fizibilite + denetim/premortem + hukum turu), F5 (siralama + BD taslak) + KAPI 3.
- Baglam sikistirmasi: BD faz ozetleri ileri tasinir, ham transcript audit icin
  state'te kalir (done metrics ile olculur, ~8x).
- Erken-uzlasi kilidi (§6.3): hukum turu + blocking listelenmeden F5 acilmaz;
  kosullu kenar router'i (lock.ts) + birim testi (lock.test.ts, izin + blok).
- Muhalefet notu (§6.4): blocking "karsilanmadi" Denetci ham metniyle dissentNote'a.
- SSE gate adi payload'dan (KAPI1/2/3); done olayina sikistirma/butce metrikleri.

27a02a2 feat: M1 graf omurgası, F0 + kapı + SSE + SQLite checkpointer
- LangGraph 1.4 StateGraph + Annotation state (reducer'lar: transcript append,
  callCount increment); zod sinirlarda (sonraki fazlarda ajan ciktisinda).
- F0 (BD stub brifing + 5 HMW) -> KAPI 1 (interrupt) -> resume -> END dikey dilimi.
- SeatRunner arayuzu + StubSeatRunner (M2'de gercek OpenRouter swap).
- SQLite checkpointer (@langchain/langgraph-checkpoint-sqlite): cross-process
  resume kanitli (process cokmesi sonrasi ayri process resume eder).
- /api/council SSE (ReadableStream): kapi onaylari resume ile ayni POST'a gelir.
- Cekirdek/UI ayrimi korunuyor (src/core/graph sifir React/Next importu).

d32b17a fix: M0 F-3 hata süzme + PLAN/CLAUDE güncellemeleri
- F-3: saglayici hata govdesi istemciye donmeden suzulur; yalniz status +
  kisa mesaj gecer, user_id/hesap kimligi asla (sanitizeProviderError).
- PLAN.md M2: probe sadakati kontrol maddesi (pin + fallback tek tek, mock kanit).
- CLAUDE.md: em-dash istisnasi (next dev makine-otoblogu muaf).

cadd8d7 fix: M0 review düzeltmeleri (F-1 servedModel, F-2 koltuk ekosu, em-dash)
- F-1 (probe fallback maskesi): OpenRouter cevabindaki model alani servedModel
  olarak kaydedilir; servedModel pin'den farkliysa status = pass-via-fallback,
  pass artik koru korune pin'e atfedilmez.
- F-2 (koltuk ekosu): parsed.seat === seat.id birebir dogrulanir; herhangi bir
  string yerine tam koltuk kimligi beklenir.
- Proje kurali: kalan em-dash'ler temizlendi (probe.ts, page.tsx, load.ts).

7dfa018 feat: M0 iskelet, Next.js + config + koltuk kontrolü (schema probe)
- Next.js 16 App Router (TS) + LangGraph.js kurulumu
- Çekirdek/UI ayrımı: src/core framework-bağımsız (0 React/Next importu)
- Config: divan.config.json (koltuk-model pin+fallback, bütçe, arama kapları) + zod doğrulama
- Koltuk kontrolü: 7 koltuk json_schema probe (reasoning-güvenli), server-only mühür, /api/seat-check
- .env.local BYOK, gitignore ile korunuyor (anahtar makineden çıkmaz)

4a8e7c5 docs: tasarım kilidi (DESIGN v2, PLAN M0-M5, kurallar, şablonlar)
```

---

## 5. Ek doğrulamalar

Birim testleri (`node src/core/graph/<ad>.test.ts`):

```
# (node:66286) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/mustafakemalvural/Desktop/Projects/divan/src/core/graph/lock.test.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/mustafakemalvural/Desktop/Projects/divan/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
LOCK_TEST_OK: izin(tam) + izin(kucuk) + blok1(retry x2) + blok2(Sah kapisi) + yardimci
# (node:66287) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/mustafakemalvural/Desktop/Projects/divan/src/core/graph/revision.test.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/mustafakemalvural/Desktop/Projects/divan/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
REVISION_TEST_OK: sayim + kapanis(cozuldu/ilerleme-yok/tur-tavani) + devam(ilk olcum, azalma)
# (node:66288) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/mustafakemalvural/Desktop/Projects/divan/src/core/graph/budget.test.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/mustafakemalvural/Desktop/Projects/divan/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
BUDGET_TEST_OK: asilacak-mi semantigi (sinir, tasma, erken durdurma)```

TypeScript: `npx tsc --noEmit` -> **exit 0, sıfır satır çıktı**.
Next derlemesi: `npm run build` -> **exit 0**, `Compiled successfully`.

---

## 6. Bilinen sınırlar (Fable'ın bakmasını istediğim yerler)

Bunlar saklanmıyor, açıkça masaya konuyor:

1. **Düşen itiraz izi kriter ADINA göre eşleşiyor.** Stub'da kriter adları sabit; gerçek modelde
   aynı itiraz iki turda farklı adlandırılırsa (ör. "birim ekonomisi" / "maliyet yapısı") iz yanlış
   hesaplanır. M2'de hüküm turu şemasında kriter listesinin sabitlenmesi gerekiyor.
2. **Stub'da dört test işareti var** (`[TEST:blocking]`, `[TEST:nojudgment]`,
   `[TEST:nojudgment:always]`, `[TEST:drop]`). Bazı dallar sağlıklı akışta kendiliğinden oluşmaz;
   alternatifi onları hiç kanıtlamamaktı. M2'de gerçek runner ile kalkacaklar. Sorulması gereken:
   bu işaretler mekaniği kanıtlıyor mu, yoksa taklit mi ediyor?
3. **Triyaj stub'da fikrin uzunluğuna bakıyor** (<=60 karakter -> küçük kurul). Dallanma yapısı
   gerçek, ama triyaj KARARININ kalitesi ancak M2'de gerçek modelle sınanabilir.
4. **M3 bütçe gerilimi:** tam kurul şu an 27 çağrı; M3'te kod promptu (Müh-1) ve çapraz denetim
   (Müh-2) eklenince 29'a çıkar, tavan 30. Tavanın yeniden konuşulması gerekecek.
5. **Bütçe kapısı bilgilendirir, kesmez:** Şah kapıda sayı verirse tavan yükselir, vermezse akış
   aynı tavanla devam eder ve bir sonraki pahalı fazda tekrar sorar. Sert kesme (oturumu bitirme)
   davranışı yok; DESIGN §5 bunu istemiyor ama Fable'ın kararına açık.
