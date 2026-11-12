import type { Metadata } from "next";
import { meusRecursosVitrine, minhaVitrineCompleta, opcoesVitrine, planosPublicos } from "@/lib/dados/vitrine-completa";
import { LINK_MINHA_LOJA } from "@/lib/rotas";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { Aviso } from "@/components/conta/aviso";
import { EditorBannerAki } from "@/components/vitrine/editor-banner-aki";
import { FormBanner } from "@/components/vitrine/form-banner";
import { textoDisponivelEm } from "@/components/vitrine/regras";

export const metadata: Metadata = { title: "Capa da loja" };

// Banner da vitrine: foto da fachada (se o plano tiver) ou modelo pronto com a cor do painel.
export default async function PaginaBannerLoja() {
  const v = await minhaVitrineCompleta(true);
  if (!v || v.tipo !== "loja") {
    return (
      <PaginaConta>
        <TopoConta titulo="Capa da loja" />
        <Vazio titulo="Você ainda não tem uma loja" texto="Abra sua loja para ter uma vitrine com banner.">
          <Botao href="/quero-vender/loja" larguraTotal>
            Abrir minha loja
          </Botao>
        </Vazio>
      </PaginaConta>
    );
  }
  const [recursos, opcoes, planos] = await Promise.all([meusRecursosVitrine(true), opcoesVitrine(v.microrregiao_id), planosPublicos()]);

  return (
    <PaginaConta>
      <TopoConta
        titulo="Capa da loja"
        texto="É a primeira coisa que o cliente vê na sua vitrine."
        voltar={LINK_MINHA_LOJA}
        textoVoltar="Minha loja"
      />
      {recursos.banner_moderado_motivo && (
        <Aviso tipo="atencao">
          <span>A equipe do Mercado da Região tirou a foto do seu banner.</span>
          <span className="font-normal">Motivo: {recursos.banner_moderado_motivo}</span>
        </Aviso>
      )}
      <EditorBannerAki lojaId={v.id} nome={v.nome} logo={v.logo_url} corInicial={v.banner_cor}
        atual={v.banner_aki_posicao != null && v.banner_url ? { url: v.banner_url, posicao: v.banner_aki_posicao } : null} />
      <FormBanner
        key={v.banner_url ?? "modelo"}
        inicial={{ tipo: v.banner_aki_posicao != null ? "modelo" : v.banner_tipo,
          url: v.banner_aki_posicao != null ? null : v.banner_url, modelo: v.banner_modelo, cor: v.banner_cor }}
        nome={v.nome}
        logo={v.logo_url}
        cores={opcoes.cores}
        podeFoto={recursos.foto_fachada}
        disponivelFoto={textoDisponivelEm(planos, "foto")}
      />
    </PaginaConta>
  );
}
