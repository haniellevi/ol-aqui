"use client";

import { useCallback, useEffect, useState } from "react";
import { Botao, type TamanhoBotao } from "@/components/ui/botao";
import { comAssistente, destinoRadarAssistente, type BuscaAssistente, type ObjetivoAssistente } from "@/lib/assistente";
import { linkAvulso, linkPedirRadar } from "@/lib/rotas";
import { concluirProgresso, marcarConviteVisto, progressoAtual, salvarProgresso } from "./progresso";
import { urlPasso, type SlugPasso } from "@/components/anunciar/passos";

export function VincularAssistente({ dono, objetivo, tentativa, destino }: { dono: string; objetivo: ObjetivoAssistente; tentativa: string; destino?: string }) {
  const vincular = useCallback(() => {
    const visitante = progressoAtual(null);
    if (visitante?.tentativa === tentativa && visitante.objetivo === objetivo) {
      salvarProgresso(dono, { ...visitante, dono });
      salvarProgresso(null, null);
    }
  }, [dono, objetivo, tentativa]);
  useEffect(vincular, [vincular]);
  return destino ? <Botao tamanho="acao" href={destino} onClick={vincular}>Completar minha conta</Botao> : null;
}

export function RetomarRadar({ dono, tentativa }: { dono: string; tentativa: string }) {
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => {
    setHref(destinoRadarAssistente(progressoAtual(dono), tentativa));
  }, [dono, tentativa]);
  return href ? <Botao tamanho="acao" href={href}>Continuar no Radar</Botao>
    : <Botao tamanho="acao" disabled>Continuar no Radar</Botao>;
}

export function RegistrarAnuncio({ dono, tentativa, id, passo, pagamento }: { dono: string; tentativa: string; id: string; passo: SlugPasso; pagamento?: string }) {
  useEffect(() => {
    const atual = progressoAtual(dono);
    if (atual?.tentativa === tentativa && (atual.objetivo === "item" || atual.objetivo === "loja")) {
      salvarProgresso(dono, { ...atual, anuncio: { id, passo, pagamento } });
    }
  }, [dono, tentativa, id, passo, pagamento]);
  return null;
}

export function ConcluirAssistente({ dono, tentativa, anuncioId }: { dono: string; tentativa: string; anuncioId?: string }) {
  useEffect(() => {
    if (anuncioId && progressoAtual(dono)?.anuncio?.id !== anuncioId) return;
    concluirProgresso(dono, tentativa);
  }, [dono, tentativa, anuncioId]);
  return null;
}

export function AbrirRadarAssistido({ busca, dono, texto = "Publicar pedido no Radar", tamanho = "grande" }: { busca: BuscaAssistente; dono: string | null; texto?: string; tamanho?: TamanhoBotao }) {
  function abrir(evento: React.MouseEvent<HTMLAnchorElement>) {
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
    const tentativa = crypto.randomUUID();
    marcarConviteVisto();
    salvarProgresso(dono, { dono, tentativa, objetivo: "procurar", radar: busca });
    if (progressoAtual(dono)?.tentativa !== tentativa) return;
    evento.preventDefault();
    const params = new URLSearchParams({ objetivo: "procurar", tentativa, radar: "1" });
    window.location.assign(`/assistente?${params}`);
  }
  return <Botao href={linkPedirRadar(busca.q, busca)} onClick={abrir} tamanho={tamanho} larguraTotal>{texto}</Botao>;
}

export function EscolherRadar({ dono, tentativa, href }: { dono: string | null; tentativa: string; href: string }) {
  return <Botao href={href} tamanho="acao" onClick={() => {
    const atual = progressoAtual(dono);
    if (atual?.tentativa === tentativa) salvarProgresso(dono, { ...atual, radar: atual.radar ?? {} });
  }}>Publicar pedido no Radar</Botao>;
}

export function RetomarAnuncio({ dono, tentativa, rascunhos, publicados }: {
  dono: string; tentativa: string; rascunhos: string[]; publicados: string[];
}) {
  const [href, setHref] = useState("");
  useEffect(() => {
    const atual = progressoAtual(dono);
    const anuncio = atual?.tentativa === tentativa ? atual.anuncio : undefined;
    if (!anuncio) {
      setHref("");
      return;
    }
    if (publicados.includes(anuncio.id)) {
      setHref(comAssistente(`/anunciar/pronto?id=${encodeURIComponent(anuncio.id)}`, tentativa));
    } else if (rascunhos.includes(anuncio.id)) {
      setHref(anuncio.pagamento
        ? comAssistente(linkAvulso(anuncio.id, anuncio.pagamento), tentativa)
        : urlPasso(anuncio.passo, anuncio.id, false, false, tentativa));
    } else {
      setHref("");
    }
  }, [dono, tentativa, rascunhos, publicados]);
  return href ? <Botao href={href}>Continuar anúncio</Botao> : null;
}

export function ContinuarBusca({ dono, tentativa }: { dono: string | null; tentativa: string }) {
  return <Botao href="/busca" variante="secundario" onClick={() => concluirProgresso(dono, tentativa)}>Buscar anúncios</Botao>;
}
