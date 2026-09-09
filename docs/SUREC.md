# Divan nasıl inşa ediliyor: süreç belgesi

Bu belge kodun değil, kodu üreten sürecin sözleşmesidir. `DESIGN.md` ürünün vaatlerini,
`PLAN.md` inşa sırasını anlatır; bu belge bir değişikliğin hangi yoldan geçerek repoya girdiğini
anlatır. Mekanizma envanterindeki "süreç güvenceleri" satırlarının kaynağı burasıdır. Kişisel
çalışma düzeni (araç ayarları, model tercihleri, bellek) bu belgenin dışındadır ve repoya girmez.

## 1. İki masa, tek karar verici

- **İnceleme masası** repoyu satır satır okur, bulgu çıkarır, önceliklendirir ve kararı Şah'la
  birlikte verir. Kod yazmaz.
- **Uygulama masası** kararı alır, önce kırmızıyı ölçer (bugünkü halin bozuk olduğunu gösteren
  test ya da ölçüm), sonra düzeltir, kanıtı ve commit'i üretir. Tasarımdan sapma gerekiyorsa
  uygulamaz, sorar.
- Masalar birbirini görmez: ayrı oturumlardır; bulguları ve kararları aralarında yalnız Şah
  taşır. Bu yüzden hiçbir karar "konuşmuştuk" diye kayıtsız kalamaz: transkriptte kalan bulgu,
  kaybolan bulgudur.
- Her inceleme turu ilgili milestone'un bulgular dosyasına işlenir (örnek:
  `docs/M2-A3-BULGULAR.md`): tarih, bulgular, verilen kararlar, kapanış commit'leri.
- Uygulama masası bir problemde takılırsa milestone beklemeden inceleme masasına taşınır; tek
  soru çözülür, iş uygulama masasına döner.

## 2. Kanıt kuralları

- **Kanıtsız "bitti" yok.** Test çıktısı ya da çalışan örnek gösterilmeden hiçbir iş tamam ilan
  edilmez; milestone kapıları bunsuz kapanmaz.
- **Gerekçe-kanıtı testi.** Bir kural neden varsa test onu gösterir: önce kuralsız halin
  bozulduğunu, sonra kuralın düzelttiğini. Örnek: `usage.test.ts` önce `0.1 + 0.2 !== 0.3`
  olduğunu, sonra tamsayı toplamanın sapmadığını gösterir. Kural ileride gevşetilmek istendiğinde
  gerekçesi kodda durur, tartışma hafızaya değil teste dayanır. Testlerdeki her yakınlık
  karşılaştırması ya gerekçe yorumu taşır ya envantere borç yazılır.
- **Kanıt repoda koşulabilir.** `npm test` tek komutta tip denetimini, bütün birim testlerini
  ve uçtan uca koşuyu çalıştırır; uçtan uca koşu anahtarsız, stub ajanlarla ve deterministiktir.
  Oturum içi çıktı kanıt sayılmaz.
- **Commit test zincirine bağlıdır.** Kural niyet değil komuttur: `npm test && git commit ...`.
  Zincir düşerse commit çalışmaz.
- **Gerçek para harcayan her koşumdan önce** inceleme masası kodu satır satır okur; plan "tamam"
  dediği için koşulmaz. Koşumun sayıları `docs/M2-OLCUMLER.md`'ye yazılır.

## 3. Tasarım disiplini

- Tek gerçek kaynak `DESIGN.md`. Sapma gerekiyorsa önce Şah onayıyla DESIGN güncellenir, sonra
  kod. Ters sıra yasak.
- `templates/` altındaki şablonlar bağlayıcıdır: format değişikliği DESIGN §9 değişikliğidir.
- `prompts/` ayarlanabilir malzemedir; güvence prompt metninde değil git geçmişinde ve mekanizma
  testlerindedir. Bir mekanik yalnız promptta duruyorsa zorlanmıyor demektir.
- Dış iddialar (API davranışı, kütüphane özelliği, sürüm, fiyat) ya canlı doğrulanır ya açıkça
  "varsayım" etiketlenir.

## 4. Envanter ve ölçüm

- `docs/MEKANIZMA-ENVANTERI.md`: bir satır DESIGN'da yazılı bir vaattir. Düzeltme yeni satır
  açmaz, var olan satırın kanıtını günceller; sayı elle sayılır, tahmin yazılmaz. Kaynağı bu
  belge olan güvenceler tabloların dışında "süreç güvenceleri" başlığındadır ve sayıya girmez.
- `docs/M2-OLCUMLER.md`: gerçek koşumların bıraktığı sayılar. Kestirim ölçümle asla aynı
  statüde sunulmaz ve bir ölçüm yalnız ölçtüğü iş yükü için geçerlidir.

## 5. Milestone kapıları

- Her milestone sonunda Şah, taze bir inceleme oturumuna "M<X> bitti, PLAN.md'deki M<X> kontrol
  listesini uygula" mesajını taşır. Bulgular kapanmadan milestone kapanmaz; kapanınca iş
  uygulama masasına döner.
- M2 ve M5 kapıları yalnız repo, DESIGN ve PLAN üzerinden bağımsız incelemedir.
