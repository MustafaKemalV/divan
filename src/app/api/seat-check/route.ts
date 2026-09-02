// Sunucu rotası: config yükle + koltukları probla, sonucu döndür. Anahtar SUNUCUDA kalır;
// tarayıcı yalnız bu rotaya GET atar (network kanıtı: payload'da anahtar yok).

import { NextResponse } from "next/server";
import { loadConfig } from "@/core/config/load";
import { probeAllSeats } from "@/core/seats/probe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const config = loadConfig();
    // Elle tazeleme (§7): /api/seat-check?refresh=1 önbelleği yok sayar ve hepsini yeniden problar.
    const refresh = new URL(req.url).searchParams.get("refresh") === "1";
    const results = await probeAllSeats(config, { refresh });
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
