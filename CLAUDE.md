# Divan: proje kuralları (her oturumda uygula)

Self-hosted anti-yağcılık LLM konseyi; kullanıcı = "Şah". Tek gerçek kaynak: `DESIGN.md`. Bu dosya her oturumda otomatik yüklenir; aşağıdaki ritüel ve kurallar bağlayıcıdır.

## Açılış ritüeli (her oturum, sırayla)
1. `DESIGN.md` oku: tasarım budur; sessiz sapma yasak.
2. `PLAN.md` varsa aktif milestone'u ve kontrol listesini bul.
3. Bellek alanındaki `journal/` son kaydını oku: kaldığımız yer orası.

## Model stratejisi
- İmplementasyon: Opus (oturum varsayılanı bu olmalı; Fable varsayılan KALMASIN).
- Milestone kapısı: `/model claude-fable-5`'e geç, PLAN.md'deki ilgili milestone kontrol listesini uygula, bitince Opus'a dön.
- M2 (mekanikler) ve M5 (final) kapıları: TAZE bir Fable oturumunda, sadece repo + DESIGN + PLAN üzerinden, bağımsız review.
- **Hatırlatma görevi Claude'dadır:** bir milestone'un TÜM kabul kriterleri kanıtlandığında Claude, Şah'a açıkça şunu yazar: "M<X> kapısı: şimdi `/model claude-fable-5`'e geç ve şu mesajı gönder: 'M<X> bitti, PLAN.md'deki M<X> kontrol listesini uygula'". Model geçişini yalnız Şah yapabilir; kapıyı atlamak yasaktır.
- **Escalation:** Opus bir problemde takılırsa milestone beklemeden Şah'a Fable'a geçişi önerebilir; tek soru çözülür, Opus'a dönülür.

## Süreç disiplini
- Tasarımdan sapma gerekiyorsa: ÖNCE Şah onayıyla DESIGN.md güncellenir, SONRA kod yazılır. Ters sıra yasak.
- Kanıtsız "bitti" yok: test çıktısı veya çalışan örnek gösterilmeden hiçbir iş tamam ilan edilmez; milestone kapısı bunsuz kapanmaz.
- **Commit, test zincirinin çıkış koduna bağlıdır; test düşerse commit çalışmaz.** (Kural niyet olarak değil, komut olarak kurulur: `npm run e2e && git commit ...`. M2-A'da kırık testle commit atıldı, kural o yüzden yazıldı.)
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
