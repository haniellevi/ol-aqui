import type { Metadata } from "next";
import { minhaVitrineCompleta, opcoesVitrine } from "@/lib/dados/vitrine-completa";
import { LINK_MINHA_LOJA } from "@/lib/rotas";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { FormInformacoes } from "@/components/vitrine/form-informacoes";

export const metadata: Metadata = { title: "Informações da loja" };

// Informações da vitrine (todas opcionais). As formas de pagamento vêm da lista do painel.
export default async function PaginaInformacoesLoja() {
  const v = await minhaVitrineCompleta(true);
  if (!v || v.tipo !== "loja") {
    return (
      <PaginaConta>
        <TopoConta titulo="Informações da loja" />
        <Vazio titulo="Você ainda não tem uma loja" texto="Abra sua loja para mostrar endereço, horário e mais.">
          <Botao href="/quero-vender/loja" larguraTotal>
            Abrir minha loja
          </Botao>
        </Vazio>
      </PaginaConta>
    );
  }
  const opcoes = await opcoesVitrine(v.microrregiao_id);
  return (
    <PaginaConta>
      <TopoConta
        titulo="Informações da loja"
        texto="Tudo aqui é opcional. O que você preencher aparece na sua vitrine."
        voltar={LINK_MINHA_LOJA}
        textoVoltar="Minha loja"
      />
      <FormInformacoes
        dados={{
          endereco: v.endereco,
          lat: v.lat,
          lng: v.lng,
          horarios: v.horarios,
          instagram: v.instagram,
          sobre: v.sobre ?? v.descricao,
          formas_pagamento: v.formas_pagamento,
          faz_entrega: v.faz_entrega,
          entrega_obs: v.entrega_obs,
        }}
        formasDoPainel={opcoes.formasPagamento}
      />
    </PaginaConta>
  );
}
