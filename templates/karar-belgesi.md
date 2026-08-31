<!-- Divan karar belgesi şablonu (DESIGN §9.1). Bağlayıcıdır; değişiklik = Şah onayı. -->
# Karar Belgesi: {{baslik}}

> Divan oturumu: {{oturum_id}} | Tarih: {{tarih}} | Bütçe: {{cagri_sayisi}} çağrı / ${{maliyet}}

## 1. Özet
<!-- En fazla 5 satır: seçilen yön + tek cümlelik neden -->
{{ozet}}

## 2. Çerçeve
- Ham fikir: {{ham_fikir}}
- Seçilen HMW: {{secilen_hmw}}
- Çerçeve itirazı sonucu: {{cerceve_itirazi_sonucu}}

## 3. Seçenekler ve sıralamalar
<!-- Kriter bazlı SIRALAMA tablosu; mutlak skor kullanılmaz -->
{{siralama_tablosu}}

### İşte burada anlaşamıyoruz
<!-- Kendall tau ters-dönmeleri; yüksek anlaşmazlık gizlenmez, aynen gösterilir -->
{{anlasmazlik_haritasi}}

## 4. Kanıt defteri
### Doğrulanmış (URL zorunlu)
{{dogrulanmis_listesi}}

### Model-bilgisi (kaynaksız beyan, düşük güven)
{{model_bilgisi_listesi}}

### Varsayım
{{varsayim_listesi}}

## 5. Muhalefet notu (değiştirilemez)
<!-- Denetçi'nin HAM metni. Hiçbir ajan (Baş Danışman dahil) bu bloğu düzenleyemez, yumuşatamaz, kısaltamaz. -->
{{muhalefet_notu_ham}}

## 6. Riskler + premortem
{{riskler}}

### Bu neden başarısız olur (zorunlu senaryo)
{{premortem}}

## 7. Karar
- Şah'ın kararı: {{karar}}
- Şah'ın notu: {{sah_notu}}
- Tarih: {{tarih}} | Oturum referansı: {{oturum_id}}

## 8. Oturum künyesi
<!-- Runner modu damgası (DESIGN §7): stub oturumu gerçek sanılamaz. -->
- Koşum modu: {{runner_modu}}
- Toplam çağrı: {{cagri_sayisi}} | Maliyet: ${{maliyet}}
