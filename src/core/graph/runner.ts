// Runner seçimi (DESIGN §7 runner modu damgası). Varsayılan GERÇEK: uygulama açıldığında gerçek
// Divan koşar. Sahte koşum açıkça istenir (testler, CI, demo). Anahtar yoksa SESSİZCE stub'a
// düşülmez, anlaşılır hata verilir: bir gün gerçek sanılan sahte bir oturum görmeyelim diye.
//
// openrouterRunner tembel yüklenir: stub modunda sağlayıcı zinciri (server-only mühürlü) hiç
// import edilmez, böylece graf saf Node ortamında da (e2e in-process ölçüm) çalışır.

import { StubSeatRunner, type SeatRunner } from "./seatRunner";

export type RunnerMode = "openrouter" | "stub";

export function resolveRunnerMode(): RunnerMode {
  const raw = (process.env.DIVAN_RUNNER ?? "openrouter").trim().toLowerCase();
  if (raw === "stub") return "stub";
  if (raw === "openrouter") return "openrouter";
  throw new Error(`DIVAN_RUNNER tanınmadı: "${raw}". Geçerli değerler: openrouter | stub.`);
}

export async function createRunner(mode: RunnerMode): Promise<SeatRunner> {
  if (mode === "stub") return new StubSeatRunner();
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY tanımlı değil. Gerçek koşum için .env.local dosyasına anahtarı koyun, " +
        "ya da sahte koşum için DIVAN_RUNNER=stub verin. Anahtarsız gerçek oturum başlatılmaz.",
    );
  }
  const [{ OpenRouterSeatRunner }, { loadConfig }] = await Promise.all([
    import("./openrouterRunner.ts"),
    import("../config/load.ts"),
  ]);
  return new OpenRouterSeatRunner(loadConfig());
}
