import type { Metadata } from "next";
import { Clock, ExternalLink, Sparkles } from "lucide-react";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { listarCidades } from "@/lib/dados/regiao";
import { linkLoja, preco, urlAbsoluta } from "@/lib/formato";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { Aviso } from "@/components/conta/aviso";
import { FormMinhaLoja } from "@/components/conta/form-minha-loja";
import { DestaquesAtivos } from "@/components/destaques/destaques-ativos";
import { resultadosDestaques } from "@/lib/dados/destaques";
import { LINK_DESTACAR_LOJA, linkDestacarLoja } from "@/lib/rotas";

export const metadata: Metadata = { title: "Minha loja" };

// T38 · Minha loja (só para lojas): capa, logo, nome, descrição, WhatsApp e endereço.
export default async function PaginaMinhaLoja() {
  const conta = await meuPerfilEVitrine();
  const v = conta?.vitrine;
  if (!v || v.tipo !== "loja") {
    return (
      <PaginaConta>
        <TopoConta titulo="Minha loja" />
        <Vazio
          titulo="Você ainda não tem uma loja"
          texto="Com uma loja você ganha uma vitrine com seu nome e seu link no OLAKI."
        >
          <Botao href="/quero-vender/loja" larguraTotal>
            Abrir minha loja
          </Botao>
        </Vazio>
      </PaginaConta>
    );
  }
  const [cidades, destaques] = await Promise.all([listarCidades(v.microrregiao_id), resultadosDestaques()]);
  const destaquesLoja = destaques.filter((d) => d.tipo === "loja");
  const lojaPendente = destaquesLoja.find((d) => d.status === "aguardando_pagamento" && d.pagamento_status === "pendente");
  const endereco = urlAbsoluta(linkLoja(v.slug)).replace(/^https?:\/\//, "");

  return (
    <PaginaConta>
      <TopoConta titulo="Minha loja">
        <p className="break-all text-base text-texto-suave">
          Sua vitrine: <strong className="text-texto">{endereco}</strong>
        </p>
        {v.status === "ativa" && (
          <Botao href={linkLoja(v.slug)} variante="secundario" icone={<ExternalLink />} larguraTotal className="sm:w-fit">
            Ver minha vitrine
          </Botao>
        )}
      </TopoConta>

      {v.status !== "ativa" && (
        <Aviso tipo="atencao">
          {v.status === "suspensa"
            ? "Sua loja está suspensa e não aparece no site. Fale com o suporte."
            : "Sua loja está com pagamento atrasado. Veja em Meu plano."}
        </Aviso>
      )}

      {v.status === "ativa" && (
        <section aria-labelledby="titulo-destacar-loja" className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
          <h2 id="titulo-destacar-loja" className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="size-5 text-laranja-escuro" aria-hidden />
            Destacar minha loja
          </h2>
          <p className="text-base text-texto-suave">Sua loja aparece em &quot;Lojas em destaque&quot; na página inicial da sua região.</p>
          {lojaPendente ? (
            <>
              <p className="flex items-start gap-2 rounded-card bg-aviso-fundo p-3 text-sm font-semibold text-aviso">
                <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                Pagamento pendente: {lojaPendente.tipo_nome} ({preco(lojaPendente.preco_centavos)})
              </p>
              <Botao href={linkDestacarLoja(lojaPendente.id)} variante="secundario" larguraTotal className="sm:w-fit">
                Continuar o pagamento
              </Botao>
            </>
          ) : (
            <Botao href={LINK_DESTACAR_LOJA} variante="secundario" larguraTotal icone={<Sparkles />} className="sm:w-fit">
              Ver opções de destaque
            </Botao>
          )}
        </section>
      )}
      <DestaquesAtivos lista={destaquesLoja} titulo="Destaques da loja" />

      <FormMinhaLoja
        loja={{
          nome: v.nome,
          descricao: v.descricao,
          whatsapp: v.whatsapp,
          cidade: v.cidade,
          bairro: v.bairro,
          logo_url: v.logo_url,
          capa_url: v.capa_url,
        }}
        cidades={cidades}
      />
    </PaginaConta>
  );
}
