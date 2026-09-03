# Divan

> *a parrhesia machine for your ideas*

Self-hosted, kendi OpenRouter anahtarınla çalışan bir LLM konseyi. Ham bir fikri 7 koltuklu,
6 farklı model ailesinden oluşan bir kurul tartışır; kararı her zaman insan verir.

**Durum: yapım aşamasında (M2).** Bu depo bitmiş bir ürün değil, inşa halindeki bir sistemdir.
Aşağıdaki hiçbir cümle bir üstünlük iddiası değildir: Divan'ın daha iyi karar ürettiği iddiası
ancak kör karşılaştırma verisiyle (tasarımın §8'i, M5) yazılabilir ve o veri henüz yoktur.

## Neyi çözmeye çalışıyor

Dil modellerinin üç kronik arızası var: yağcılık, sahte kesinlik, halüsinasyon. Divan bunları
**yok etmez**; yapısal olarak zorlaştırmayı ve görünür kılmayı dener. Yaklaşımın özü şu: bir
mekanik yalnızca promptta duruyorsa zorlanmıyor demektir. Bu yüzden kurallar graf kenarlarında,
çıktı şemalarında ve testlerde yaşar.

Hangi mekanizmanın neyle zorlandığı, hangisinin hâlâ borç olduğu tek tek yazılıdır:
[docs/MEKANIZMA-ENVANTERI.md](docs/MEKANIZMA-ENVANTERI.md).

## Belgeler

- [DESIGN.md](DESIGN.md): tek gerçek kaynak. Akış, kadro, anti-yağcılık mekanikleri, çıktı formatları.
- [PLAN.md](PLAN.md): inşa sırası (M0-M5) ve her aşamanın bağımsız review kontrol listesi.
- [docs/MEKANIZMA-ENVANTERI.md](docs/MEKANIZMA-ENVANTERI.md): mekanizma -> zorlayan katman -> kanıt.
- [docs/M2-OLCUMLER.md](docs/M2-OLCUMLER.md): gerçek koşumlardan çıkan sayılar (tahminler değil).
- [docs/M1-KANIT.md](docs/M1-KANIT.md): M1 kabul kriterlerinin koşum çıktıları.

## Çalıştırma

```bash
npm install
cp .env.example .env.local   # OpenRouter anahtarını buraya koy
npm run dev
```

Kanıt koşusu (anahtarsız, sahte ajanlarla, para harcamaz):

```bash
npm run e2e
```

Bir fikri kurula götürmek:

```bash
npm run oturum -- fikir.txt
```

## Stack

Next.js (App Router, TypeScript), LangGraph.js (SQLite checkpointer), OpenRouter.
Arayüz katmanı (PixiJS tabanlı izometrik oda) M4'te gelecek.
