// Sunucu rotası: config yükle + koltukları probla, sonucu döndür. Anahtar SUNUCUDA kalır;
// tarayıcı yalnız bu rotaya GET atar (network kanıtı: payload'da anahtar yok).

import { NextResponse } from "next/server";
import { loadConfig } from "@/core/config/load";
import { probeAllSeats } from "@/core/seats/probe";
import { formatUsd } from "@/core/graph/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const config = loadConfig();
    // Elle tazeleme (§7): /api/seat-check?refresh=1 önbelleği yok sayar ve hepsini yeniden problar.
    const refresh = new URL(req.url).searchParams.get("refresh") === "1";
    const results = await probeAllSeats(config, { refresh });
    // Prob maliyeti oturum sayacından AYRI raporlanır (hesap saflığı, DESIGN §7).
    const probeCostNanoUsd = results.reduce((n, r) => n + (r.costNanoUsd ?? 0), 0);
    const costUnknownSeats = results.filter(
      (r) => r.costNanoUsd === undefined && r.status !== "no-key",
    ).length;
    return NextResponse.json({
      ok: true,
      results,
      probeCost: {
        nanoUsd: probeCostNanoUsd,
        usd: formatUsd(probeCostNanoUsd),
        costUnknownSeats,
        note: "Prob maliyeti oturum sayacına dahil DEĞİLDİR; prob config başına ve günde bir koşar.",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
