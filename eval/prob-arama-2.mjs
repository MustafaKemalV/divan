#!/usr/bin/env node
/**
 * ARAMA PROBU 2 (M2-C-7 öncesi). GERÇEK PARA HARCAR; `npm test` bunu koşmaz.
 *
 *   node eval/prob-arama-2.mjs
 *
 * Neden ikinci bir prob: 11 Eylül probu (`eval/prob-arama.mjs`) KISA bir soruyla koşuldu ve eski
 * web eklentisinin sorguyu PROMPT'UN TAMAMINDAN türettiğini göremedi. Divan'ın gerçek denetim
 * çağrısı 35k karakterlik README metinleriyle başlıyor; o prompt'un tamamı Exa'ya sorgu olarak
 * gidince arama anlamsızlaşıyor. Bu prob aynı çağrıyı GERÇEK UZUNLUKTA kurar ve üç kolu ölçer.
 *
 * Üç kol, aynı kullanıcı mesajı (ek belgelerin tam metni + 7 Eylül'ün F4 fizibilite metinleri),
 * aynı sistem mesajı (Denetçi kimliği + F4 denetim talimatı), aynı gerçek denetim şeması:
 *
 *   (i)   eski eklenti      deepseek-v4-pro + plugins:[{id:"web",engine:"exa",max_results:5}]
 *   (ii)  sunucu aracı      deepseek-v4-pro + tools:[{type:"openrouter:web_search",...}]
 *   (iii) sunucu aracı      openai/gpt-5.1 (Müh-1 de F4'te arayacak; iki aile bir arada)
 *
 * ÖLÇÜM YALNIZCA; karar bu betikte verilmez. Ham cevaplar `oturum-ciktisi/`a yazılır.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const KOK = process.cwd();
const anahtar = (readFileSync(join(KOK, ".env.local"), "utf8").match(/OPENROUTER_API_KEY\s*=\s*(\S+)/) ?? [])[1];
if (!anahtar) {
  console.error(".env.local icinde OPENROUTER_API_KEY yok.");
  process.exit(2);
}

const { schemaForPhase } = await import(join(KOK, "src/core/graph/schemas.ts"));
const { validateAudit } = await import(join(KOK, "src/core/graph/audit.ts"));
const { loadIdentity, loadPrompt } = await import(join(KOK, "src/core/prompts/load.ts"));
const sema = schemaForPhase("F4:audit");

// --- Kullanıcı mesajı: GERÇEK çağrının biçimi ve uzunluğu -------------------------------------
const EKLER = ["webhook-verify", "audit-chain", "idem-client"].map((ad) => ({
  name: `${ad}/README.md`,
  content: readFileSync(join(homedir(), "Desktop", "Projects", ad, "README.md"), "utf8"),
}));

/** 7 Eylül koşumunun F4 fizibilite metinleri: denetimin gerçekte gördüğü bağlam. */
const fizibilite = readFileSync(join(KOK, "oturum-ciktisi", "oturum-2026-09-07T12-46-45-900Z.jsonl"), "utf8")
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l))
  .flatMap((e) => e.entries ?? [])
  .filter((k) => k.phase === "F4:feasibility")
  .map((k) => `${k.seatId}: ${k.content}`)
  .join("\n");

const KULLANICI = [
  ...EKLER.map((e) => `EK BELGE (${e.name}):\n${e.content}`),
  `BAĞLAM (önceki fazın özeti veya bu faz içi metin):\n${fizibilite}`,
].join("\n\n");

const SISTEM = `${loadIdentity("auditor")}\n\n---\n\n${loadPrompt("auditor", "F4:audit")}`;

const FIYAT = { "deepseek/deepseek-v4-pro": [0.96, 1.91], "openai/gpt-5.1": [1.25, 10.0] };

async function prob(etiket, model, ekGovde) {
  const body = {
    model,
    messages: [
      { role: "system", content: SISTEM },
      { role: "user", content: KULLANICI },
    ],
    max_tokens: 8192,
    response_format: { type: "json_schema", json_schema: { name: sema.name, strict: true, schema: sema.schema } },
    ...ekGovde,
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
  const govdeMetni = await res.text();
  if (!res.ok) {
    console.log(`\n### ${etiket}  (${model}) -> HTTP ${res.status}`);
    console.log(`  ${govdeMetni.slice(0, 400)}`);
    return { etiket, model, http: res.status, hata: govdeMetni.slice(0, 2000) };
  }
  const j = JSON.parse(govdeMetni);
  const msg = j.choices?.[0]?.message ?? {};
  const u = j.usage ?? {};
  const url = (msg.annotations ?? []).filter((a) => a.type === "url_citation");

  let semaDurumu;
  try {
    const v = validateAudit(JSON.parse(msg.content ?? ""));
    semaDurumu = v.ok ? `GECERLI (${v.audit.claims.length} iddia)` : `GECERSIZ: ${v.reason}`;
  } catch (e) {
    semaDurumu = `AYRISTIRILAMADI: ${String(e.message).slice(0, 60)}`;
  }

  const upstream = u.cost_details?.upstream_inference_cost ?? 0;
  const aramaKalemi = (u.cost ?? 0) - upstream;
  const [pin, pout] = FIYAT[model] ?? [0, 0];

  console.log(`\n### ${etiket}  (${model})  HTTP ${res.status}  ${sure} sn`);
  console.log(`  finish_reason      : ${j.choices?.[0]?.finish_reason}`);
  console.log(`  sema               : ${semaDurumu}`);
  console.log(`  annotations        : ${url.length} url_citation`);
  for (const a of url) {
    let host = "(cozulemedi)";
    try {
      host = new URL(a.url_citation.url).hostname;
    } catch {
      /* bozuk URL: oldugu gibi gosterilir */
    }
    console.log(`      - ${host.padEnd(28)} ${String(a.url_citation?.title ?? "(baslik yok)").slice(0, 70)}`);
  }
  console.log(`  server_tool_use    : ${JSON.stringify(u.server_tool_use ?? null)}`);
  console.log(`  token              : girdi ${u.prompt_tokens} / cikti ${u.completion_tokens}`);
  console.log(`  cost               : $${(u.cost ?? 0).toFixed(6)}  (upstream $${upstream.toFixed(6)})`);
  console.log(`  arama kalemi       : $${aramaKalemi.toFixed(6)}  (~$0.007 x ${(aramaKalemi / 0.007).toFixed(1)})`);
  console.log(`  liste fiyatiyla    : $${(((u.prompt_tokens ?? 0) * pin + (u.completion_tokens ?? 0) * pout) / 1e6).toFixed(6)}`);
  return { etiket, model, http: res.status, sure, ham: j };
}

console.log(`Kullanici mesaji: ${KULLANICI.length} karakter (uc ek + ${fizibilite.length} krk fizibilite)`);
console.log(`Sistem mesaji   : ${SISTEM.length} karakter`);

const sonuclar = [];
sonuclar.push(await prob("(i) ESKI EKLENTI", "deepseek/deepseek-v4-pro", {
  plugins: [{ id: "web", engine: "exa", max_results: 5 }],
}));

const sunucuAraci = {
  tools: [
    {
      type: "openrouter:web_search",
      parameters: { engine: "exa", max_uses: 3, max_results: 5, max_characters: 2000 },
    },
  ],
  max_tool_calls: 3,
};
sonuclar.push(await prob("(ii) SUNUCU ARACI", "deepseek/deepseek-v4-pro", sunucuAraci));
sonuclar.push(await prob("(iii) SUNUCU ARACI", "openai/gpt-5.1", sunucuAraci));

mkdirSync(join(KOK, "oturum-ciktisi"), { recursive: true });
const yol = join(KOK, "oturum-ciktisi", `prob-arama2-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(yol, JSON.stringify(sonuclar, null, 2), "utf8");
const toplam = sonuclar.reduce((n, r) => n + (r?.ham?.usage?.cost ?? 0), 0);
console.log(`\nPROB TOPLAM: $${toplam.toFixed(6)}`);
console.log(`ham cevap   : ${yol}`);
