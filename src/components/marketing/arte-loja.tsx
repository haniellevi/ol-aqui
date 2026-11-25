/* eslint-disable @next/next/no-img-element -- Imagens locais incorporadas ao PNG por ImageResponse. */
import { corSegura, corDoTextoSobre } from "@/components/vitrine/regras";
const beringela = corSegura(null);
const cartao = corDoTextoSobre(beringela);

export function ArteLoja({ nome, cidade, url, logo, capa, qr }: {
  nome: string; cidade: string; url: string; logo: string | null; capa: string | null; qr: string;
}) {
  return <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: cartao, color: beringela }}>
    {capa && <img src={capa} alt="" width={1080} height={360} style={{ objectFit: "cover" }} />}
    <div style={{ display: "flex", flex: 1, flexDirection: "column", padding: 40, gap: 16 }}>
      {logo && <img src={logo} alt="" width={80} height={80} style={{ objectFit: "contain" }} />}
      <div style={{ display: "flex", fontSize: 56, fontWeight: 700, wordBreak: "break-word" }}>{nome.trim() || "Minha loja"}</div>
      <div style={{ display: "flex", fontSize: 28, color: beringela }}>{cidade}</div>
      <div style={{ display: "flex", fontSize: 36 }}>Conheça nossa vitrine</div>
      <img src={qr} alt="" width={200} height={200} />
      <div style={{ display: "flex", fontSize: 24, wordBreak: "break-all" }}>{url}</div>
      <div style={{ display: "flex", marginTop: "auto", fontSize: 32, fontWeight: 700 }}>Mercado da Região</div>
    </div>
  </div>;
}
