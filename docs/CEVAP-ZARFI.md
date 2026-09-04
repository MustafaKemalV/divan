# Cevap zarfı alan envanteri

Sağlayıcıdan dönen her cevap, içeriğin yanında bir **zarf** taşır: bitiş sebebi, token dökümü,
cevabı gerçekte veren model. Bu dosya o zarftaki her alanı tek tek sayar ve her biri için tek bir
soruyu cevaplar: **bu alanla ne yapıyoruz?**

Üç sınıf var:

- **okunur-işlenir**: alan bir karara girer, akışı değiştirebilir.
- **okunur-kaydedilir**: alan saklanır ve gösterilir ama akışı değiştirmez.
- **bilinçli-yoksayılır**: alan okunmaz, ve NEDEN okunmadığı yazılıdır.

Bu envanterin sebebi bir arızadır: ilk gerçek oturumda Denetçi'nin cevabı token tavanına çarpıp
boş döndü. Sağlayıcı bunu `finish_reason: "length"` diyerek açıkça bildiriyordu, ama kodumuz o
alanı **hiç okumuyordu** ve boşluğu "şemaya uymadı" diye yorumluyordu. Yanlış teşhis, çalışmayan
mekanizmadan tehlikelidir: mekanizmalar doğru davrandı, sadece sebebi yanlış söylediler.

Tek giriş noktası `src/core/openrouter/gateway.ts` (`callModel`). Ham sağlayıcı çağrısı
(`client.ts` -> `chatRaw`) dışa kapalıdır; onu doğrudan çağıran kod hem izlemeyi hem bu zarf
işlemeyi atlamış olur.

## `choices[0]`

| Alan | Sınıf | Ne yapıyoruz |
|---|---|---|
| `finish_reason` | **okunur-işlenir** | `length` -> `TruncatedResponseError` (altyapı arızası). `content_filter` -> hata. `stop` -> devam. Bilinmeyen bir değer gelirse boş içerik kontrolüne düşer. |
| `message.content` | **okunur-işlenir** | Asıl çıktı. Boşsa (bitiş sebebi ne olursa olsun) hata verilir: sağlayıcı iş yaptığını söylerken elimize bir şey geçmemesi sessiz geçilmez. |
| `native_finish_reason` | bilinçli-yoksayılır | Sağlayıcıya özel ham değer. `finish_reason` normalize edilmiş hali ve kararlar için yeterli; ikisini birden okumak aynı bilgiyi iki kaynaktan almak olurdu. |
| `message.reasoning` | bilinçli-yoksayılır | Akıl yürüten modellerin düşünme METNİ. Taşınmıyor, çünkü bir sonraki fazın bağlamına girerse bağlam mimarisini (§5) deler; teşhis için metnin kendisi değil `reasoning_tokens` sayısı yeterli. |
| `index`, `logprobs` | bilinçli-yoksayılır | Tek cevap istiyoruz ve olasılık dökümü kullanmıyoruz. |

## `usage`

| Alan | Sınıf | Ne yapıyoruz |
|---|---|---|
| `cost` | **okunur-işlenir** | Maliyet sayacına girer (tamsayı nano-USD'ye çevrilerek). Gelmezse tahmin YAPILMAZ, çağrı "maliyeti bilinmeyen" sayılır. |
| `completion_tokens_details.reasoning_tokens` | **okunur-işlenir** | Kesilme teşhisinin merkezi: tavana çarpan bir çağrıda tokenların ne kadarının düşünmeye gittiğini söyler ve hata mesajına yazılır. |
| `prompt_tokens` / `completion_tokens` | okunur-kaydedilir | Kesilme mesajında ve künyede görünür. |
| `total_tokens` | okunur-kaydedilir | Oturum künyesinde toplanır. |
| `prompt_tokens_details.cached_tokens` | okunur-kaydedilir | Sağlayıcı önbelleğinin çalışıp çalışmadığının izi; ileride önbellek stratejisi kurulursa ölçüm buradan başlar. |
| `cost_details` (upstream kırılımı) | bilinçli-yoksayılır | `cost` toplamı bizim hesabımız için yeterli; kırılım sağlayıcı muhasebesi. |
| `is_byok` | bilinçli-yoksayılır | Anahtarın kime ait olduğu bizim akışımızı değiştirmiyor. |
| `audio_tokens`, `image_tokens`, `video_tokens` | bilinçli-yoksayılır | Divan yalnız metin çağrısı yapıyor; bu alanlar sıfır geliyor. |

## Cevap gövdesi

| Alan | Sınıf | Ne yapıyoruz |
|---|---|---|
| `model` | okunur-kaydedilir | Cevabı GERÇEKTE veren model. Pin ile fallback'i ayırt eder; koltuk probunda `pass-via-fallback` durumunu bu alan doğurur ve oturum çağrılarında künyeye yazılır. |
| `id`, `created`, `object`, `provider` | bilinçli-yoksayılır | Sağlayıcı muhasebesi; akışa girmiyor. Bir arıza incelemesinde gerekirse ham gövde zaten `raw` alanında duruyor. |

## Kural

Bu tabloya girmeyen yeni bir alan çıkarsa, kod onu sessizce yoksayamaz: ya işlenir, ya kaydedilir,
ya da gerekçesiyle buraya "bilinçli-yoksayılır" olarak yazılır. Sessiz yoksayma, bu dosyanın var
olma sebebi olan hatanın tam olarak kendisidir.
