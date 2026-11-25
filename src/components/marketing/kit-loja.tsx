/* eslint-disable @next/next/no-img-element -- QR local em data URL, sem recurso de rede. */
"use client";

import { useEffect, useState } from "react";
import type { BannerModelo } from "@/lib/tipos-vitrine";
import * as QRCode from "qrcode";
import { Botao, classesBotao } from "@/components/ui/botao";
import { CopiarLinkLoja } from "@/components/vitrine/copiar-link-loja";
import { AvatarVitrine } from "@/components/vitrine/avatar-vitrine";
import { BannerLoja } from "@/components/vitrine/banner-loja";
import { Skeleton } from "@/components/ui/skeleton";
import { linkLoja, urlAbsoluta } from "@/lib/formato";
import { LINK_LOJA_MARKETING } from "@/lib/rotas";

export function KitLoja({ nome, slug, cidade, logo, capa, modelo = "liso", cor = "" }: {
  modelo?: BannerModelo; cor?: string;
  nome: string; slug: string; cidade: string; logo: string | null; capa: string | null;
}) {
  const url = urlAbsoluta(linkLoja(slug));
  const titulo = nome.trim() || "Minha loja";
  const [qr, setQr] = useState("");
  const [aviso, setAviso] = useState("");
  const [erroQr, setErroQr] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let ativo = true;
    setErroQr(false);
    QRCode.toDataURL(url, { width: 512, margin: 4, errorCorrectionLevel: "M" })
      .then((imagem) => { if (ativo) setQr(imagem); })
      .catch(() => { if (ativo) setErroQr(true); });
    return () => { ativo = false; };
  }, [url, tentativa]);
  async function compartilhar() {
    try {
      if (!navigator.share) { setAviso("Copie o link e escolha onde enviar."); return; }
      await navigator.share({ title: titulo, text: `Conheça ${titulo} no Mercado da Região`, url });
      setAviso("Compartilhamento encerrado. O envio depende da sua escolha.");
    } catch { setAviso("Compartilhamento cancelado ou indisponível. Você pode copiar o link."); }
  }
  return <section aria-labelledby="titulo-kit" className="flex min-w-0 flex-col gap-3">
    <h2 id="titulo-kit" className="text-lg font-semibold">Kit da sua loja</h2>
    <p className="text-sm text-texto-suave">Divulgue a vitrine inteira. Você escolhe quando e para quem enviar.</p>
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      <div data-kit-preview className="min-w-0 overflow-hidden rounded-card border border-borda bg-cartao print:border-0">
        <BannerLoja tipo={capa ? "foto" : "modelo"} url={capa} modelo={modelo} cor={cor} nome={titulo} logo={logo} compacto />
        <div className="flex flex-col items-start gap-3 p-4">
          <AvatarVitrine nome={titulo} logo={logo} tamanho="md" />
          <h3 className="text-titulo font-semibold text-beringela [overflow-wrap:anywhere]">{titulo}</h3>
          <p className="text-base">{cidade}</p>
          <p className="text-lg font-semibold text-beringela">Conheça nossa vitrine</p>
          {qr ? <img src={qr} alt={`QR Code da vitrine ${titulo}`} width={160} height={160} className="size-40" /> : erroQr ? <p role="alert" className="text-sm text-perigo">Não conseguimos gerar o QR. Tente novamente.</p> : <Skeleton className="size-40" aria-label="Preparando QR Code" />}
          <p className="text-sm break-all">{url}</p>
          <p className="text-base font-semibold text-beringela">Mercado da Região</p>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-3 print:hidden">
        <CopiarLinkLoja url={url} />
        <Botao variante="secundario" onClick={() => void compartilhar()}>Compartilhar loja</Botao>
        <a className={classesBotao("secundario")} href={`${LINK_LOJA_MARKETING}/criativo/loja?formato=feed`} download>Baixar arte da loja</a>
        {qr && <a href={qr} download="qr-minha-loja.png" className={classesBotao("secundario")}>Baixar QR Code</a>}
        {erroQr && <Botao variante="secundario" onClick={() => setTentativa((v) => v + 1)}>Gerar QR novamente</Botao>}
        <Botao variante="secundario" disabled={!qr} onClick={() => window.print()}>Imprimir kit</Botao>
        <p role="status" className="text-sm text-texto-suave">{aviso}</p>
      </div>
    </div>
  </section>;
}
