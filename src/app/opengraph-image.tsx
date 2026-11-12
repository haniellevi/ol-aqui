import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Imagem que aparece ao compartilhar o link (WhatsApp, redes). Selo "M" + nome, cores do DESIGN.md.
export const alt = "Mercado da Região: compre e venda perto de você";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BERINGELA = "#4B1248";
const LARANJA = "#FF6A13";
const SELECAO = "#F0EAF5";

// Mesmo desenho do ícone do app (public/icone-mercado.svg), sem o fundo.
async function letraM() {
  const svg = await readFile(join(process.cwd(), "public/icone-mercado.svg"), "utf8");
  const caminho = svg.match(/<path d="([^"]+)"/)?.[1] ?? "";
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="105 152 302 208"><path d="${caminho}" fill="${BERINGELA}"/></svg>`,
  )}`;
}

export default async function Imagem() {
  const [poppins, m] = await Promise.all([readFile(join(process.cwd(), "src/app/fontes/Poppins-Bold.ttf")), letraM()]);

  return new ImageResponse(
    // Composição centrada: o WhatsApp às vezes corta a imagem num quadrado no meio, e o selo "M" sobrevive ao corte.
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: BERINGELA, fontFamily: "Poppins" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 184, height: 184, borderRadius: 40, background: LARANJA }}>
        <img src={m} width={112} height={77} alt="" />
      </div>
      <div style={{ display: "flex", marginTop: 40, fontSize: 88, lineHeight: 1, letterSpacing: "-0.03em", color: "#FFFFFF" }}>Mercado da Região</div>
      <div style={{ display: "flex", marginTop: 24, fontSize: 40, lineHeight: 1.2, color: SELECAO }}>Compre e venda perto de você.</div>
      <div style={{ display: "flex", marginTop: 40, fontSize: 26, color: LARANJA }}>mercadodaregiao.com.br</div>
    </div>,
    { ...size, fonts: [{ name: "Poppins", data: poppins, weight: 700, style: "normal" }] },
  );
}
