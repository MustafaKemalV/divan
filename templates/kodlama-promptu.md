<!-- Divan kodlama promptu şablonu (DESIGN §9.2). Kural: §4 listesinde olmayan bağımlılık bu dosyanın HİÇBİR yerinde anılamaz. -->
# {{proje_adi}}: kodlama görevi

## 1. Rol ve hedef
{{rol_ve_hedef}}

## 2. Bağlam: alınan karar
<!-- karar.md'den otomatik süzülür -->
{{karar_ozeti}}

## 3. Teknik gereksinimler
<!-- mimari kararlar, stack, kısıtlar (Mimar + mühendislerden) -->
{{teknik_gereksinimler}}

## 4. Doğrulanmış bağımlılık listesi
<!-- ad + sürüm + doküman URL'si (Denetçi final denetiminden geçmiş). Bu listede olmayan bağımlılık KULLANILAMAZ. -->
{{bagimlilik_listesi}}

## 5. İş listesi
### v0 iskelet
{{v0}}

### Çekirdek
{{cekirdek}}

### Cila
{{cila}}

## 6. Kabul kriterleri ve test beklentileri
{{kabul_kriterleri}}

## 7. Bilinen riskler
<!-- muhalefet notundan süzülmüş -->
{{riskler}}

## 8. Yasaklar
- Uydurma API kullanma; emin olmadığın API davranışını doğrulamadan yazma.
- §4 listesinde olmayan bağımlılık ekleme.
- Bir gereksinimi sessizce atlama; yapamıyorsan nedenini raporla.
