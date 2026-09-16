// Konsey grafı (DESIGN §5). İki yol: TAM KURUL (7 koltuk, F0-F5) ve KÜÇÜK KURUL (3 ajan, F1/F3
// ve revizyon döngüsü atlanır); ayrım F0 triyajında verilir. 3 planlı kapı (interrupt) + 3
// olay-tetikli dönüş (bütçe, erken brifing, hüküm eksik) + F4 revizyon/savunma döngüsü (mekanik
// kapanma, revision.ts) + erken-uzlaşı kilidi (lock.ts). Ajanlar STUB (M2 gerçek).
// Çekirdek/UI ayrımı korunur: sıfır React/Next importu.

import { StateGraph, START, END, interrupt } from "@langchain/langgraph";
import {
  DivanState,
  type CallRecord,
  type DivanStateType,
  type JudgmentItem,
  type TranscriptEntry,
} from "./state.ts";
import { StubSeatRunner, type SeatRunner } from "./seatRunner.ts";
import { getCheckpointer } from "./checkpointer.ts";
import { earlyConsensusLockRouter } from "./lock.ts";
import { revisionLoopRouter, countBlockingUnmet } from "./revision.ts";
import { isOverBudget } from "./budget.ts";
import { validateAudit } from "./audit.ts";
import type { SeatRunInput, SeatRunOutput } from "./seatRunner.ts";
import { usageOf, formatUsd, toNanoUsd } from "./usage.ts";
import { estimatePhaseCost } from "./estimate.ts";
import { runPhaseSeats, type SeatOutcome } from "./phaseRun.ts";
import { anonymizeSummary, maskSeatNames, speakingSeats, validateSummary } from "./summary.ts";
import { shuffleBySeed } from "./shuffle.ts";
import { renderAudit, renderJudgment } from "./render.ts";
import { cancelReason, contractViolation, matchGateAnswer } from "./gate.ts";
import { buildEnvelope, defenseContext, latestSummary, rankingContext, rawOfPhase as rawOf } from "./context.ts";
import { fazAnahtari } from "./requestBuilder.ts";

/** Faz ham metni (özet kayıtları dışlanır, bkz. context.ts). */
function rawOfPhase(state: DivanStateType, phasePrefix: string): string {
  return rawOf(state.transcript, phasePrefix);
}

/** İleri taşınan tek bağlam: o fazın SON BD özeti (bkz. context.ts). */
function summaryOf(state: DivanStateType, phase: string): string {
  return latestSummary(state.phaseSummaries, phase);
}
import { SEATS } from "../seats/seats.ts";
import { loadConfig } from "../config/load.ts";

// DESIGN §4/§5 koltuk rolleri per faz (tam kurul).
const IDEATORS = ["visionary", "market", "engineer1", "architect"] as const; // F2/F3
const FEASIBILITY = ["engineer1", "engineer2", "architect"] as const; // F4 değerlendirme
const DEFENDERS = ["engineer1", "architect"] as const; // F4 revizyon/savunma turu
const RANKERS = ["market", "engineer1", "architect", "auditor"] as const; // F5 sıralama

// Küçük kurul (DESIGN §5: 3 ajan = Öneren + Ölçen + İtiraz eden, BD moderatör).
// Denetçi ÜRETİM turuna girmez: §3'teki "erken eleştiri üretimi bastırır" mekanizması her iki
// yolda da açık kalmalı. Denetçi küçük kurulda denetim, hüküm ve sıralama turlarında konuşur;
// bu, seats.ts'teki faz spec'iyle de birebir hizalıdır (auditor: F1, F4, F5).
const SMALL_IDEATORS = ["visionary", "engineer1"] as const;
const SMALL_RANKERS = ["engineer1", "auditor"] as const;

/**
 * Bütçe kapısı (DESIGN §5 dönüş a): PAHALI fazın İLK satırında çağrılır, faz daha başlamadan
 * "bu faz koşarsa tavan aşılacak mı" diye sorar.
 *
 * Yanıt sözleşmesi ÜÇ seçenektir ve payload bunları listeler: `devam`, bir SAYI (yeni tavan),
 * `iptal`. Tanınmayan yanıt akışı SÜRDÜRMEZ, kapı gerekçesiyle yeniden açılır: yazım hatası bir
 * onay yerine geçemez.
 *
 * Payload iki ayrı blok taşır ve ikisi ASLA aynı statüde sunulmaz: `kesin` (çağrı sayıları, ölçülen)
 * ve `kestirim` (koltuk ortalamalarından türetilen para tahmini). Çağrı adedi tavanı yapısal frendir
 * ve para tavanına çevrilmez; kestirim yalnız Şah'ın kapıda gördüğü bilgidir.
 */
function budgetStop(
  state: DivanStateType,
  nextCost: number,
  at: string,
  seats: readonly string[],
  node: string,
): { maxCalls?: number; abort?: boolean; abortReason?: string } {
  if (!isOverBudget(state, nextCost)) return {};

  const est = estimatePhaseCost(seats, state.seatCostNano, state.seatCostCalls);
  const payload = {
    gate: "BUTCE",
    at,
    kabulEdilen: ["devam", "<yeni tavan sayısı>", "iptal"],
    kurtarma: `Akış durursa re-table ile "${node}" düğümünden devam edilebilir; durum korunur.`,
    kesin: { kosanCagri: state.callCount, fazCagriSayisi: nextCost, tavan: state.maxCalls },
    kestirim: {
      etiket: "KESTİRİM, ölçüm değil: bu oturumda gözlenen koltuk ortalamalarından türetildi",
      fazMaliyetiUsd: formatUsd(est.nanoUsd),
      gozlenenKoltuk: est.observedSeats,
      gozlemsizKoltuk: est.unobservedSeats,
      oturumMaliyetiUsd: formatUsd(state.costNanoUsd),
    },
  };

  const answer: unknown = interrupt(payload);

  if (typeof answer === "number" && Number.isFinite(answer) && answer > 0) {
    return { maxCalls: Math.floor(answer) };
  }
  const text = String(answer ?? "").trim().toLowerCase();
  if (text === "devam") return {};
  if (text === "iptal") return { abort: true };
  const parsed = Number(text);
  if (Number.isFinite(parsed) && parsed > 0) return { maxCalls: Math.floor(parsed) };

  // Sözleşme dışı yanıt akışı SÜRDÜRMEZ: oturum güvenli tarafta, SEBEBİ YAZILI olarak durur.
  //
  // Neden kapı yeniden açılmıyor: denendi, LangGraph'ın resume semantiğiyle çalışmadı. Düğüm
  // kendine döndürüldüğünde kapı gerçekten yeniden açılıyor, ama Şah'ın İKİNCİ yanıtı bekleyen
  // interrupt'a ulaşmıyor ve akış sürüyordu; yani "iptal" denmesine rağmen fazlar koşuyordu.
  // Sessiz sürdürme, kaba durdurmadan kötüdür. Kapının ayrı bir düğüme çıkarılması (kilit
  // kapıları gibi) envantere borç yazıldı; yeniden-sorma davranışı orada geri gelecek.
  return {
    abort: true,
    abortReason:
      `Yanıt sözleşmeye uymadı ("${String(answer)}"), akış sürdürülmedi. ` +
      `Kabul edilenler: devam | bir sayı | iptal. ` +
      `KURTARMA: bu oturum kapanmadı, re-table ile "${node}" düğümünden devam edebilirsiniz; ` +
      `durum ve çağrı sayacı korunur.`,
  };
}

/**
 * Bütçe kapısında akış durduruldu mu? Durduysa faz çıkışı END'e gider. Tek yazma noktası
 * budgetStop'tur; endReason dolu ise oturum Şah'ın kararıyla kapanmış demektir.
 */
function abortRouter(state: DivanStateType): "abort" | "devam" {
  return state.endReason ? "abort" : "devam";
}

/**
 * §6.4: revizyon döngüsü muhalefeti buharlaştıramaz. Bir turda blocking "karsilanmadi" işaretlenip
 * son turda düşen madde, o turdaki HAM metniyle iz bırakır. Tur numarası dizin sırasından değil
 * KAYDIN KENDİSİNDEN alınır: araya boş tur girdiğinde dizin kayar.
 */
function dusenItirazlar(state: DivanStateType): string[] {
  const acik = new Set(
    state.judgment.filter((j) => j.blocking && j.status === "karsilanmadi").map((j) => j.criterion),
  );
  const gorulen = new Set<string>();
  const out: string[] = [];
  for (const tur of state.judgmentHistory) {
    for (const item of tur.items) {
      if (!item.blocking || item.status !== "karsilanmadi") continue;
      if (acik.has(item.criterion) || gorulen.has(item.criterion)) continue;
      gorulen.add(item.criterion);
      out.push(`[tur ${tur.round}] ${item.criterion}: ${item.rawText}`);
    }
  }
  return out;
}

/** F0 triyajının kurduğu yol ayrımı; iki yerde kullanılır (kapı 1 sonrası, kilit retry). */
function modeRouter(state: DivanStateType): "full" | "small" {
  return state.councilMode === "small" ? "small" : "full";
}

/**
 * Denetim çağrısı + §6 İADE SEMANTİĞİ. Beyan bütünlüğü ilkesi gereği geçersiz bir çıktıyı
 * DÜZELTMEYİZ: aynı koltuğa reddin gerekçesiyle bir kez iade ederiz. İlk denemenin HAM hali
 * transkriptte kalır (silinmez), ve iade çağrısı bütçe sayacına yazılır: iade bedavaya gelmez.
 * İkinci çıktı da geçersizse akış durur ve DENETIM_EKSIK kapısıyla Şah'a çıkar.
 */
/**
 * Faz kapı (§6.2): bir denetimde en çok kaç arama yapılabilir. Config okunamazsa varsayılan 3;
 * kapın kendisi bir fren olduğu için config hatası yüzünden SINIRSIZ aramaya düşmek yanlış olurdu.
 */
function perPhaseCapOku(): number {
  try {
    return loadConfig().search.perPhaseCap;
  } catch {
    return 3;
  }
}

async function runAuditWithReturn(
  run: (seatId: string, input: SeatRunInput) => Promise<SeatRunOutput>,
  state: DivanStateType,
  phase: string,
  context: string,
) {
  const entries: TranscriptEntry[] = [];
  const outs: SeatRunOutput[] = [];
  // Denetim de gerçek metni okur (DESIGN §5): kaynağı görmeden topraklama denetlenemez.
  const attachments = state.attachments;

  /**
   * ALTYAPI ARIZASI (kesilme) dalı. İADE İŞLEMEZ: iade, koltuğu kendi çıktısını düzeltmeye
   * çağırmaktır; kesilmiş bir cevapta düzeltilecek bir çıktı yoktur ve aynı tavanla yeniden
   * sormak aynı yere çarpar. Koltuğun şema disiplini siciline de yazılmaz.
   *
   * T3-4: bu dal önce YALNIZ ilk çağrıda vardı. İade çağrısı korumasızdı ve orada gelen bir
   * kesilme düğümü çökertiyordu; çökünce flushUsage hiç koşmadığı için harcanan para da
   * kayboluyordu. Kesilme nerede olursa olsun aynı arızadır.
   */
  const altyapiArizasi = (e: unknown, calls: number, iade: number) => ({
    auditComplete: false,
    auditIssue: (e as Error).message,
    // İADE SAYISI ADIM SAYISI DEĞİLDİR: sorgu ve arama turları da bu fonksiyonun çağrılarıdır ama
    // hiçbiri "koltuğa kendi çıktısını düzelttirme" değildir. İkisi tek sayaçta toplanırsa Şah
    // denetimin kaç kez reddedildiğini okuyamaz; ayrıca kapı 3 notu yanlış sayı gösterir.
    auditRetries: iade,
    infraFailures: [`${phase}/auditor`],
    transcript: [...entries, { phase, seatId: "auditor", content: `[ALTYAPI ARIZASI: ${(e as Error).message}]` }],
    callCount: calls,
  });
  const kesilme = (e: unknown) => (e as Error).name === "TruncatedResponseError";

  // ============ ADIM 1: SORGU TURU (§6.2 M2-C) ============
  // Denetçi, denetim bağlamının tamamını görerek arama SORGULARINI üretir. Ayrı bir çağrı, çünkü
  // sorgu üretmek denetim yapmak değildir: aynı çağrıda ikisini birden istemek, modeli henüz
  // aramadığı şey hakkında hüküm vermeye çağırır.
  //
  // Kendi prompt dosyası var (`auditor-F4-audit-queries.md`): denetim talimatı burada YANLIŞ olurdu,
  // çünkü bu turda istenen çıktı premortem ve iddia değil, sorgu listesi. D-1 önbelleği yine çalışır:
  // kimlik ve zarf+fikir+ek özeti blokları üç çağrıda da aynı, ayrışma faz talimatında başlıyor.
  //
  // EK BELGELERİN TAM METNİ GİTMEZ (§5 kapsamı: F0 brifingi, F4 fizibilite, F4 denetim). Sorgu
  // üretmek için gereken şey iddiaların kendisi, yani bağlam; ek özeti zaten sabit ön ekte duruyor.
  const aramaKapi = perPhaseCapOku();
  let sorgular: string[] = [];
  let sorguNotu = "";
  try {
    const sorguCikti = await run("auditor", {
      phase: `${phase}:queries`,
      idea: state.idea,
      context: `${context}\n\nADIM 1: yalnız arama sorgularını üret. Denetimi bu turda VERME.`,
      retry: 0,
    });
    const ham = (sorguCikti.data?.queries as string[] | undefined) ?? [];
    sorgular = ham.map((q) => String(q).trim()).filter(Boolean).slice(0, aramaKapi);
    entries.push({
      phase: `${phase}:queries`,
      seatId: "auditor",
      content: sorgular.length
        ? `ARAMA SORGULARI (${sorgular.length}):\n${sorgular.map((q) => `- ${q}`).join("\n")}`
        : `[SORGU ÜRETİLEMEDİ] ${sorguCikti.content}`,
    });
    if (ham.length > aramaKapi) {
      sorguNotu = `${ham.length - aramaKapi} sorgu kap yüzünden aranmadı (faz kapı ${aramaKapi})`;
    }
    if (!sorgular.length) sorguNotu = "sorgu üretilemedi: denetim aramasız koşuyor";
  } catch (e) {
    // SORGU TURU DENETİMİ DÜŞÜRMEZ (H-3). Eskiden kesilme dışı her hata düğümü çökertiyor,
    // kesilme ise bütün denetimi ALTYAPI ARIZASI sayıyordu. İkisi de orantısızdı: henüz denetim
    // DENENMEDİ, kaybedilen yalnız topraklama. Denetim aramasız koşar ve rozet imkansız olur
    // (izinli küme boş), yani kayıp Şah'ın karar ekranında görünür, sessizce yutulmaz.
    sorgular = [];
    sorguNotu = `sorgu turu başarısız: ${(e as Error).message}`;
    entries.push({
      phase: `${phase}:queries`,
      seatId: "auditor",
      content: `[SORGU TURU BAŞARISIZ: ${(e as Error).message}]`,
    });
  }
  let calls0 = 1;

  // ============ ADIM 2: ARAMA (kod yapar) ============
  // Her sorgu için TEK ve KISA bir çağrı: kullanıcı mesajı yalnız sorgudur. Eklentinin sorguyu
  // prompt'tan türetmesi böyle engellenir (15 Eylül probu: 35k karakterlik prompt'ta alakasız
  // sonuçlar). Sıralı koşar: kap sayımı eşzamanlılıkta yanılmasın.
  const sonuclar: { url: string; title?: string; content?: string }[] = [];
  let basarisizArama = 0;
  for (const sorgu of sorgular) {
    try {
      const aramaCikti = await run("auditor", { phase: `${phase.replace(":audit", ":search")}`, idea: state.idea, context: sorgu, retry: 0 });
      calls0++;
      for (const c of aramaCikti.citations ?? []) {
        if (!sonuclar.some((x) => x.url === c.url)) sonuclar.push(c);
      }
    } catch (e) {
      // ARAMA ÇAĞRISI DA DÜŞÜRMEZ (H-3). Ağ, 5xx, 402: hepsi aynı şey, o sorgunun cevabı yok.
      // Çağrı SAYILIR (`run` onu tamponda `failed` işaretiyle kaydetti, faturası varsa oradadır)
      // ve KALAN SORGULARLA DEVAM EDİLİR: üç sorgudan birinin patlaması, öbür ikisinin sonucunu
      // çöpe atmak için sebep değil.
      calls0++;
      const ne = kesilme(e) ? "bir arama çağrısı kesildi" : `arama başarısız: ${(e as Error).message}`;
      basarisizArama++;
      sorguNotu = `${sorguNotu ? `${sorguNotu}; ` : ""}${ne}`;
    }
  }
  if (sorgular.length) {
    entries.push({
      phase: `${phase.replace(":audit", ":search")}`,
      seatId: "auditor",
      content:
        (sonuclar.length
          ? `ARAMA SONUÇLARI (${sonuclar.length}):\n${sonuclar.map((r) => `- ${r.url} | ${r.title ?? "(başlık yok)"}`).join("\n")}`
          : "[ARAMA SONUÇ VERMEDİ]") +
        // Başarısız çağrı transkriptte GÖRÜNÜR: "iki sorgudan biri patladı" ile "iki sorgu da boş
        // döndü" aynı sonuç kümesini üretir ama aynı şey değildir, ve farkı yalnız burası söyler.
        (basarisizArama ? `\n[${basarisizArama} arama çağrısı başarısız]` : ""),
    });
  }

  // ============ ADIM 3: DENETİM ============
  // Aynı bağlam + arama sonuçları. "dogrulanmis" yalnız bu kümeden ve ALINTIYLA hak edilir.
  const sonucBlogu = sonuclar.length
    ? `\n\nARAMA SONUÇLARI (yalnız bunlar "dogrulanmis" sayılabilir):\n${sonuclar
        .map((r) => `- ${r.url} | ${r.title ?? ""} | ${(r.content ?? "").slice(0, 2000)}`)
        .join("\n")}`
    : `\n\nARAMA SONUCU YOK${sorguNotu ? ` (${sorguNotu})` : ""}: bu denetimde hiçbir iddia "dogrulanmis" olamaz.`;
  const denetimBaglami = `${context}${sonucBlogu}\n\nADIM 2: denetimi ver.`;

  let first: SeatRunOutput;
  try {
    first = await run("auditor", { phase, idea: state.idea, context: denetimBaglami, attachments, retry: 0 });
  } catch (e) {
    if (!kesilme(e)) throw e;
    return altyapiArizasi(e, calls0 + 1, 0);
  }
  outs.push(first);
  // İZİNLİ KÜME: ADIM 2'nin sonuçları. Sorgu turu şema üretemediyse (sorgular boş) arama hiç
  // yapılmadı demektir; o zaman liste BOŞ verilir, `undefined` değil: "arandı, sonuç yok" ile
  // "hiç aranmadı" arasındaki fark burada kaybolmaz ve her iki halde de "dogrulanmis" imkansızdır.
  const izinli = sorgular.length || sonuclar.length ? sonuclar : [];
  let check = validateAudit(first.data, izinli);
  // SADIK TRANSKRİPT (T3-1): geçerli denetim, doğrulanmış İÇERİĞİYLE yazılır. Önceden yalnız
  // `first.content` (yani data.summary) giriyordu ve premortem, iddialar, kaynaklar doğrulandığı
  // yerde ölüyordu. Geçersiz çıktı DÜZELTİLMEZ, ham haliyle ve gerekçesiyle kalır (§6).
  entries.push({
    phase,
    seatId: "auditor",
    content: check.ok ? renderAudit(check.audit, sonuclar) : `[GEÇERSİZ: ${check.reason}] ${first.content}`,
  });
  let calls = calls0 + 1;
  let iade = 0;

  if (!check.ok) {
    let second: SeatRunOutput;
    try {
      second = await run("auditor", {
        phase,
        idea: state.idea,
        // İade YENİ ARAMA YAPMAZ: aynı sonuç kümesiyle yeniden sorulur. Sonuçlar bağlamda zaten
        // duruyor (denetimBaglami), üstüne yalnız reddin gerekçesi eklenir.
        context:
          `${denetimBaglami}\n\nİADE GEREKÇESİ (çıktın reddedildi, aynı denetimi bu eksiği gidererek yeniden ver): ` +
          `${check.reason}`,
        attachments,
        retry: 1,
      });
    } catch (e) {
      if (!kesilme(e)) throw e;
      return altyapiArizasi(e, calls0 + 2, 1);
    }
    // Sabit "2" DEĞİL: adım 1 ve adım 2'nin çağrıları da harcandı. Sabit yazıldığında iade,
    // bütçeye çağrı EKLEMEK yerine ondan düşüyordu (arama kolunda 29, iade kolunda 27).
    calls = calls0 + 2;
    iade = 1;
    outs.push(second);
    // İADE, İLK ÇAĞRININ kümesiyle yargılanır. İade yeni arama YAPMAZ (M2-C-2), dolayısıyla
    // `second.searchRequested` false ve `izinli(second)` undefined olur; o da eski biçim
    // kontrolüne düşmek, yani hafızadan yazılmış bir URL'nin İADEDE rozet alması demekti.
    // Koltuğa gönderilen iade gerekçesi de zaten ilk çağrının sonuçlarını taşıyor: aynı kümeyle
    // sorulan bir soru, aynı kümeyle yargılanmalı.
    check = validateAudit(second.data, izinli);
    entries.push({
      phase,
      seatId: "auditor",
      content: check.ok
        ? `[İADE SONRASI]\n${renderAudit(check.audit, sonuclar)}`
        : `[İADE SONRASI DA GEÇERSİZ: ${check.reason}] ${second.content}`,
    });
  }

  return {
    auditComplete: check.ok,
    auditIssue: check.ok ? "" : check.reason,
    ...(sorguNotu ? { groundingNotes: [`${phase}: ${sorguNotu}`] } : {}),
    auditRetries: iade,
    // Yapılandırılmış hali de state'e yazılır; yalnız GEÇERLİ olan (§6: geçersiz çıktı taşınmaz).
    audit: check.ok ? check.audit : null,
    transcript: entries,
    callCount: calls,
  };
}

export function buildCouncilGraph(runner: SeatRunner = new StubSeatRunner()) {
  // Her koltuk çağrısı buradan geçer; düğüm dönüşünde flushUsage() ile maliyet state'e yazılır.
  // Tampon düğüm-yereldir (graf düğümleri sırayla koşar); bir düğüm boşaltmayı atlarsa maliyet
  // kaybolmaz, yalnız bir sonraki düğüme yazılır.
  const buffer: Array<{ seatId: string; phase: string; attempt: number; failed?: boolean; out: SeatRunOutput }> = [];
  /**
   * Her koltuk çağrısı buradan geçer. İki iş burada yapılır ve düğümlere bırakılmaz:
   * OTURUM ZARFI eklenir (DESIGN §5 D-2: çerçeve her çağrıya gider) ve kullanım kaydı tutulur.
   * Zarfı düğümlere bırakmak, bir düğümde unutulduğunda sessizce çerçevesiz çağrı demekti.
   */
  const run = async (
    state: DivanStateType,
    seatId: string,
    input: SeatRunInput,
  ): Promise<SeatRunOutput> => {
    // Faz kapı (§6.2): bu fazda ŞU ANA KADAR kaç arama yapıldı. State'teki tamamlanmış çağrılar
    // artı bu düğümün tamponu. Eşzamanlı çağrılar aynı sayıyı okur; sınır `SeatRunInput` üzerinde
    // yazılı.
    const anahtar = fazAnahtari(input.phase);
    const fazdakiArama =
      state.callLog.filter((c) => fazAnahtari(c.phase) === anahtar && c.searchResultCount !== undefined).length +
      buffer.filter((b) => fazAnahtari(b.phase) === anahtar && b.out.searchRequested).length;
    const zarfli: SeatRunInput = {
      ...input,
      searchesInPhase: fazdakiArama,
      envelope: buildEnvelope(
        {
          ideaSummary: state.ideaSummary,
          selectedHmw: state.selectedHmw,
          frameObjection: state.frameObjection,
          approvedFrame: state.approvedFrame,
          attachmentSummary: state.attachmentSummary,
        },
        input.phase,
      ),
    };
    // Deneme numarası: çağıran söylüyorsa ONUN söylediği (paralel faz döngüsü, C-3), yoksa düğüm
    // içinde sayılır. Tampondan saymak yalnız SIRALI çağrılarda doğrudur; iade çağrıları öyledir,
    // yeniden denemeler değil: iptal edilen denemenin hatası zincirin dibinden yukarı çıkarken
    // ikinci deneme çoktan başlamış olur ve tamponu boş görür.
    const attempt =
      input.attempt ?? buffer.filter((b) => b.seatId === seatId && b.phase === input.phase).length + 1;
    try {
      const out = await runner.run(seatId, zarfli);
      buffer.push({ seatId, phase: input.phase, attempt, out });
      return out;
    } catch (e) {
      // Başarısız deneme de bir çağrıdır ve HER ZAMAN kaydedilir. Hata harcanan parayı taşıyorsa
      // (kesilme) maliyet bilinir; taşımıyorsa (zaman aşımı, bağlantı) usage boş kalır ve sayaç
      // onu "maliyeti bilinmeyen" olarak sayar. Kaydı burada tutmak, aynı denemenin bir de düğüm
      // tarafından ikinci kez sayılmasını gereksiz kılar (M2-A3 U-7 çift sayımı).
      const usage = (e as { usage?: SeatRunOutput["usage"] }).usage;
      buffer.push({ seatId, phase: input.phase, attempt, failed: true, out: { content: "", usage } });
      throw e;
    }
  };
  /**
   * Bir fazın koltuklarını PARALEL koşturur ve state güncellemesini hazırlar (DESIGN §7).
   * Sonuçlar kanonik sırada gelir; susan koltuk transkripte "KOLTUK SUSTU" olarak yazılır,
   * çıktısı UYDURULMAZ. Başarısız deneme "maliyeti bilinmeyen çağrı" olarak sayılır.
   */
  /**
   * TEK KOLTUKLU düğümün çağrısı (M2-A3 T4-3). Paralel fazların korkulukları (zaman aşımı, tek
   * yeniden deneme, kesilme dalı) yalnız çok koltuklu fazlarda vardı; tek koltuklu düğümlerde
   * hiçbiri yoktu. Sonucu 9 Eylül koşumunda görüldü: taslak çağrısı tavana çarptı, düğüm çöktü,
   * `flushUsage` hiç koşmadı ve o çağrının FATURASI hiçbir yere yazılmadı (C-8).
   *
   * Aynı korkulukları tek koltuk için de `runPhaseSeats` üzerinden kullanırız: iki ayrı yeniden
   * deneme mantığı yazmak, ikisinin zamanla ayrışması demektir.
   */
  /**
   * OMURGA DÜĞÜMÜ SUSTU (Şah kararı, K-2). Bazı düğümlerin çıktısı olmadan akış anlamını yitirir:
   * brifingsiz bir oturumda zarf boş, HMW'siz bir KAPI 1'de seçenek yok, çerçevesiz bir F2'de
   * müzakere konusu yok. Bunları yer tutucu metinle SÜRDÜRMEK, kurulun görmediği bir şey hakkında
   * konuşmasıdır; oturum sebebiyle DURUR ve re-table ile kurtarılır.
   *
   * Hüküm düğümleri bunun DIŞINDADIR: boş hüküm için erken-uzlaşı kilidi ve HUKUM_EKSIK kapısı
   * zaten var, ikinci bir durma mekanizması onları çakıştırırdı.
   */
  const omurgaDurdu = (ne: string, dugum: string, sebep?: string) =>
    `${ne} alınamadı: ${sebep ?? "cevap yok"}. KURTARMA: re-table ile "${dugum}" düğümünden ` +
    `devam edilebilir; durum ve çağrı sayacı korunur.`;

  /** Tek koltuklu düğümde cevap gelmediyse kayıt SESSİZ geçilmez: sebebiyle transkripte yazılır. */
  const icerik = (out?: SeatRunOutput, sebep?: string) =>
    out?.content ?? `[KOLTUK SUSTU: ${sebep ?? "cevap yok"}]`;

  const runTek = async (
    state: DivanStateType,
    seatId: string,
    input: SeatRunInput,
  ): Promise<{ out?: SeatRunOutput; reason?: string; update: Record<string, unknown> }> => {
    const [o] = await runPhaseSeats(
      (id, inp) => run(state, id, inp),
      [seatId],
      () => input,
      state.perCallTimeoutMs,
    );
    return {
      out: o.out,
      reason: o.reason,
      update: {
        ...flushUsage(),
        callCount: o.attempts,
        // Susma ile ALTYAPI arızası ayrı kalemlerdir: koltuk susmadıysa susmuş gösterilmez.
        ...(o.silent && !o.infraFailure ? { silentSeats: [`${input.phase}/${seatId}`] } : {}),
        ...(o.infraFailure ? { infraFailures: [`${input.phase}/${seatId}: ${o.reason ?? "kesilme"}`] } : {}),
      },
    };
  };

  const runPhase = async (
    state: DivanStateType,
    phase: string,
    seats: readonly string[],
    inputFor: (seat: string) => SeatRunInput,
  ): Promise<{ outcomes: SeatOutcome[]; update: Record<string, unknown> }> => {
    const outcomes = await runPhaseSeats(
      (seatId, input) => run(state, seatId, input),
      seats,
      inputFor,
      state.perCallTimeoutMs,
    );
    // Cevapsız denemenin maliyeti BİLİNMİYORDUR, asla sıfır. Ama bilinen bir maliyeti de
    // "bilinmiyor" saymak yanlıştır: kesilen çağrı harcadığı parayı hatayla birlikte taşır ve
    // izleyici onu zaten kaydeder. Buradaki sayım tek kaynaktan, izleyiciden gelir.
    const usage = flushUsage();
    return {
      outcomes,
      update: {
        ...usage,
        transcript: outcomes.map((o) => ({
          phase,
          seatId: o.seatId,
          content: o.out ? o.out?.content : `[KOLTUK SUSTU: ${o.reason ?? "cevap yok"}]`,
        })),
        callCount: outcomes.reduce((n, o) => n + o.attempts, 0),
        // Faz adıyla birlikte: aynı koltuk farklı fazlarda sustuysa ikisi de görünür kalır.
        // ALTYAPI arızaları buraya YAZILMAZ: koltuk susmadı, altyapı kesti (§ tavan/kesilme).
        silentSeats: outcomes
          .filter((o) => o.silent && !o.infraFailure)
          .map((o) => `${phase}/${o.seatId}`),
        infraFailures: outcomes
          .filter((o) => o.infraFailure)
          .map((o) => `${phase}/${o.seatId}: ${o.reason ?? "kesilme"}`),
      },
    };
  };

  /** Maskeleme için bilinen koltuk adları (id + Türkçe başlık). */
  const seatLabels = SEATS.flatMap((s) => [s.id, s.title]);

  /**
   * F5 sıralamalarını KİMLİKSİZ hale getirir (§6.1). Ölçülen kırmızı: yalnız "market: " ön eki
   * kesiliyordu, sıralamanın METNİ içindeki koltuk adı ("...market...") olduğu gibi Baş Danışman'a
   * ve final denetime gidiyordu. Blok "SIRALAMALAR (kimliksiz)" başlığını taşıdığı için sızıntı
   * ayrıca yanıltıcıydı: söz verilen şey verilmiyordu. Ön ek kesme ve metin maskeleme artık aynı
   * yerde, iki düğüm de buradan geçiyor; ikinci bir çağrı yeri eklenirse de aynı kapıyı kullanır.
   */
  const kimliksizSiralamalar = (rankings: readonly string[], seed: string) =>
    // §6.1 KONUMSAL ANONİMLİK: numara kanonik sırada verilseydi sabit bir koltuk adresi olurdu.
    // Ölçüldü: 7 Eylül'de Baş Danışman taslağında sıralayıcı numaralarını koltuklarla eşleştirdi.
    shuffleBySeed(rankings, seed)
      .map((r, i) => `- Sıralayıcı ${i + 1}: ${maskSeatNames(r.replace(/^[^:]+:\s*/, ""), seatLabels)}`)
      .join("\n");

  /**
   * Faz özeti (DESIGN §6 özet kotası). Konuşan her koltuk özette en az bir maddeyle temsil
   * edilmek zorunda; karşılanmazsa özet BİR KEZ gerekçesiyle iade edilir. İkinci kez de eksikse
   * özet yine taşınır (akış durmaz) ama eksikliği state'e yazılır ve karar ekranında görünür:
   * susturulmuş bir görüşün sessizce kaybolması, kaba bir durmadan kötüdür.
   *
   * KAYIT hali koltuk etiketlidir (denetlenebilirlik), İLERİ TAŞINAN hali kimliksizdir (§6.1).
   */
  const runSummary = async (
    state: DivanStateType,
    phase: string,
    rawPrefix: string,
    summaryKey: string,
  ) => {
    const konusanlar = speakingSeats(state.transcript, rawPrefix);
    const context = rawOfPhase(state, rawPrefix);
    let calls = 1;
    // T3-4: özetin İKİ çağrısı da kesilme korumasızdı. Bir kesilme özet düğümünü çökertiyor,
    // çöken düğümde flushUsage koşmadığı için harcanan para da kayboluyordu. Özet üretilemezse
    // akış durmaz ama eksiklik SESSİZ de geçilmez: sonraki fazlar arızayı açıkça okur.
    const kesilmeSonucu = (e: unknown, n: number) => ({
      ...flushUsage(),
      phaseSummaries: [
        { phase: summaryKey, summary: `[ALTYAPI ARIZASI: ${phase} özeti üretilemedi, ${(e as Error).message}]` },
      ],
      transcript: [{ phase, seatId: "chiefAdvisor", content: `[ALTYAPI ARIZASI: ${(e as Error).message}]` }],
      summaryIssues: [`${phase}: altyapı arızası, özet üretilemedi`],
      infraFailures: [`${phase}/chiefAdvisor`],
      callCount: n,
    });
    const kesilme = (e: unknown) => (e as Error).name === "TruncatedResponseError";

    let out: SeatRunOutput;
    try {
      out = await run(state, "chiefAdvisor", { phase, idea: state.idea, context, seats: konusanlar });
    } catch (e) {
      if (!kesilme(e)) throw e;
      return kesilmeSonucu(e, 1);
    }
    let check = validateSummary(out?.data, konusanlar);

    if (!check.ok) {
      calls = 2;
      try {
        out = await run(state, "chiefAdvisor", {
          phase,
          idea: state.idea,
          context: `${context}\n\nİADE GEREKÇESİ (özetin reddedildi, düzelt): ${check.reason}`,
          seats: konusanlar,
          retry: 1,
        });
      } catch (e) {
        if (!kesilme(e)) throw e;
        return kesilmeSonucu(e, 2);
      }
      check = validateSummary(out?.data, konusanlar);
    }

    const kayit = check.ok
      ? check.value.points.map((p) => `- [${p.seatId}] ${p.point}`).join("\n")
      : `[ÖZET KOTASI EKSİK: ${check.reason}]\n${out?.content}`;

    return {
      ...flushUsage(),
      phaseSummaries: [
        {
          phase: summaryKey,
          summary: check.ok ? anonymizeSummary(check.value, seatLabels, state.sessionSeed) : out?.content,
        },
      ],
      // Özet KAYIT halinde koltuk etiketli tutulur: kota ancak böyle denetlenebilir.
      transcript: [{ phase, seatId: "chiefAdvisor", content: kayit }],
      summaryIssues: check.ok ? [] : [`${phase}: ${check.reason}`],
      callCount: calls,
    };
  };

  const flushUsage = () => {
    const totals = usageOf(buffer.map((b) => b.out));
    const seatCostNano: Record<string, number> = {};
    const seatCalls: Record<string, number> = {};
    const seatCostCalls: Record<string, number> = {};
    const callLog: CallRecord[] = [];
    for (const b of buffer) {
      seatCalls[b.seatId] = (seatCalls[b.seatId] ?? 0) + 1;
      const u = b.out.usage;
      if (u?.cost !== undefined) {
        seatCostNano[b.seatId] = (seatCostNano[b.seatId] ?? 0) + toNanoUsd(u.cost);
        // Kestirimin böleni: yalnız maliyeti bilinen çağrılar (F-2 seyrelmesi).
        seatCostCalls[b.seatId] = (seatCostCalls[b.seatId] ?? 0) + 1;
      }
      // Sağlayıcı bildirmediyse alan BOŞ kalır: stub koşumda uydurma sayı üretilmez.
      callLog.push({
        seatId: b.seatId,
        phase: b.phase,
        attempt: b.attempt,
        servedModel: b.out.servedModel,
        promptTokens: u?.promptTokens,
        completionTokens: u?.completionTokens,
        reasoningTokens: u?.reasoningTokens,
        cachedTokens: u?.cachedTokens,
        cacheWriteTokens: u?.cacheWriteTokens,
        costNanoUsd: u?.cost === undefined ? undefined : toNanoUsd(u.cost),
        upstreamCostNanoUsd: u?.upstreamCost === undefined ? undefined : toNanoUsd(u.upstreamCost),
        // Arama ücreti YALNIZ eklenti istenen çağrıda ayrılır: eklentisiz bir çağrıda toplam ile
        // upstream arasındaki fark sağlayıcı komisyonudur, arama değildir.
        searchCostNanoUsd:
          b.out.searchRequested && u?.cost !== undefined && u?.upstreamCost !== undefined
            ? toNanoUsd(u.cost) - toNanoUsd(u.upstreamCost)
            : undefined,
        searchResultCount: b.out.searchRequested ? (b.out.citations?.length ?? 0) : undefined,
        searchUrls: b.out.citations?.length ? b.out.citations.map((c) => c.url) : undefined,
        ...(b.failed ? { failed: true } : {}),
      });
    }
    // C-1: başarısız denemeler ayrıca sayılır. Tampon zaten `failed` işaretini taşıyordu; eksik
    // olan, bu işaretin künyeye çıkmasıydı.
    // Arama: yalnız eklenti İSTENEN çağrılar sayılır; ücret toplam maliyetin içindedir.
    const aramali = buffer.filter((b) => b.out.searchRequested);
    const searchCalls = aramali.length;
    // Tekilleştirme YOK: bu, arama çağrılarının KAÇ kaynak döndürdüğüdür. İki sorgu aynı kaynağı
    // getirdiyse arama iki kez ödendi ve iki kez döndü; künye ödenen işi gösterir. Denetime giden
    // izinli küme ayrıca tekilleştirilir (runAuditWithReturn), ikisi farklı soruların cevabı.
    const searchResults = aramali.reduce((n, b) => n + (b.out.citations?.length ?? 0), 0);
    const searchCostNanoUsd = aramali.reduce((n, b) => {
      const u = b.out.usage;
      return u?.cost !== undefined && u?.upstreamCost !== undefined
        ? n + (toNanoUsd(u.cost) - toNanoUsd(u.upstreamCost))
        : n;
    }, 0);
    const failedAttempts = buffer.filter((b) => b.failed).length;
    const failedCostNanoUsd = buffer
      .filter((b) => b.failed && b.out.usage?.cost !== undefined)
      .reduce((n, b) => n + toNanoUsd(b.out.usage!.cost!), 0);
    buffer.length = 0;
    return { ...totals, seatCostNano, seatCalls, seatCostCalls, callLog, failedAttempts, failedCostNanoUsd, searchCalls, searchResults, searchCostNanoUsd };
  };

  const graph = new StateGraph(DivanState)
    // ================= F0: brifing + triyaj + HMW (DESIGN §5: 2 çağrı) =================
    .addNode("f0_briefing", async (state: DivanStateType) => {
      // Ek belgeler BD'ye TAM METİN gider (DESIGN §5): diğer fazların göreceği özeti o üretir.
      const { out, reason: tekSebep, update: tek } = await runTek(state, "chiefAdvisor", {
        phase: "F0:briefing",
        idea: state.idea,
        attachments: state.attachments,
      });
      // OMURGA: F0 brifingi olmadan akış anlamını yitirir; yer tutucuyla sürdürülmez.
      if (!out) return { ...tek, transcript: [{ phase: "F0:briefing", seatId: "chiefAdvisor", content: icerik(out, tekSebep) }], endReason: omurgaDurdu("F0 brifingi", "f0_briefing", tekSebep) };
      // Karmaşıklık triyajı: küçük fikir -> küçük kurul yolu (§5 F0).
      const councilMode: "full" | "small" = out?.data?.complexity === "small" ? "small" : "full";
      const attachmentSummary =
        typeof out?.data?.attachmentSummary === "string" ? out?.data.attachmentSummary : "";
      // Fikir özeti zarfın ilk parçasıdır: bundan sonraki her çağrı onu görür.
      const ideaSummary = typeof out?.data?.summary === "string" ? out.data.summary : icerik(out, tekSebep);
      return {
        ...tek,
        councilMode,
        ideaSummary,
        attachmentSummary,
        transcript: [{ phase: "F0:briefing", seatId: "chiefAdvisor", content: icerik(out, tekSebep) }],
      };
    })
    .addNode("f0_hmw", async (state: DivanStateType) => {
      const { out, reason: tekSebep, update: tek } = await runTek(state, "chiefAdvisor", {
        phase: "F0:hmw",
        idea: state.idea,
        councilMode: state.councilMode,
      });
      // OMURGA: F0 HMW turu olmadan akış anlamını yitirir; yer tutucuyla sürdürülmez.
      if (!out) return { ...tek, transcript: [{ phase: "F0:hmw", seatId: "chiefAdvisor", content: icerik(out, tekSebep) }], endReason: omurgaDurdu("F0 HMW turu", "f0_hmw", tekSebep) };
      const hmw = (out?.data?.hmw as string[] | undefined) ?? [];
      return {
        ...tek,
        hmwOptions: hmw,
        transcript: [{ phase: "F0:hmw", seatId: "chiefAdvisor", content: icerik(out, tekSebep) }],
      };
    })
    // ---- KAPI 1: Şah HMW seçer ----
    .addNode("gate1_hmw", async (state: DivanStateType) => {
      const selected = interrupt({
        gate: "KAPI1",
        councilMode: state.councilMode,
        // DESIGN §5.1 ara dönem: sınıf henüz modelin KANAATİ, ölçüm değil. Kanaatin kanaat
        // olduğunu gizlemek, onu ölçüm sanmaktan daha büyük hatadır; bu yüzden kapıda işaretli.
        councilModeSource: "model-kanaati",
        // T3-7: not "Değiştirebilirsiniz" diyordu ama bu kapı YALNIZ HMW yanıtını okuyor; kadro
        // kapısı M2-B'de geliyor. Var olmayan bir yetkiyi vaat etmek, kanaati ölçüm sanmakla aynı
        // hatanın başka biçimi: ikisi de Şah'a olduğundan fazlasını gösteriyor.
        councilModeNote:
          "Kurul boyutu Baş Danışman'ın kanaati (DESIGN §5.1 ara dönem); " +
          "bu sürümde kapıdan değiştirilemez, kadro kapısı M2-B'de.",
        options: state.hmwOptions,
      }) as string;
      return { ...flushUsage(), selectedHmw: selected };
    })

    // ================= TAM KURUL =================
    // ---- F1: Denetçi çerçeve itirazı ----
    .addNode("f1_frame", async (state: DivanStateType) => {
      const { out, reason: tekSebep, update: tek } = await runTek(state, "auditor", {
        phase: "F1:frame",
        idea: state.idea,
        // T3-8: seçilen HMW oturum ZARFINDA zaten var; bağlama ikinci kez konursa aynı metin
        // tek çağrıda iki kez gider. Zarf tek kaynaktır (D-2), düğüm onu tekrarlamaz.
      });
      // OMURGA: F1 çerçeve itirazı olmadan akış anlamını yitirir; yer tutucuyla sürdürülmez.
      if (!out) return { ...tek, transcript: [{ phase: "F1:frame", seatId: "auditor", content: icerik(out, tekSebep) }], endReason: omurgaDurdu("F1 çerçeve itirazı", "f1_frame", tekSebep) };
      return {
        ...tek,
        // Cevap gelmediyse çerçeve itirazı UYDURULMAZ; zarfa da bu işaretle gider.
        frameObjection: icerik(out, tekSebep),
        transcript: [{ phase: "F1:frame", seatId: "auditor", content: icerik(out, tekSebep) }],
      };
    })
    // ---- KAPI 2: Şah çerçeveyi onaylar/düzeltir ----
    .addNode("gate2_frame", async (state: DivanStateType) => {
      const approved = interrupt({ gate: "KAPI2", frameObjection: state.frameObjection }) as string;
      return { ...flushUsage(), approvedFrame: approved };
    })
    // ---- F2: sessiz ideation (4 ideatör bağımsız) ----
    .addNode("f2_ideation", async (state: DivanStateType) => {
      const budget = budgetStop(state, IDEATORS.length, "F2", IDEATORS, "f2_ideation");
      if (budget.abort) {
        // Akış burada durur; çıkışı koşullu kenar END'e yönlendirir (Command goto END
        // denendi: update uygulanıyor ama graf normal kenardan devam ediyordu).
        return {
          endReason:
            budget.abortReason ??
            "Şah bütçe kapısında iptal etti (F2 girişi). KURTARMA: re-table ile devam edilebilir, durum korunur.",
        };
      }
      const { update } = await runPhase(state, "F2:idea", IDEATORS, () => ({
        phase: "F2:idea",
        idea: state.idea,
        attachmentSummary: state.attachmentSummary,
        // T3-8: Şah'ın onayladığı çerçeve oturum ZARFINDA zaten var (D-2); tekrarlanmaz.
      }));
      return { ...budget, ...update };
    })
    .addNode("bd_summary_f2", async (state: DivanStateType) =>
      runSummary(state, "F2:summary", "F2:idea", "F2"),
    )
    .addNode("f3_cross", async (state: DivanStateType) => {
      const budget = budgetStop(state, IDEATORS.length, "F3", IDEATORS, "f3_cross");
      if (budget.abort) {
        // Akış burada durur; çıkışı koşullu kenar END'e yönlendirir (Command goto END
        // denendi: update uygulanıyor ama graf normal kenardan devam ediyordu).
        return {
          endReason:
            budget.abortReason ??
            "Şah bütçe kapısında iptal etti (F3 girişi). KURTARMA: re-table ile devam edilebilir, durum korunur.",
        };
      }
      const f2Summary = summaryOf(state, "F2");
      const { update } = await runPhase(state, "F3:cross", IDEATORS, () => ({
        phase: "F3:cross",
        idea: state.idea,
        attachmentSummary: state.attachmentSummary,
        context: f2Summary,
      }));
      return { ...budget, ...update };
    })
    .addNode("bd_summary_f3", async (state: DivanStateType) =>
      runSummary(state, "F3:summary", "F3:cross", "F3"),
    )
    .addNode("f4_feasibility", async (state: DivanStateType) => {
      // F4'ün tam maliyeti: fizibilite + denetim + ilk revizyon turu + hüküm turu.
      // F4'ün faz maliyeti (H-4): fizibilite + SORGU TURU + en çok `perPhaseCap` arama + denetim
      // + savunma + hüküm. Topraklamadan önce üç adımın ikisi yoktu ve kapı 7 beyan ederken faz 8
      // çağrı harcıyordu; bir kapı eksik beyan ederse tavan tavan olmaktan çıkar.
      //
      // KAP beyan edilir, üretilen sorgu sayısı değil: kapı faz BAŞLAMADAN açılır ve o an kaç
      // sorgu üretileceği bilinmez. Bir kapı en kötü hali beyan etmek zorundadır; umduğunu beyan
      // eden kapı, aşılmayacağını garanti etmiş olmaz.
      const f4Maliyeti = FEASIBILITY.length + 1 + perPhaseCapOku() + 1 + DEFENDERS.length + 1;
      const budget = budgetStop(state, f4Maliyeti, "F4", [...FEASIBILITY, "auditor", ...DEFENDERS], "f4_feasibility");
      if (budget.abort) {
        // Akış burada durur; çıkışı koşullu kenar END'e yönlendirir (Command goto END
        // denendi: update uygulanıyor ama graf normal kenardan devam ediyordu).
        return {
          endReason:
            budget.abortReason ??
            "Şah bütçe kapısında iptal etti (F4 girişi). KURTARMA: re-table ile devam edilebilir, durum korunur.",
        };
      }
      const f3Summary = summaryOf(state, "F3");
      const { update } = await runPhase(state, "F4:feasibility", FEASIBILITY, () => ({
        phase: "F4:feasibility",
        idea: state.idea,
        context: f3Summary,
        // Fizibilite gerçek metni okumadan yapılamaz: burada TAM METİN (DESIGN §5).
        attachments: state.attachments,
      }));
      return { ...budget, ...update };
    })
    // ---- F4: Denetçi denetim (premortem zorunlu) ----
    .addNode("f4_audit", async (state: DivanStateType) => ({
      ...(await runAuditWithReturn((seatId, input) => run(state, seatId, input), state, "F4:audit", rawOfPhase(state, "F4:feasibility"))),
      ...flushUsage(),
    }))
    // ---- F4: revizyon/savunma turu (DESIGN §5, <=3 tur; kapanış revision.ts'te MEKANİK) ----
    .addNode("f4_revision", async (state: DivanStateType) => {
      // Bir tur = savunma çağrıları + ardından gelen hüküm turu.
      const budget = budgetStop(state, DEFENDERS.length + 1, "F4:revizyon", [...DEFENDERS, "auditor"], "f4_revision");
      if (budget.abort) {
        // Akış burada durur; çıkışı koşullu kenar END'e yönlendirir (Command goto END
        // denendi: update uygulanıyor ama graf normal kenardan devam ediyordu).
        return {
          endReason:
            budget.abortReason ??
            "Şah bütçe kapısında iptal etti (F4:revizyon girişi). KURTARMA: re-table ile devam edilebilir, durum korunur.",
        };
      }
      const round = state.revisionRounds + 1;
      // T3-2: savunma, GEÇERLİ denetimi ve SON HÜKMÜ görür. Denetim yapılandırılmış halinden
      // gelir (state.audit), transkriptten değil: böylece iade edilmiş [GEÇERSİZ] ilk deneme
      // savunmaya malzeme olmaz. Geçerli denetim yoksa (Şah DENETIM_EKSIK kapısında "devam"
      // dediyse) eksiklik SESSİZ geçilmez, ham metin açık bir uyarıyla taşınır.
      const auditText = state.audit
        ? renderAudit(state.audit)
        : `[DENETİM MEKANİK ŞARTLARI TAŞIMIYOR: ${state.auditIssue}]\n${rawOfPhase(state, "F4:audit")}`;
      const { update } = await runPhase(state, "F4:revision", DEFENDERS, () => ({
        phase: "F4:revision",
        idea: state.idea,
        attachmentSummary: state.attachmentSummary,
        context: defenseContext(
          auditText,
          state.judgment.length > 0 ? renderJudgment(state.judgment) : "",
          rawOfPhase(state, "F4:revision"),
        ),
        round,
      }));
      return { ...budget, ...update, revisionRounds: 1 };
    })
    // ---- F4: Denetçi hüküm turu (şema-bağlı). prevUnmetCount = döngünün ilerleme ölçüsü. ----
    .addNode("f4_judgment", async (state: DivanStateType) => {
      const prevUnmet = state.judgment.length > 0 ? countBlockingUnmet(state.judgment) : -1;
      const { out, reason: tekSebep, update: tek } = await runTek(state, "auditor", {
        phase: "F4:judgment",
        idea: state.idea,
        context: rawOfPhase(state, "F4:"),
        round: state.revisionRounds,
        retry: state.judgmentRetries,
      });
      const judgment = (out?.data?.judgment as JudgmentItem[] | undefined) ?? [];
      return {
        ...tek,
        judgment,
        judgmentHistory: [{ round: state.judgmentHistory.length + 1, items: judgment }],
        judgmentComplete: true,
        prevUnmetCount: prevUnmet,
        // Kriter tablosu transkripte de girer (T3-1): F4 özetini yazan Baş Danışman ve savunma
        // turu, hangi maddenin blocking kaldığını ancak burada görebilir.
        transcript: [
          {
            phase: "F4:judgment",
            seatId: "auditor",
            content: renderJudgment(judgment, typeof out?.data?.summary === "string" ? out.data.summary : icerik(out, tekSebep)),
          },
        ],
      };
    })
    .addNode("bd_summary_f4", async (state: DivanStateType) =>
      runSummary(state, "F4:summary", "F4:", "F4"),
    )
    .addNode("f2s_ideation", async (state: DivanStateType) => {
      const budget = budgetStop(state, SMALL_IDEATORS.length, "F2s", SMALL_IDEATORS, "f2s_ideation");
      if (budget.abort) {
        // Akış burada durur; çıkışı koşullu kenar END'e yönlendirir (Command goto END
        // denendi: update uygulanıyor ama graf normal kenardan devam ediyordu).
        return {
          endReason:
            budget.abortReason ??
            "Şah bütçe kapısında iptal etti (F2s girişi). KURTARMA: re-table ile devam edilebilir, durum korunur.",
        };
      }
      const { update } = await runPhase(state, "F2s:idea", SMALL_IDEATORS, () => ({
        phase: "F2s:idea",
        idea: state.idea,
        attachmentSummary: state.attachmentSummary,
        // T3-8: seçilen HMW oturum ZARFINDA zaten var; bağlama ikinci kez konursa aynı metin
        // tek çağrıda iki kez gider. Zarf tek kaynaktır (D-2), düğüm onu tekrarlamaz.
      }));
      return { ...budget, ...update };
    })
    .addNode("bd_summary_f2s", async (state: DivanStateType) =>
      runSummary(state, "F2s:summary", "F2s:idea", "F2"),
    )
    .addNode("f4s_feasibility", async (state: DivanStateType) => {
      // Küçük kurul F4: fizibilite + denetim + hüküm turu (revizyon döngüsü yok).
      // Küçük kurulda da aynı üç adım koşar (H-4): fizibilite(1) + sorgu turu(1) + kap + denetim(1)
      // + hüküm(1). Sabit "3" topraklamadan önce doğruydu; şimdi fazın yarısını beyan ediyordu.
      const budget = budgetStop(state, 1 + 1 + perPhaseCapOku() + 1 + 1, "F4s", ["engineer1", "auditor"], "f4s_feasibility");
      if (budget.abort) {
        // Akış burada durur; çıkışı koşullu kenar END'e yönlendirir (Command goto END
        // denendi: update uygulanıyor ama graf normal kenardan devam ediyordu).
        return {
          endReason:
            budget.abortReason ??
            "Şah bütçe kapısında iptal etti (F4s girişi). KURTARMA: re-table ile devam edilebilir, durum korunur.",
        };
      }
      const { out, reason: tekSebep, update: tek } = await runTek(state, "engineer1", {
        phase: "F4s:feasibility",
        idea: state.idea,
        context: summaryOf(state, "F2"),
        attachments: state.attachments,
      });
      // OMURGA: F4s fizibilite değerlendirmesi olmadan akış anlamını yitirir; yer tutucuyla sürdürülmez.
      if (!out) return { ...tek, transcript: [{ phase: "F4s:feasibility", seatId: "engineer1", content: icerik(out, tekSebep) }], endReason: omurgaDurdu("F4s fizibilite değerlendirmesi", "f4s_feasibility", tekSebep) };
      return {
        ...tek,
        ...budget,
        transcript: [{ phase: "F4s:feasibility", seatId: "engineer1", content: icerik(out, tekSebep) }],
      };
    })
    .addNode("f4s_audit", async (state: DivanStateType) => ({
      ...(await runAuditWithReturn((seatId, input) => run(state, seatId, input), state, "F4s:audit", rawOfPhase(state, "F4s:feasibility"))),
      ...flushUsage(),
    }))
    .addNode("f4s_judgment", async (state: DivanStateType) => {
      const { out, reason: tekSebep, update: tek } = await runTek(state, "auditor", {
        phase: "F4s:judgment",
        idea: state.idea,
        context: rawOfPhase(state, "F4s:"),
        retry: state.judgmentRetries,
      });
      const judgment = (out?.data?.judgment as JudgmentItem[] | undefined) ?? [];
      return {
        ...tek,
        judgment,
        judgmentHistory: [{ round: state.judgmentHistory.length + 1, items: judgment }],
        judgmentComplete: true,
        transcript: [
          {
            phase: "F4s:judgment",
            seatId: "auditor",
            content: renderJudgment(judgment, typeof out?.data?.summary === "string" ? out.data.summary : icerik(out, tekSebep)),
          },
        ],
      };
    })
    .addNode("bd_summary_f4s", async (state: DivanStateType) =>
      runSummary(state, "F4s:summary", "F4s:", "F4"),
    )
    .addNode("f5s_ranking", async (state: DivanStateType) => {
      const budget = budgetStop(state, SMALL_RANKERS.length + 2, "F5s", [...SMALL_RANKERS, "chiefAdvisor", "auditor"], "f5s_ranking");
      if (budget.abort) {
        // Akış burada durur; çıkışı koşullu kenar END'e yönlendirir (Command goto END
        // denendi: update uygulanıyor ama graf normal kenardan devam ediyordu).
        return {
          endReason:
            budget.abortReason ??
            "Şah bütçe kapısında iptal etti (F5s girişi). KURTARMA: re-table ile devam edilebilir, durum korunur.",
        };
      }
      // Küçük kurulda F3 hiç koşmaz: seçenekler F2'de doğar, köprü oradan kurulur (T3-5).
      const { outcomes, update } = await runPhase(state, "F5s:ranking", SMALL_RANKERS, () => ({
        phase: "F5s:ranking",
        idea: state.idea,
        attachmentSummary: state.attachmentSummary,
        context: rankingContext(summaryOf(state, "F2"), summaryOf(state, "F4")),
      }));
      const ranks = outcomes.filter((o) => o.out).map((o) => `${o.seatId}: ${o.out?.content}`);
      return { ...budget, ...update, rankings: ranks };
    })

    // ================= ORTAK: kilit, dönüşler, F5 çıkışı =================
    // OLAY-TETİKLİ DÖNÜŞ (b): hüküm turunda blocking "karsilanmadi" varsa erken brifing (Şah).
    .addNode("blocking_check", async (state: DivanStateType) => {
      const unmet = state.judgment.filter((j) => j.blocking && j.status === "karsilanmadi");
      if (unmet.length === 0) return {};
      // T3-3: yanıt ARTIK OKUNUYOR. Önce interrupt'ın dönüşü tamamen yok sayılıyordu; Şah "iptal"
      // yazsa bile F5 koşuyordu, yani kapı bir bilgilendirmeydi, karar noktası değildi.
      const KABUL = ["devam", "re-table:<düğüm>", "iptal"];
      const answer = interrupt({
        gate: "ERKEN_BRIFING",
        blocking: unmet.map((u) => u.rawText),
        kabulEdilen: KABUL,
        kurtarma: `Akış durursa re-table ile istediğiniz düğümden devam edilebilir; durum korunur.`,
      });
      const eslesen = matchGateAnswer(answer, KABUL);
      if (eslesen === "devam") return {};
      if (eslesen === "iptal") return { endReason: cancelReason("ERKEN_BRIFING", "blocking_check") };
      if (eslesen?.startsWith("re-table:")) {
        // Re-table GRAF İÇİNDEN yapılmaz: checkpoint geçmişinden çatallanmayı rota yürütür
        // (reTableToNode). Sürücü bu yanıtı zaten oraya çevirir; doğrudan API kullanan biri
        // buraya düşerse sessizce sürdürmek yerine ne yapması gerektiğini söyleriz.
        return {
          endReason:
            `Şah re-table istedi ("${eslesen}"). Bu istek graf içinden değil, ayrı bir çağrıyla ` +
            `yürür: reTableToNode ile hedef düğümü göndererek devam edin. Durum korunur.`,
        };
      }
      return { endReason: contractViolation("ERKEN_BRIFING", answer, KABUL, "blocking_check") };
    })
    // OLAY-TETİKLİ DÖNÜŞ (d): iadeye rağmen denetim mekanik şartları taşımıyor (§6.3.1).
    .addNode("gate_audit_missing", async (state: DivanStateType) => {
      // T3-3: "iptal" dışındaki HER yanıt devam sayılıyordu; "devamm" yazımı akışı sürdürüyordu.
      const KABUL = ["devam", "iptal"];
      const answer = interrupt({
        gate: "DENETIM_EKSIK",
        reason: state.auditIssue,
        retries: state.auditRetries,
        // Topraklama notlari (H-6) tam da BURADA gerekli: bu kapiya cogu zaman arama getiremedigi
        // icin gelinir ve "rozet hak edilemedi" ile "arama patladigi icin rozet hak edilemedi"
        // Sah'in vereceği karari degistirir. Notu yalniz KAPI 3'e koymak, onu en cok gerektigi
        // kapida gizlemek olurdu.
        groundingNotes: state.groundingNotes,
        kabulEdilen: KABUL,
        kurtarma: `Akış durursa re-table ile "gate_audit_missing" öncesinden devam edilebilir.`,
      });
      const eslesen = matchGateAnswer(answer, KABUL);
      if (eslesen === "devam") return { ...flushUsage(), auditGateAction: "devam" };
      return {
        ...flushUsage(),
        auditGateAction: eslesen ?? "sozlesme-disi",
        endReason:
          eslesen === "iptal"
            ? cancelReason("DENETIM_EKSIK", "gate_audit_missing")
            : contractViolation("DENETIM_EKSIK", answer, KABUL, "gate_audit_missing"),
      };
    })
    // Kilit blok dalı, 1. kez: hüküm turunu yeniden koştur (sayaç; çağrı harcamaz).
    .addNode("judgment_retry", async () => ({ judgmentRetries: 1 }))
    // OLAY-TETİKLİ DÖNÜŞ (c): retry'a rağmen hüküm eksik. Sessiz bitiş YOK, Şah'a çık.
    .addNode("gate_judgment_missing", async (state: DivanStateType) => {
      // T3-3: "retry" dışındaki HER yanıt SESSİZCE bitiriyordu; `done` olayı normal görünüyor,
      // `endReason` boş kalıyordu. Oturumun neden bittiği kayda geçmiyordu.
      const KABUL = ["retry", "iptal"];
      const answer = interrupt({
        gate: "HUKUM_EKSIK",
        judgmentComplete: state.judgmentComplete,
        judgmentCount: state.judgment.length,
        retries: state.judgmentRetries,
        kabulEdilen: KABUL,
        kurtarma: `Akış durursa re-table ile "gate_judgment_missing" öncesinden devam edilebilir.`,
      });
      const eslesen = matchGateAnswer(answer, KABUL);
      if (eslesen === "retry") return { ...flushUsage(), judgmentGateAction: "retry" };
      return {
        ...flushUsage(),
        judgmentGateAction: eslesen ?? "sozlesme-disi",
        endReason:
          eslesen === "iptal"
            ? cancelReason("HUKUM_EKSIK", "gate_judgment_missing")
            : contractViolation("HUKUM_EKSIK", answer, KABUL, "gate_judgment_missing"),
      };
    })
    // ---- F5: kriter bazlı sıralama (tam kurul) ----
    .addNode("f5_ranking", async (state: DivanStateType) => {
      // F5'in tam maliyeti: sıralama + BD taslak + final denetim.
      const budget = budgetStop(state, RANKERS.length + 2, "F5", [...RANKERS, "chiefAdvisor", "auditor"], "f5_ranking");
      if (budget.abort) {
        // Akış burada durur; çıkışı koşullu kenar END'e yönlendirir (Command goto END
        // denendi: update uygulanıyor ama graf normal kenardan devam ediyordu).
        return {
          endReason:
            budget.abortReason ??
            "Şah bütçe kapısında iptal etti (F5 girişi). KURTARMA: re-table ile devam edilebilir, durum korunur.",
        };
      }
      // T3-5: sıralama SEÇENEKLERİ sıralar, ama seçeneklerin doğduğu faz F3'tü ve F3 özeti
      // buraya hiç gelmiyordu; sıralayıcılar yalnız F4'ün fizibilite/denetim özetini görüyordu.
      // Ortak seçenek defteri (D-3) Blok 3'te gelene kadar köprü budur (DESIGN §5).
      const { outcomes, update } = await runPhase(state, "F5:ranking", RANKERS, () => ({
        phase: "F5:ranking",
        idea: state.idea,
        attachmentSummary: state.attachmentSummary,
        context: rankingContext(summaryOf(state, "F3"), summaryOf(state, "F4")),
      }));
      // Susan koltuk sıralamaya GİRMEZ: eksik ses uydurulmaz, silentSeats'te görünür.
      const ranks = outcomes.filter((o) => o.out).map((o) => `${o.seatId}: ${o.out?.content}`);
      return { ...budget, ...update, rankings: ranks };
    })
    // ---- F5: BD taslak karar + muhalefet notu (§6.4: blocking "karsilanmadi" HAM metin) ----
    .addNode("bd_draft", async (state: DivanStateType) => {
      const stillUnmet = state.judgment.filter((j) => j.blocking && j.status === "karsilanmadi");
      // Taslak KÖR yazılıyordu: Baş Danışman'a yalnız ham fikir gidiyordu, sıralamalar ve
      // muhalefet notu gitmiyordu. "Sıralamalara göre yön öner" demek, sıralamayı göstermeden
      // anlamsızdır. Sıralamalar KİMLİKSİZ verilir (§6.1): kim ne dedi değil, ne dendi.
      const oncekiDusenler = dusenItirazlar(state);
      const draftContext = [
        // T3-5: taslak da seçeneklerin doğduğu fazı görmeli, yalnız haklarında söyleneni değil.
        `F3 ÖZETİ (seçenekler burada doğdu):\n${summaryOf(state, "F3") || summaryOf(state, "F2")}`,
        `F4 ÖZETİ:\n${summaryOf(state, "F4")}`,
        `SIRALAMALAR (kimliksiz):\n${kimliksizSiralamalar(state.rankings, state.sessionSeed)}`,
        `MUHALEFET NOTU (Denetçi'nin HAM metni; yumuşatma, kısaltma ve gömme YETKİN YOK):\n${
          stillUnmet.map((j) => j.rawText).join("\n") || "(blocking muhalefet yok)"
        }`,
        `REVİZYONLA DÜŞEN İTİRAZLAR:\n${oncekiDusenler.join("\n") || "(yok)"}`,
        `DENETİM DURUMU: ${state.auditComplete ? "mekanik şartlar tam" : `EKSİK (${state.auditIssue})`}`,
      ].join("\n\n");
      const { out, reason: tekSebep, update: tek } = await runTek(state, "chiefAdvisor", {
        phase: "F5:draft",
        idea: state.idea,
        context: draftContext,
      });
      // OMURGA: F5 karar taslağı olmadan akış anlamını yitirir; yer tutucuyla sürdürülmez.
      if (!out) return { ...tek, transcript: [{ phase: "F5:draft", seatId: "chiefAdvisor", content: icerik(out, tekSebep) }], endReason: omurgaDurdu("F5 karar taslağı", "bd_draft", tekSebep) };
      const dissent = stillUnmet.map((j) => j.rawText).join("\n");
      const dropped = oncekiDusenler;
      return {
        ...tek,
        dissentNote: dissent,
        droppedObjections: dropped,
        transcript: [{ phase: "F5:draft", seatId: "chiefAdvisor", content: icerik(out, tekSebep) }],
      };
    })
    // ---- KAPI 3: Şah karar onayı ----
    .addNode("gate3_decision", async (state: DivanStateType) => {
      const decision = interrupt({
        gate: "KAPI3",
        rankings: state.rankings,
        dissentNote: state.dissentNote,
        droppedObjections: state.droppedObjections,
        // Denetim mekanik şartları taşımıyorsa Şah bunu karar anında GÖRÜR (§6.3.1).
        auditComplete: state.auditComplete,
        auditIssue: state.auditIssue,
        // Susan koltuklar karar anında görünür: eksik ses gizlenmez (§7).
        silentSeats: state.silentSeats,
        // Özet kotası karşılanmayan fazlar: susturulmuş görüş sessizce kaybolmaz (§6).
        summaryIssues: state.summaryIssues,
        // Topraklama notları (§6.2): aramanın neyi getiremediği, karar anında AYRI görünür.
        groundingNotes: state.groundingNotes,
        // Karar anında maliyet de görünür: onay bedelini bilerek verilir.
        costNanoUsd: state.costNanoUsd,
        costUsd: formatUsd(state.costNanoUsd),
        costUnknownCalls: state.costUnknownCalls,
        // C-1: karşılıksız harcanan para karar anında görünür (başarısız deneme = yanan çağrı).
        failedAttempts: state.failedAttempts,
        failedCostUsd: formatUsd(state.failedCostNanoUsd),
        // M2-C-6: arama kalemi ayrı görünür ama toplamın İÇİNDEDİR.
        searchCalls: state.searchCalls,
        searchResults: state.searchResults,
        searchCostUsd: formatUsd(state.searchCostNanoUsd),
        callCount: state.callCount,
      }) as string;
      return { ...flushUsage(), decision };
    })
    // ---- F5 çıktı: karar belgesi + kod promptu + Denetçi final denetim (M3 içerik; M1 stub) ----
    .addNode("f5_output", async (state: DivanStateType) => {
      // Final topraklama denetimi KÖR yapılıyordu: Denetçi neyi denetleyeceğini görmüyordu.
      // Kendi muhalefet notunun belgede DURUP DURMADIĞINI kontrol edebilmesi için taslağı görmeli.
      const taslak = state.transcript.findLast?.((t) => t.phase === "F5:draft")?.content ?? "";
      const outputContext = [
        `KARAR TASLAĞI (Baş Danışman):\n${taslak}`,
        `MUHALEFET NOTU (senin ham metnin; belgede aynen duruyor mu?):\n${
          state.dissentNote || "(blocking muhalefet yok)"
        }`,
        `SIRALAMALAR (kimliksiz):\n${kimliksizSiralamalar(state.rankings, state.sessionSeed)}`,
        `F4 ÖZETİ:\n${summaryOf(state, "F4")}`,
        `ŞAH'IN KARARI:\n${state.decision ?? "(yok)"}`,
      ].join("\n\n");
      const { out, reason: tekSebep, update: tek } = await runTek(state, "auditor", {
        phase: "F5:output",
        idea: state.idea,
        context: outputContext,
      });
      // OMURGA: F5 final topraklama denetimi olmadan akış anlamını yitirir; yer tutucuyla sürdürülmez.
      if (!out) return { ...tek, transcript: [{ phase: "F5:output", seatId: "auditor", content: icerik(out, tekSebep) }], endReason: omurgaDurdu("F5 final topraklama denetimi", "f5_output", tekSebep) };
      return {
        ...tek,
        transcript: [{ phase: "F5:output", seatId: "auditor", content: icerik(out, tekSebep) }],
      };
    })

    // ================= kenarlar (DESIGN §5 birebir) =================
    .addEdge(START, "f0_briefing")
    .addConditionalEdges("f0_briefing", abortRouter, { devam: "f0_hmw", abort: END })
    .addConditionalEdges("f0_hmw", abortRouter, { devam: "gate1_hmw", abort: END })
    // TRİYAJ DALLANMASI: küçük fikir küçük kurula gider (F1/F3 atlanır).
    .addConditionalEdges("gate1_hmw", modeRouter, { full: "f1_frame", small: "f2s_ideation" })
    // tam kurul omurgası
    .addConditionalEdges("f1_frame", abortRouter, { devam: "gate2_frame", abort: END })
    .addEdge("gate2_frame", "f2_ideation")
    .addConditionalEdges("f2_ideation", abortRouter, { devam: "bd_summary_f2", abort: END })
    .addEdge("bd_summary_f2", "f3_cross")
    .addConditionalEdges("f3_cross", abortRouter, { devam: "bd_summary_f3", abort: END })
    .addEdge("bd_summary_f3", "f4_feasibility")
    // küçük kurul omurgası
    .addConditionalEdges("f2s_ideation", abortRouter, { devam: "bd_summary_f2s", abort: END })
    .addEdge("bd_summary_f2s", "f4s_feasibility")
    // F4 tam kurul: fizibilite -> denetim -> [revizyon -> hüküm] döngüsü -> özet
    .addConditionalEdges("f4_feasibility", abortRouter, { devam: "f4_audit", abort: END })
    // Denetim geçersizse revizyon turuna GEÇİLMEZ: eksik denetime savunma yazmak anlamsızdır.
    .addConditionalEdges("f4_audit", (state: DivanStateType) => (state.auditComplete ? "devam" : "kapi"), {
      devam: "f4_revision",
      kapi: "gate_audit_missing",
    })
    .addConditionalEdges("f4_revision", abortRouter, { devam: "f4_judgment", abort: END })
    .addConditionalEdges("f4_judgment", revisionLoopRouter, {
      f4_revision: "f4_revision",
      bd_summary_f4: "bd_summary_f4",
    })
    .addEdge("bd_summary_f4", "blocking_check")
    // F4 küçük kurul: revizyon döngüsü yok
    .addConditionalEdges("f4s_feasibility", abortRouter, { devam: "f4s_audit", abort: END })
    .addConditionalEdges("f4s_audit", (state: DivanStateType) => (state.auditComplete ? "devam" : "kapi"), {
      devam: "f4s_judgment",
      kapi: "gate_audit_missing",
    })
    .addEdge("f4s_judgment", "bd_summary_f4s")
    .addEdge("bd_summary_f4s", "blocking_check")
    // ERKEN-UZLAŞI KİLİDİ (§6.3): hüküm turu tamam + blocking listeli değilse F5 açılmaz.
    // Blok dalı END'e DÜŞMEZ: önce yeniden koşum, sonra Şah kapısı.
    .addConditionalEdges(
      "blocking_check",
      // ERKEN_BRIFING kapısı sebepli bir duruş yazdıysa akış orada biter (T3-3).
      (state: DivanStateType) => (state.endReason ? "abort" : earlyConsensusLockRouter(state)),
      {
        f5_ranking: "f5_ranking",
        f5s_ranking: "f5s_ranking",
        judgment_retry: "judgment_retry",
        gate_judgment_missing: "gate_judgment_missing",
        abort: END,
      },
    )
    .addConditionalEdges(
      "gate_audit_missing",
      // Yalnız açık "devam" sürdürür; iptal ve sözleşme dışı yanıt sebebiyle birlikte durur.
      (state: DivanStateType) => (state.auditGateAction === "devam" ? modeRouter(state) : "abort"),
      { full: "f4_revision", small: "f4s_judgment", abort: END },
    )
    .addConditionalEdges("judgment_retry", modeRouter, {
      full: "f4_judgment",
      small: "f4s_judgment",
    })
    .addConditionalEdges(
      "gate_judgment_missing",
      (state: DivanStateType) =>
        state.judgmentGateAction === "retry" ? modeRouter(state) : "abort",
      { full: "f4_judgment", small: "f4s_judgment", abort: END },
    )
    // F5 ortak kuyruk
    .addConditionalEdges("f5_ranking", abortRouter, { devam: "bd_draft", abort: END })
    .addConditionalEdges("f5s_ranking", abortRouter, { devam: "bd_draft", abort: END })
    .addConditionalEdges("bd_draft", abortRouter, { devam: "gate3_decision", abort: END })
    .addEdge("gate3_decision", "f5_output")
    .addEdge("f5_output", END);

  return graph.compile({ checkpointer: getCheckpointer() });
}

const compiledByMode = new Map<string, ReturnType<typeof buildCouncilGraph>>();

/**
 * Mod başına tek derlenmiş graf (checkpointer singleton'ı paylaşılsın diye). Runner enjekte edilir:
 * graf hangi sesle konuştuğunu bilmez, bu yüzden stub ve gerçek koşum aynı mekaniği kullanır.
 */
export function getCouncilGraph(mode: string, runner: SeatRunner): ReturnType<typeof buildCouncilGraph> {
  const existing = compiledByMode.get(mode);
  if (existing) return existing;
  const built = buildCouncilGraph(runner);
  compiledByMode.set(mode, built);
  return built;
}
