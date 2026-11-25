"use client";

import { Botao } from "@/components/ui/botao";
import { CopiarLinkLoja } from "@/components/vitrine/copiar-link-loja";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { linkLoja, urlAbsoluta } from "@/lib/formato";
import { linkAssistente } from "@/lib/assistente";

export function LojaPronta({ slug, assistente, recebida = false, testeAte }: { slug: string; assistente?: string; recebida?: boolean; testeAte?: string | null }) {
  const url = urlAbsoluta(linkLoja(slug));
  return <Card aria-live="polite">
    <CardHeader>
      <h2 className="text-titulo font-semibold text-beringela">{recebida ? "Sua loja foi recebida" : "Sua loja foi criada"}</h2>
      <p className="text-base">Agora confira seus produtos e publique o primeiro anúncio. Depois, compartilhe sua vitrine.</p>
      {testeAte && new Date(testeAte).getTime() > Date.now() && <p className="text-sm text-texto-suave">Teste grátis até {new Intl.DateTimeFormat("pt-BR").format(new Date(testeAte))}.</p>}
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      <Botao href={assistente ? linkAssistente("loja", assistente) : "/anunciar"} tamanho="acao">Criar primeiro anúncio</Botao>
      <Botao href={linkLoja(slug)} variante="secundario">Ver minha loja</Botao>
      <details>
        <summary className="flex min-h-toque cursor-pointer items-center text-base font-semibold text-laranja-escuro">Compartilhar minha vitrine</summary>
        <div className="flex flex-col gap-3 pt-3">
          <p className="break-all text-sm">{url}</p>
          <CopiarLinkLoja url={url} />
          <Botao href={`https://wa.me/?text=${encodeURIComponent(`Conheça minha loja no Mercado da Região: ${url}`)}`} variante="secundario" target="_blank" rel="noopener noreferrer">Compartilhar no WhatsApp</Botao>
        </div>
      </details>
    </CardContent>
  </Card>;
}
