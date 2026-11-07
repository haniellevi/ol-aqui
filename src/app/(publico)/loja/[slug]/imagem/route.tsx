import { ImageResponse } from "next/og";
import { vitrinePublica } from "@/lib/dados/vitrine-completa";
import { corDoTextoSobre, corSegura } from "@/components/vitrine/regras";
import { iniciais } from "@/components/vitrine/util";

// Imagem de compartilhamento (WhatsApp, Instagram, Facebook) da vitrine quando a loja usa o banner
// modelo: a cor da loja + iniciais + nome + cidade + OLAKI. Sem imagem de fora (nada para dar erro).
// Com foto da fachada, a página usa a própria foto.

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const v = await vitrinePublica(slug);
  const nome = v?.nome ?? "Loja no OLAKI";
  const fundo = corSegura(v?.banner_cor);
  const texto = corDoTextoSobre(fundo);
  const cidade = v ? [v.bairro, v.cidade].filter(Boolean).join(", ") : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px",
          backgroundColor: fundo,
          color: texto,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
          <div
            style={{
              width: "160px",
              height: "160px",
              borderRadius: "80px",
              backgroundColor: "#FFFFFF",
              color: "#4B1248",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "64px",
              fontWeight: 700,
            }}
          >
            {iniciais(nome)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxWidth: "820px" }}>
            <div style={{ fontSize: "64px", fontWeight: 700, lineHeight: 1.1 }}>{nome.slice(0, 60)}</div>
            {cidade && <div style={{ fontSize: "36px", opacity: 0.9 }}>{cidade}</div>}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: "36px" }}>
          <div style={{ display: "flex" }}>Veja os produtos e chame no WhatsApp</div>
          <div style={{ display: "flex", fontWeight: 700, fontSize: "48px" }}>
            <span>OL</span>
            <span style={{ color: texto === "#FFFFFF" ? "#FFE4D1" : "#C2410C" }}>AKI</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    },
  );
}
