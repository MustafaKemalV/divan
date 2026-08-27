"use client";

import { useState } from "react";

interface SeatResult {
  seatId: string;
  title: string;
  family: string;
  model: string;
  servedModel?: string;
  status: "pass" | "pass-via-fallback" | "fail" | "no-key";
  detail?: string;
}

const STATUS_STYLE: Record<SeatResult["status"], { label: string; color: string }> = {
  pass: { label: "geçti", color: "#3fb950" },
  "pass-via-fallback": { label: "geçti (fallback)", color: "#d29922" },
  fail: { label: "başarısız", color: "#f85149" },
  "no-key": { label: "anahtar yok", color: "#d29922" },
};

export default function Home() {
  const [results, setResults] = useState<SeatResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runCheck() {
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch("/api/seat-check");
      const data = await res.json();
      if (!data.ok) setError(data.error ?? "bilinmeyen hata");
      else setResults(data.results as SeatResult[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ marginBottom: 4 }}>Divan</h1>
      <p style={{ marginTop: 0, color: "#8b949e" }}>
        a parrhesia machine for your ideas: koltuk kontrolü (M0)
      </p>

      <button
        onClick={runCheck}
        disabled={loading}
        style={{
          marginTop: 16,
          padding: "10px 18px",
          background: loading ? "#30363d" : "#238636",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: loading ? "default" : "pointer",
          fontSize: 15,
        }}
      >
        {loading ? "kontrol ediliyor..." : "Koltuk kontrolü çalıştır"}
      </button>

      {error && (
        <pre
          style={{
            marginTop: 20,
            padding: 14,
            background: "#161b22",
            border: "1px solid #f85149",
            borderRadius: 6,
            whiteSpace: "pre-wrap",
            color: "#ff7b72",
          }}
        >
          {error}
        </pre>
      )}

      {results && (
        <table style={{ marginTop: 24, width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#8b949e" }}>
              <th style={{ padding: "6px 8px" }}>Koltuk</th>
              <th style={{ padding: "6px 8px" }}>Aile</th>
              <th style={{ padding: "6px 8px" }}>Model</th>
              <th style={{ padding: "6px 8px" }}>Durum</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const s = STATUS_STYLE[r.status];
              return (
                <tr key={r.seatId} style={{ borderTop: "1px solid #21262d" }}>
                  <td style={{ padding: "6px 8px" }}>{r.title}</td>
                  <td style={{ padding: "6px 8px", color: "#8b949e" }}>{r.family}</td>
                  <td style={{ padding: "6px 8px", fontFamily: "ui-monospace, monospace" }}>{r.model}</td>
                  <td style={{ padding: "6px 8px" }}>
                    <span style={{ color: s.color }}>● {s.label}</span>
                    {r.detail && (
                      <span style={{ color: "#6e7681", marginLeft: 8 }}>{r.detail}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
