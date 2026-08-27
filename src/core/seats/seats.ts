// Divan kadrosu (DESIGN §4). Bu dosya SPEC'tir: 7 koltuk / 6 aile, kimlik + şapka + aktif
// fazlar + web aracı. Koltuk KİMLİĞİ burada sabittir; hangi MODELİN oturduğu config'dedir
// (divan.config.json). Framework-bağımsız: sıfır React/Next importu.

export type Hat = "yesil" | "kirmizi" | "beyaz" | "sari" | "siyah" | "mavi";
export type Phase = "F0" | "F1" | "F2" | "F3" | "F4" | "F5";

export interface Seat {
  /** config anahtarı + payload kimliği */
  id: string;
  /** Türkçe görünen ad */
  title: string;
  /** sağlayıcı ailesi (dekorelasyon; DESIGN §4) */
  family: string;
  /** baskın mod(lar) = şapka */
  hats: Hat[];
  /** aktif olduğu fazlar */
  phases: Phase[];
  /** web arama aracı erişimi (DESIGN §6.2 kapsam) */
  webTool: boolean;
  /** final kodlama promptu üretimine/çapraz-denetimine katılır mı */
  finalPrompt: boolean;
}

export const SEATS: readonly Seat[] = [
  {
    id: "visionary",
    title: "Vizyoner",
    family: "xAI",
    hats: ["yesil"],
    phases: ["F2", "F3"],
    webTool: false,
    finalPrompt: false,
  },
  {
    id: "market",
    title: "Pazar Sesi",
    family: "Google",
    hats: ["kirmizi"],
    phases: ["F2", "F3", "F5"],
    webTool: false,
    finalPrompt: false,
  },
  {
    id: "engineer1",
    title: "Müh-1",
    family: "OpenAI",
    hats: ["beyaz", "sari"],
    phases: ["F2", "F3", "F4", "F5"],
    webTool: true,
    finalPrompt: true,
  },
  {
    id: "engineer2",
    title: "Müh-2",
    family: "Qwen",
    hats: ["beyaz"],
    phases: ["F4"],
    webTool: true,
    finalPrompt: true,
  },
  {
    id: "architect",
    title: "Mimar",
    family: "Anthropic",
    hats: ["sari"],
    phases: ["F2", "F3", "F4", "F5"],
    webTool: false,
    finalPrompt: false,
  },
  {
    id: "auditor",
    title: "Denetçi",
    family: "DeepSeek",
    hats: ["siyah"],
    phases: ["F1", "F4", "F5"],
    webTool: true,
    finalPrompt: false,
  },
  {
    id: "chiefAdvisor",
    title: "Baş Danışman",
    family: "Anthropic",
    hats: ["mavi"],
    phases: ["F0", "F1", "F2", "F3", "F4", "F5"],
    webTool: false,
    finalPrompt: false,
  },
] as const;

export const SEAT_IDS: readonly string[] = SEATS.map((s) => s.id);

export function getSeat(id: string): Seat | undefined {
  return SEATS.find((s) => s.id === id);
}
