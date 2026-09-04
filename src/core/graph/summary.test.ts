// Faz özeti kotası birim testi (DESIGN §6). Node native TS ile:
//   node src/core/graph/summary.test.ts
// Bekçi görevi: özetleyicinin bir koltuğu sessizce düşürmesi mümkün olmasın.

import assert from "node:assert";
import { validateSummary, speakingSeats, anonymizeSummary, SILENT_MARK } from "./summary.ts";

const nokta = (seatId: string) => ({ seatId, point: `${seatId} katkisi` });
const tam = {
  summary: "F2'de uc ayri yon cikti, ikisi birbirine zit.",
  points: [nokta("visionary"), nokta("market"), nokta("engineer1")],
};
const koltuklar = ["visionary", "market", "engineer1"];

// 1) her konusan koltuk temsil ediliyorsa gecer
const r = validateSummary(tam, koltuklar);
assert.strictEqual(r.ok, true);

// 2) GEREKÇE-KANITI: bir koltugun katkisi ozetten DUSURULURSE yakalanir.
//    (Delik tam buydu: kimse bir sey silmiyor, sadece ozetlemiyor; sonraki fazlar icin o gorus
//     hic var olmamis oluyor. Kotasiz halde bu cikti "gecerli" sayilirdi.)
const dusuruldu = { ...tam, points: [nokta("visionary"), nokta("engineer1")] };
const d = validateSummary(dusuruldu, koltuklar);
assert.strictEqual(d.ok, false);
assert.ok(!d.ok && d.reason.includes("market"), `dusen koltuk adiyla soylenmeli: ${!d.ok && d.reason}`);

// 3) bos ozet metni gecersiz
assert.strictEqual(validateSummary({ ...tam, summary: "  " }, koltuklar).ok, false);
// 4) madde koltuk kimligi tasimiyorsa gecersiz
assert.strictEqual(validateSummary({ ...tam, points: [{ point: "x" }] }, koltuklar).ok, false);
// 5) fazladan madde serbest: BD yorumlayabilir, agirliklandirabilir, ekleyebilir
assert.strictEqual(validateSummary({ ...tam, points: [...tam.points, nokta("market")] }, koltuklar).ok, true);

// 6) SUSAN koltuk kotadan MUAF: olmayan katki ozetlenemez
const kayitlar = [
  { phase: "F2:idea", seatId: "visionary", content: "fikir" },
  { phase: "F2:idea", seatId: "market", content: `${SILENT_MARK}: cevap yok]` },
  { phase: "F2:idea", seatId: "engineer1", content: "fikir" },
  { phase: "F3:cross", seatId: "visionary", content: "baska faz" },
];
assert.deepStrictEqual(speakingSeats(kayitlar, "F2:idea"), ["visionary", "engineer1"]);

// 7) ileri tasinan metin KIMLIKSIZ (§6.1): etiket VE metin ici adlar maskelenir.
//    GEREKÇE-KANITI: etiketi kaldirmak tek basina yetmiyor, cunku ozetin METNI de koltugu
//    adiyla anabiliyor ("Vizyoner sunu dedi"). Ilk hali tam bu yuzden dusmustu.
const anon = anonymizeSummary(
  { summary: "Vizyoner ve Pazar Sesi ayristi", points: [nokta("visionary"), nokta("market")] },
  ["visionary", "market", "Vizyoner", "Pazar Sesi"],
);
assert.ok(!/visionary|market|Vizyoner|Pazar Sesi/i.test(anon), `tasinan metinde kimlik olmamali: ${anon}`);
assert.ok(anon.includes("Görüş 1") && anon.includes("Görüş 2"), "gorusler kimliksiz numaralanmali");

console.log("SUMMARY_TEST_OK: kota (dusen koltuk yakalanir) + susan muafiyeti + tasinan metin kimliksiz");
