import type { Metadata } from "next";
import { LayoutList } from "lucide-react";
import { meusRecursosVitrine, minhaVitrineCompleta, minhasSecoes, planosPublicos } from "@/lib/dados/vitrine-completa";
import { LINK_MINHA_LOJA, LINK_PLANOS } from "@/lib/rotas";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { Aviso } from "@/components/conta/aviso";
import { GerenciarSecoes } from "@/components/vitrine/gerenciar-secoes";
import { UpsellPlano } from "@/components/vitrine/upsell-plano";
import { textoDisponivelEm } from "@/components/vitrine/regras";

export const metadata: Metadata = { title: "Seções da loja" };

// Seções próprias ("Promoções", "Linha infantil"): aparecem acima dos grupos automáticos.
// Quantas o plano permite vem da tabela de planos; o banco confere ao criar e esconde o excesso.
export default async function PaginaSecoesLoja() {
  const v = await minhaVitrineCompleta();
  if (!v || v.tipo !== "loja") {
    return (
      <PaginaConta>
        <TopoConta titulo="Seções da loja" />
        <Vazio titulo="Você ainda não tem uma loja" texto="Abra sua loja para organizar seus produtos em seções.">
          <Botao href="/quero-vender/loja" larguraTotal>
            Abrir minha loja
          </Botao>
        </Vazio>
      </PaginaConta>
    );
  }
  const [recursos, secoes, planos] = await Promise.all([meusRecursosVitrine(), minhasSecoes(v.id), planosPublicos()]);
  const maximo = recursos.secoes_max;
  const noPlano = maximo === null || maximo > 0;
  const podeCriar = maximo === null || secoes.length < maximo;
  const disponivel = textoDisponivelEm(planos, "secoes");

  return (
    <PaginaConta>
      <TopoConta
        titulo="Seções da loja"
        texto="Crie seções como “Promoções” e escolha os produtos. Elas aparecem no alto da vitrine, antes das categorias."
        voltar={LINK_MINHA_LOJA}
        textoVoltar="Minha loja"
      />

      {!noPlano && (
        <UpsellPlano titulo="Seções próprias na vitrine" texto="Organize seus produtos do seu jeito, com o nome que quiser." disponivel={disponivel} />
      )}
      {noPlano && maximo !== null && (
        <p className="text-base font-semibold">
          Seu plano mostra até {maximo} {maximo === 1 ? "seção" : "seções"}. Você tem {secoes.length}.
        </p>
      )}
      {noPlano && !podeCriar && (
        <Aviso tipo="info">
          <span>Você chegou ao limite de seções do seu plano. Apague uma para criar outra.</span>
          <a href={`${LINK_PLANOS}?origem=vitrine`} className="inline-flex min-h-12 items-center text-laranja-escuro underline underline-offset-4">
            Ver planos com mais seções
          </a>
        </Aviso>
      )}

      {secoes.length === 0 && noPlano && (
        <Vazio icone={<LayoutList />} titulo="Nenhuma seção ainda" texto="Comece com uma seção de promoções: é a que mais chama atenção. Escreva o nome logo abaixo." />
      )}
      {(secoes.length > 0 || noPlano) && <GerenciarSecoes secoes={secoes} maximo={maximo} podeCriar={noPlano && podeCriar} />}
    </PaginaConta>
  );
}
