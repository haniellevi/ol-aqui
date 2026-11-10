import type { Metadata } from "next";
import OlakiRadar from "@/components/demo/radar/radar-demo";

export const metadata: Metadata = { title: "Demo do Radar de Negócios" };

// Página de conferência da demo animada do Radar (ilustração de produto, sem dados reais).
export default function DemoRadarPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, background: "var(--color-fundo)" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <OlakiRadar />
      </div>
    </main>
  );
}
