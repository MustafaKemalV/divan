#!/usr/bin/env node
/**
 * ARAMA PROBU (M2-A3 T4-7). GERÇEK PARA HARCAR; `npm test` bunu koşmaz.
 *
 *   node eval/prob-arama.mjs
 *
 * Neden repoda: 2026-09-11 probunun sonucu `docs/M2-OLCUMLER.md`'de yazılı ve M2-C'nin iki kısıtı
 * (engine `exa`, native kullanılamaz) o sonuçtan çıktı. Bir ölçümün sonucunu yazıp onu üreten
 * isteği yazmamak, "client.ts ile birebir" iddiasını doğrulanamaz bırakır. Bu dosya o iddianın
 * okunabilir halidir: gövde `src/core/openrouter/client.ts`'in kurduğu gövdeyle aynı alanları
 * taşır, üstüne yalnız `plugins` dizisi eklenir.
 *
 * Ölçtüğü üç şey:
 *   1. Web eklentisi ve `json_schema` AYNI istekte çalışıyor mu (şema bozuluyor mu)?
 *   2. `annotations` (url_citation) dönüyor mu, hangi alanlarla?
 *   3. Arama ücreti `cost`'a yansıyor mu, ve `upstream_inference_cost` ile ayrılabiliyor mu?
 *
 * Ham cevap `oturum-ciktisi/prob-<zaman>.json`'a yazılır: sonuç tartışılırsa kayda bakılır.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const KOK = process.cwd();
const anahtar = (readFileSync(join(KOK, ".env.local"), "utf8").match(/OPENROUTER_API_KEY\s*=\s*(\S+)/) ?? [])[1];
if (!anahtar) {
  console.error(".env.local icinde OPENROUTER_API_KEY yok.");
  process.exit(2);
}

const { schemaForPhase } = await import(join(KOK, "src/core/graph/schemas.ts"));
const { validateAudit } = await import(join(KOK, "src/core/graph/audit.ts"));
const sema = schemaForPhase("F4:audit");

/** Aramayı gerçekten gerektiren, kısa bir denetim sorusu: cevabı modelin hafızasında olmamalı. */
const SORU = `Bir Java kutuphanesi Spring Boot 4.1 hedefliyor. Su anda Spring Boot'un en son kararli
surumu nedir ve 4.1 yayinlandi mi? Denetim ciktisi ver: premortem, en az uc sinanmis iddia
(etiketli), en zayif halka. Kisa tut.`;

/** Liste fiyatları; yalnız "bildirilen cost token maliyetinin üstünde mi" sorusu için. */
const FIYAT = {
  "deepseek/deepseek-v4-pro": [0.96, 1.91],
  "anthropic/claude-sonnet-5": [2.0, 10.0],
};

async function prob(model, engine) {
  // Gövde: client.ts ile aynı alanlar (model, messages, max_tokens, response_format) + plugins.
  const body = {
    model,
    messages: [
      { role: "system", content: "Sen bir denetcisin. Ciktin istenen JSON semasina birebir uymali." },
      { role: "user", content: SORU },
    ],
    max_tokens: 8192,
    response_format: { type: "json_schema", json_schema: { name: sema.name, strict: true, schema: sema.schema } },
    plugins: [{ id: "web", engine, max_results: 5 }],
  };

  const t0 = Date.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${anahtar}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/MustafaKemalV/divan",
      "X-Title": "Divan",
    },
    body: JSON.stringify(body),
  });
  const sure = ((Date.now() - t0) / 1000).toFixed(1);
  if (!res.ok) {
    console.log(`\n### ${model} (${engine}) -> HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return { model, engine, hata: res.status };
  }
  const j = await res.json();
  const msg = j.choices?.[0]?.message ?? {};
  const u = j.usage ?? {};
  const url = (msg.annotations ?? []).filter((a) => a.type === "url_citation");

  let semaDurumu;
  try {
    const v = validateAudit(JSON.parse(msg.content ?? ""));
    semaDurumu = v.ok
      ? `GECERLI (${v.audit.claims.length} iddia, ${v.audit.claims.filter((c) => c.url).length} URL'li)`
      : `GECERSIZ: ${v.reason}`;
  } catch (e) {
    semaDurumu = `AYRISTIRILAMADI: ${String(e.message).slice(0, 60)}`;
  }

  const [pin, pout] = FIYAT[model] ?? [0, 0];
  const tokenMaliyeti = ((u.prompt_tokens ?? 0) * pin + (u.completion_tokens ?? 0) * pout) / 1e6;
  const upstream = u.cost_details?.upstream_inference_cost ?? 0;

  console.log(`\n### ${model}  (engine: ${engine})  ${sure} sn`);
  console.log(`  finish_reason     : ${j.choices?.[0]?.finish_reason}`);
  console.log(`  sema              : ${semaDurumu}`);
  console.log(`  annotations       : ${(msg.annotations ?? []).length} kayit, ${url.length} url_citation`);
  console.log(`      alanlar       : ${url[0] ? Object.keys(url[0].url_citation).join(", ") : "(yok)"}`);
  console.log(`  token             : girdi ${u.prompt_tokens} / cikti ${u.completion_tokens}`);
  console.log(`  cost (bildirilen) : $${(u.cost ?? 0).toFixed(6)}`);
  console.log(`  upstream cost     : $${upstream.toFixed(6)}  -> arama kalemi $${((u.cost ?? 0) - upstream).toFixed(6)}`);
  console.log(`  liste fiyatiyla   : $${tokenMaliyeti.toFixed(6)} (yalniz kabaca karsilastirma icin)`);
  return { model, engine, ham: j };
}

const sonuclar = [];
sonuclar.push(await prob("deepseek/deepseek-v4-pro", "exa"));
sonuclar.push(await prob("anthropic/claude-sonnet-5", "native"));

mkdirSync(join(KOK, "oturum-ciktisi"), { recursive: true });
const yol = join(KOK, "oturum-ciktisi", `prob-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(yol, JSON.stringify(sonuclar, null, 2), "utf8");
const toplam = sonuclar.reduce((n, r) => n + (r?.ham?.usage?.cost ?? 0), 0);
console.log(`\nPROB TOPLAM: $${toplam.toFixed(6)}`);
console.log(`ham cevap   : ${yol}`);
