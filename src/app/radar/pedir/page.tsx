// /radar/pedir: o comprador diz o que procura. Prazos e limites vêm do painel (configuracoes).
// O celular confirmado vem do Clerk: sincronizamos antes de mostrar o formulário.
// Enquanto o painel não exige o código (radar.exigir_celular_confirmado = false), quem não
// confirmou digita o WhatsApp no próprio formulário.
// Sem login a pessoa também escreve o pedido (região do visitante, sem IA); no fim o formulário
// guarda o rascunho e manda entrar. Volta por ?retomar=1 já no resumo (src/lib/rascunho-radar.ts).
import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ChevronLeft, Smartphone } from "lucide-react";
import { garantirPerfil, sincronizarPerfil } from "@/lib/perfil";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { listarCategorias } from "@/lib/dados/categorias";
import { listarCidades, regiaoAtual } from "@/lib/dados/regiao";
import { exigeCelularConfirmado, regrasRadar } from "@/lib/dados/radar";
import { telefone } from "@/lib/formato";
import { LINK_RADAR } from "@/lib/rotas";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { FormPedido } from "@/components/radar/form-pedido";
import { estadoRadarIA } from "@/lib/radar-ia/uso";
import { LINK_VOLTAR } from "@/components/radar/util";
import { Alert } from "@/components/ui/alert";

export const metadata = { title: "Estou procurando…" };

export default async function PedirRadarPage({ searchParams }: { searchParams: Promise<{ q?: string; categoria?: string; categoria_id?: string; cidade?: string; preco_min?: string; preco_max?: string; detalhes?: string; cidades?: string; quem?: string; retomar?: string }> }) {
  const params = await searchParams;
  const textoParametro = (v: unknown, max = 120) => typeof v === "string" ? v.slice(0, max) : "";
  const { userId } = await auth();
  const filtros = {
    texto: textoParametro(params.q),
    categoriaSlug: textoParametro(params.categoria),
    categoriaId: textoParametro(params.categoria_id, 36),
    detalhes: textoParametro(params.detalhes, 1000),
    cidadesIds: textoParametro(params.cidades, 20 * 37).split(",").slice(0, 20),
    visibilidade: params.quem === "todos" ? ("todos" as const) : ("lojas" as const),
    cidadeBusca: textoParametro(params.cidade),
    precoMin: textoParametro(params.preco_min),
    precoMax: textoParametro(params.preco_max),
  };

  if (!userId) {
    const regiao = await regiaoAtual();
    return (
      <Moldura>
        {regiao ? <Formulario microrregiaoId={regiao.id} {...filtros} pedirWhatsapp={false} whatsappInicial="" anonimo /> : <ErroConta />}
      </Moldura>
    );
  }

  await garantirPerfil();
  const u = await currentUser();
  if (!u) throw new Error("Não foi possível confirmar sua sessão.");
  await sincronizarPerfil(u);
  const conta = await meuPerfilEVitrine();
  const confirmado = !!conta?.perfil.whatsapp && !!conta.perfil.whatsapp_verificado_em;
  const exigeCodigo = conta && !confirmado ? await exigeCelularConfirmado(conta.perfil.microrregiao_id) : false;

  return (
    <Moldura>
      {!conta ? (
        <ErroConta />
      ) : exigeCodigo ? (
        <Vazio
          tamanho="grande"
          icone={<Smartphone />}
          titulo="Confirme seu celular primeiro"
          texto="As lojas falam com você pelo WhatsApp. Para pedir no Radar, seu celular precisa estar confirmado."
        >
          <Botao href="/confirmar-celular?destino=%2Fradar%2Fpedir" larguraTotal tamanho="grande">
            Confirmar meu celular
          </Botao>
          <Botao href={LINK_RADAR} variante="texto" tamanho="grande">
            Voltar ao Radar
          </Botao>
        </Vazio>
      ) : (
        <Formulario
          microrregiaoId={conta.perfil.microrregiao_id}
          {...filtros}
          pedirWhatsapp={!confirmado}
          whatsappInicial={conta.perfil.whatsapp ? telefone(conta.perfil.whatsapp) : ""}
          retomar={params.retomar === "1"}
        />
      )}
    </Moldura>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-1">
        <Link href={LINK_RADAR} className={LINK_VOLTAR}>
          <ChevronLeft className="size-5" aria-hidden />
          Radar
        </Link>
        <h1 className="text-facil-titulo font-semibold text-beringela">Estou procurando…</h1>
        <p className="text-facil text-texto-suave">Diga o que precisa. As lojas da região te respondem.</p>
      </header>
      {children}
    </main>
  );
}

function ErroConta() {
  return (
    <Vazio tamanho="grande" titulo="Algo deu errado" texto="Não conseguimos abrir sua conta agora. Tente de novo.">
      <Botao href="/radar/pedir" larguraTotal tamanho="grande">
        Tentar de novo
      </Botao>
    </Vazio>
  );
}

async function Formulario({
  microrregiaoId,
  texto,
  categoriaSlug, categoriaId, detalhes, cidadesIds, visibilidade, cidadeBusca, precoMin, precoMax,
  pedirWhatsapp,
  whatsappInicial,
  anonimo = false,
  retomar = false,
}: {
  microrregiaoId: string;
  texto: string;
  categoriaSlug: string; categoriaId: string; detalhes: string; cidadesIds: string[]; visibilidade: "lojas" | "todos";
  cidadeBusca: string; precoMin: string; precoMax: string;
  pedirWhatsapp: boolean;
  whatsappInicial: string;
  /** Sem login: escreve o pedido e entra no fim. */
  anonimo?: boolean;
  /** Voltou do login: abre o rascunho guardado no aparelho. */
  retomar?: boolean;
}) {
  const [categorias, cidades, regras, regiao, ia] = await Promise.all([listarCategorias(), listarCidades(microrregiaoId), regrasRadar(microrregiaoId), regiaoAtual(), estadoRadarIA()]);
  const opcoes = categorias.flatMap((c) => [c, ...c.filhas]);
  const categoriaInicial = opcoes.find((c) => (categoriaId && c.id === categoriaId) || (categoriaSlug && c.slug === categoriaSlug));
  // "Pedir de novo": só as cidades que ainda estão ativas na região do cadastro.
  const cidadesIniciais = cidadesIds.filter((id) => cidades.some((c) => c.id === id));
  // Radar v2: "Toda a região" vem marcado (docs/designs/radar-v2.md); a pessoa marca cidades no passo "Onde?".
  const cidadeEscolhida = cidadeBusca || regiao?.cidade;
  const cidadeFora = !!cidadeEscolhida && !cidades.some((c) => c.nome === cidadeEscolhida);
  return (
    <>
      {cidadeFora && <Alert variant="warning" role="status" className="text-facil">A cidade da busca fica fora da região do seu cadastro. Seu pedido vai para as lojas da região do seu cadastro.</Alert>}
      <FormPedido
        textoInicial={texto.slice(0, 120)}
        categorias={categorias.map((c) => ({ id: c.id, nome: c.nome, filhas: c.filhas.map(({ id, nome }) => ({ id, nome })) }))}
        categoriaInicial={categoriaInicial?.id ?? null}
        precoMinInicial={precoMin}
        precoMaxInicial={precoMax}
        detalhesInicial={detalhes}
        visibilidadeInicial={visibilidade}
        cidadesIniciais={cidadesIniciais.length > 0 ? cidadesIniciais : undefined}
        cidades={cidades.map((c) => ({ id: c.id, nome: c.nome }))}
        regras={regras}
        pedirWhatsapp={pedirWhatsapp}
        whatsappInicial={whatsappInicial}
        iaNoPedido={!anonimo && (ia.perguntas || ia.parecidos)}
        anonimo={anonimo}
        retomar={retomar}
      />
    </>
  );
}
