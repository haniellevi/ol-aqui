/* eslint-disable @next/next/no-img-element -- next/og renderiza estas imagens diretamente no PNG. */
import { auth } from "@clerk/nextjs/server";
import { ImageResponse } from "next/og";
import { minhaVitrineCompleta } from "@/lib/dados/vitrine-completa";
import { meuMarketingLoja } from "@/lib/dados/marketing-loja";
import * as QRCode from "qrcode";
import { linkLoja, urlAbsoluta } from "@/lib/formato";
import { ArteLoja } from "@/components/marketing/arte-loja";
import { preco, SITE } from "@/lib/formato";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVADO = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" };
const LIMITE_FOTO = 2_000_000;

function fotoPermitida(endereco: string): boolean {
  try {
    const url = new URL(endereco);
    const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return url.protocol === "https:" && url.origin === base.origin && !url.username && !url.password
      && !url.search && !url.hash && !endereco.includes("%")
      && /^\/storage\/v1\/object\/public\/anuncios\/(?:[a-zA-Z0-9_-]+\/)+[a-zA-Z0-9_.-]+\.(?:png|jpe?g|webp)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

async function carregarFoto(endereco: string): Promise<string> {
  if (!fotoPermitida(endereco)) throw new Error("foto_invalida");
  const resposta = await fetch(endereco, { signal: AbortSignal.timeout(8_000), redirect: "error", cache: "no-store" });
  const tipo = resposta.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!resposta.ok || !tipo || !["image/png", "image/jpeg", "image/webp"].includes(tipo) || !resposta.body) throw new Error("foto_indisponivel");
  if (Number(resposta.headers.get("content-length")) > LIMITE_FOTO) {
    await resposta.body.cancel();
    throw new Error("foto_grande");
  }
  const leitor = resposta.body.getReader();
  const partes: Uint8Array[] = [];
  let tamanho = 0;
  try {
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      tamanho += value.byteLength;
      if (tamanho > LIMITE_FOTO) throw new Error("foto_grande");
      partes.push(value);
    }
  } finally {
    await leitor.cancel().catch(() => {});
  }
  const bytes = Buffer.concat(partes);
  const assinaturaValida = tipo === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : tipo === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (tamanho < 20 || !assinaturaValida) throw new Error("foto_invalida");
  return `data:${tipo};base64,${bytes.toString("base64")}`;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const falha = (texto: string, status: number) => new Response(texto, { status, headers: PRIVADO });
  try {
    const { userId } = await auth();
    if (!userId) return falha("Entre na sua conta para baixar esta arte.", 401);
    const formatos = new URL(req.url).searchParams.getAll("formato");
    const formato = formatos[0] ?? "feed";
    if (formatos.length > 1 || !["feed", "stories"].includes(formato)) return falha("Escolha o formato feed ou stories.", 400);

    const loja = await minhaVitrineCompleta(true);
    if (!loja || loja.tipo !== "loja" || loja.status !== "ativa" || loja.pasta_montagem) return falha("Loja ativa não encontrada.", 404);
    const { id } = await params;
    if (id === "loja") {
      const url = urlAbsoluta(linkLoja(loja.slug));
      const [qr, logo, capa] = await Promise.all([
        QRCode.toDataURL(url, { width: 512, margin: 4 }),
        loja.logo_url ? carregarFoto(loja.logo_url).catch(() => null) : null,
        loja.banner_tipo === "foto" && loja.banner_url ? carregarFoto(loja.banner_url).catch(() => null) : null,
      ]);
      const headers = { ...PRIVADO, "Content-Type": "image/png", "Content-Disposition": 'attachment; filename="mercado-da-regiao-loja-feed.png"' };
      const imagem = new ImageResponse(<ArteLoja nome={loja.nome} cidade={loja.cidade} url={url} logo={logo} capa={capa} qr={qr} />, { width: 1080, height: 1350, headers });
      return new Response(await imagem.arrayBuffer(), { headers });
    }
    const marketing = await meuMarketingLoja(loja.id);
    if (!marketing) return falha("Não foi possível carregar as recomendações. Tente novamente.", 503);
    const anuncio = marketing.criativos.find((criativo) => criativo.id === id);
    if (!anuncio) return falha("Este anúncio não está entre as recomendações atuais da sua loja.", 404);

    const [foto, logo] = await Promise.all([
      carregarFoto(anuncio.foto),
      loja.logo_url ? carregarFoto(loja.logo_url).catch(() => null) : Promise.resolve(null),
    ]);
    const anterior = anuncio.preco_centavos !== null && Number.isSafeInteger(anuncio.preco_antes_centavos)
      && anuncio.preco_antes_centavos! > anuncio.preco_centavos ? anuncio.preco_antes_centavos : null;
    const link = `${SITE.replace(/^https?:\/\//, "")}/loja/${encodeURIComponent(loja.slug ?? "")}`;
    const nomeArquivo = `mercado-da-regiao-${id.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 60) || "produto"}-${formato}.png`;
    const headers = { ...PRIVADO, "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${nomeArquivo}"` };
    const imagem = new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 28, padding: 52, background: "#fff8f1", color: "#351332" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24, minHeight: 100 }}>
          {logo && <img src={logo} alt="" width={100} height={100} style={{ objectFit: "contain", borderRadius: 20, flexShrink: 0 }} />}
          <div style={{ display: "flex", flex: 1, minWidth: 0, flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: loja.nome.length > 50 ? 34 : 42, fontWeight: 700, lineHeight: 1.15, wordBreak: "break-word" }}>{loja.nome}</div>
            <div style={{ fontSize: 24, color: "#795973" }}>Encontre na sua região</div>
          </div>
        </div>
        <div style={{ display: "flex", flex: 1, minHeight: 360, padding: 24, borderRadius: 30, background: "#ffffff" }}>
          <img src={foto} alt="" width={928} height={formato === "stories" ? 1070 : 500} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", fontSize: anuncio.titulo.length > 60 ? 48 : 58, fontWeight: 700, lineHeight: 1.12, wordBreak: "break-word" }}>{anuncio.titulo}</div>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 24 }}>
            {anterior !== null && <div style={{ display: "flex", fontSize: 32, color: "#795973", textDecoration: "line-through" }}>{preco(anterior)}</div>}
            <div style={{ display: "flex", fontSize: 76, fontWeight: 700, color: "#c34916" }}>{preco(anuncio.preco_centavos)}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "26px 30px", borderRadius: 24, background: "#4b1248", color: "#ffffff" }}>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 700 }}>Mercado da Região</div>
          <div style={{ display: "flex", fontSize: link.length > 70 ? 20 : 24, wordBreak: "break-word" }}>{link}</div>
        </div>
      </div>,
      { width: 1080, height: formato === "stories" ? 1920 : 1350, headers },
    );
    // Materializa a renderização para responder com texto legível se a foto não puder ser decodificada.
    return new Response(await imagem.arrayBuffer(), { headers });
  } catch {
    return falha("Não foi possível gerar a arte com a foto deste anúncio. Confira a foto e tente novamente.", 503);
  }
}
