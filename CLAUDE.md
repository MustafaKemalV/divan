# Divan: proje kuralları (her oturumda uygula)

Self-hosted anti-yağcılık LLM konseyi; kullanıcı = "Şah". Tek gerçek kaynak: `DESIGN.md`. Bu dosya her oturumda otomatik yüklenir; aşağıdaki ritüel ve kurallar bağlayıcıdır.

## Açılış ritüeli (her oturum, sırayla)
1. `DESIGN.md` oku: tasarım budur; sessiz sapma yasak.
2. `PLAN.md` varsa aktif milestone'u ve kontrol listesini bul.
3. Bellek alanındaki `journal/` son kaydını oku: kaldığımız yer orası.

## Model stratejisi
- İmplementasyon: Opus (oturum varsayılanı bu olmalı; Fable varsayılan KALMASIN).
- Milestone kapısı: Fable masası AYRI bir oturumdur (oturum içi `/model` geçişi terk edildi). Şah kapı mesajını oraya taşır, bulgular kapanmadan milestone kapanmaz.
- M2 (mekanikler) ve M5 (final) kapıları: TAZE bir Fable oturumunda, sadece repo + DESIGN + PLAN üzerinden, bağımsız review.
- **Hatırlatma görevi Claude'dadır:** bir milestone'un TÜM kabul kriterleri kanıtlandığında Claude, Şah'a açıkça şunu yazar: "M<X> kapısı: şimdi `/model claude-fable-5`'e geç ve şu mesajı gönder: 'M<X> bitti, PLAN.md'deki M<X> kontrol listesini uygula'". Model geçişini yalnız Şah yapabilir; kapıyı atlamak yasaktır.
- **Escalation:** Opus bir problemde takılırsa milestone beklemeden Şah'a Fable'a geçişi önerebilir; tek soru çözülür, Opus'a dönülür.

## Süreç disiplini
- Tasarımdan sapma gerekiyorsa: ÖNCE Şah onayıyla DESIGN.md güncellenir, SONRA kod yazılır. Ters sıra yasak.
- Kanıtsız "bitti" yok: test çıktısı veya çalışan örnek gösterilmeden hiçbir iş tamam ilan edilmez; milestone kapısı bunsuz kapanmaz.
- **Gerekçe-kanıtı testi (ev standardı):** bir kuralın NEDEN var olduğu testte gösterilir. Test önce kuralsız/naif halin bozulduğunu kanıtlar, sonra kuralın düzelttiğini. Böylece kural ileride gevşetilmek istendiğinde gerekçesi de kayıtta olur, tartışma hafızaya değil koda dayanır. (Örnek: `usage.test.ts` önce `0.1 + 0.2 !== 0.3` olduğunu gösterir, sonra tamsayı toplamanın sapmadığını.) Ayrıca testlerde yakınlık/epsilon karşılaştırması ya gerekçe yorumu taşır ya envantere borç olarak yazılır; tolerans, çözülmemiş bir sorunun yaması olabilir.
- **Commit, test zincirinin çıkış koduna bağlıdır; test düşerse commit çalışmaz.** (Kural niyet olarak değil, komut olarak kurulur: `npm test && git commit ...`. Zincir: `tsc --noEmit` + bütün birim testleri + e2e. M2-A'da kırık testle commit atıldı, kural o yüzden yazıldı.)
- **Gerçek para harcayan her koşumdan önce Fable masası kodu satır satır okur; plan "tamam" dediği için koşulmaz.** (M2-A3: plan bitmiş görünürken inceleme sekiz doğrulanmış bulgu çıkardı.)
- `templates/` altındaki şablonlar bağlayıcıdır (hem spec hem runtime asset). Format değişikliği = DESIGN §9 değişikliği = Şah onayı gerektirir.
- Dış iddialar (API davranışı, kütüphane özelliği, sürüm, fiyat) ya canlı doğrulanır ya açıkça "varsayım" etiketlenir; Divan'ın kanıt disiplini bu repoya da uygulanır.
- Kod, komut, config: önce öner, Şah onaylasın, sonra uygula.
- Uzun çizgi (em-dash) karakteri hiçbir dosyada, dokümanda, commit mesajında kullanılmaz. İstisna: `next dev`'in makine-üretimi otobloğu (`nextjs-agent-rules`) muaf, kendini her çalıştırmada yeniden ekler.
- Oturum sonunda `/diary` ile journal'a tarihli özet yazılır.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
