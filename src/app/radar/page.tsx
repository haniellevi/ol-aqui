// app/radar/page.tsx
// Server Component: busca os pedidos e decide, NO SERVIDOR, o que o usuário pode ver.
// Quem não tem acesso ao Radar nunca recebe detalhes nem nome do comprador no HTML.
// Preços dos planos vêm da tabela `planos` (editável no painel), nunca do código.
import { auth } from "@clerk/nextjs/server";
import { Radar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { garantirPerfil } from "@/lib/perfil";
import { listarCategorias } from "@/lib/dados/categorias";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { acessoRadar, meusPedidos, minhasPropostas, planosComRadar } from "@/lib/dados/radar";
import { linkPedirRadar } from "@/lib/rotas";
import { Botao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import { RadarDeNegocios, type PedidoRadar } from "@/components/radar/radar-de-negocios";
import { AbasRadar, type AbaRadar } from "@/components/radar/abas-radar";
import { ExplicacaoRadar } from "@/components/radar/explicacao-radar";
import { AtualizarRadar } from "@/components/radar/atualizar-radar";
import { ListaMeusPedidos, ListaMinhasPropostas } from "@/components/radar/listas-radar";

export const metadata = {
  title: "Radar de Negócios",
  description: "Peça o que você procura e as lojas da região mandam ofertas.",
};

const POR_PAGINA = 40;
const PAGINA_MAXIMA = 25001;

type LinhaFeed = {
  id: string;
  titulo: string;
  detalhes: string | null;
  preco_min_centavos: number | null;
  preco_max_centavos: number | null;
  categoria_nome: string | null;
  cidade: string;
  urgencia: PedidoRadar["urgencia"];
  total_propostas: number;
  max_propostas: number;
  modo_contato: PedidoRadar["modoContato"];
  propostas_ate: string | null;
  criado_em: string;
  comprador_certificado: boolean;
  comprador_primeiro_nome: string | null;
  ja_propus: boolean;
  sou_comprador: boolean;
};

type ParametrosRadar = Promise<{ aba?: string; q?: string; nicho?: string; pagina?: string; arquivo?: string }>;

export default async function RadarPage({ searchParams }: { searchParams: ParametrosRadar }) {
  const { aba, q, nicho, pagina, arquivo } = await searchParams;
  const textoBusca = typeof q === "string" ? q : null;
  const { userId } = await auth();

  // Visitante: explica o Radar em 3 passos (pedir exige entrar com o celular).
  if (!userId) return <ExplicacaoRadar textoBusca={textoBusca} />;

  await garantirPerfil();
  const conta = await meuPerfilEVitrine();
  if (!conta) throw new Error("Não foi possível carregar sua conta. Tente novamente.");
  const vende = Boolean(conta.vitrine);

  // Quem vende vê os pedidos da região e as propostas que mandou; todos veem os próprios pedidos.
  const abas: AbaRadar[] = vende ? ["regiao", "meus", "propostas"] : ["meus", "regiao"];
  const atual: AbaRadar = abas.includes(aba as AbaRadar) ? (aba as AbaRadar) : vende ? "regiao" : "meus";
  const linkPedir = linkPedirRadar(textoBusca);
  const navAbas = <AbasRadar atual={atual} abas={abas} />;

  if (atual === "meus") {
    const arquivados = arquivo === "1";
    const pedidos = await meusPedidos(arquivados);
    return (
      <Moldura titulo={arquivados ? "Pedidos arquivados" : "Meus pedidos"} abas={navAbas}>
        <nav aria-label="Histórico de pedidos" className="flex flex-wrap gap-2">
          <Chip href="/radar?aba=meus" ativo={!arquivados}>Pedidos</Chip>
          <Chip href="/radar?aba=meus&arquivo=1" ativo={arquivados}>Arquivados</Chip>
        </nav>
        {!arquivados && pedidos.length > 0 && (
          <Botao href={linkPedir} larguraTotal>
            Pedir outra coisa
          </Botao>
        )}
        <ListaMeusPedidos pedidos={pedidos} linkPedir={linkPedir} arquivados={arquivados} />
      </Moldura>
    );
  }

  if (atual === "propostas") {
    const propostas = await minhasPropostas();
    return (
      <Moldura titulo="Minhas propostas" abas={navAbas}>
        <ListaMinhasPropostas propostas={propostas} />
      </Moldura>
    );
  }

  // Aba "Pedidos na região".
  const supabase = await createClient();
  const [{ temAcesso, restantes }, planos, categorias] = await Promise.all([acessoRadar(), planosComRadar(), listarCategorias()]);
  const categoria = categorias.flatMap((c) => [c, ...c.filhas]).find((c) => c.id === nicho);
  let filtro = "todas";
  if (categoria) filtro = "categoria";
  else if (nicho === "sem_categoria" || (nicho === "meu_nicho" && vende)) filtro = nicho;
  const nichoAtivo = categoria?.id ?? filtro;
  const numeroPagina = typeof pagina === "string" ? Number(pagina) : 1;
  const atualPagina = Number.isSafeInteger(numeroPagina) && numeroPagina >= 1 && numeroPagina <= PAGINA_MAXIMA ? numeroPagina : 1;

  const { data, error } = await supabase.rpc("radar_feed_regional", {
    p_filtro: filtro,
    p_categoria_id: categoria?.id ?? null,
    p_limite: POR_PAGINA + 1,
    p_deslocamento: (atualPagina - 1) * POR_PAGINA,
  });
  if (error) throw new Error("Não foi possível carregar os pedidos da região.");

  const linhas = (data ?? []) as LinhaFeed[];
  const pedidos: PedidoRadar[] = linhas.slice(0, POR_PAGINA).map((p) => ({
    id: p.id,
    titulo: p.titulo,
    cidade: p.cidade,
    urgencia: p.urgencia,
    precoMinCentavos: p.preco_min_centavos,
    precoMaxCentavos: p.preco_max_centavos,
    categoriaNome: p.categoria_nome,
    totalPropostas: p.total_propostas,
    maxPropostas: p.max_propostas,
    modoContato: p.modo_contato,
    propostasAte: p.propostas_ate,
    criadoEm: p.criado_em,
    compradorCertificado: p.comprador_certificado,
    jaPropus: p.ja_propus,
    souComprador: p.sou_comprador,
    // Bloqueio real: o banco já devolve null para quem não tem acesso; aqui reforçamos.
    detalhes: temAcesso || p.sou_comprador ? p.detalhes : null,
    compradorNome: temAcesso ? p.comprador_primeiro_nome : null,
  }));

  function linkPagina(n: number) {
    const parametros = new URLSearchParams({ aba: "regiao", nicho: nichoAtivo });
    if (textoBusca) parametros.set("q", textoBusca);
    if (n > 1) parametros.set("pagina", String(n));
    return `/radar?${parametros}`;
  }

  return (
    <RadarDeNegocios
      pedidos={pedidos}
      categorias={categorias}
      nicho={nichoAtivo}
      vende={vende}
      textoBusca={textoBusca}
      pagina={atualPagina}
      anterior={atualPagina > 1 ? linkPagina(atualPagina - 1) : undefined}
      proxima={linhas.length > POR_PAGINA && atualPagina < PAGINA_MAXIMA ? linkPagina(atualPagina + 1) : undefined}
      temAcesso={temAcesso}
      propostasRestantes={temAcesso ? restantes : 0}
      emTeste={conta.plano?.e_teste === true}
      planos={planos.map((p) => ({ codigo: p.codigo, nome: p.nome, preco_centavos: p.preco_centavos, periodo_dias: p.periodo_dias }))}
      abas={navAbas}
    />
  );
}

function Moldura({ titulo, abas, children }: { titulo: string; abas: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh max-w-xl bg-fundo pb-28">
      <header className="sticky top-13 z-10 border-b border-borda bg-cartao/95 px-4 pt-4 pb-3 backdrop-blur md:top-14">
        <div className="flex items-center gap-2">
          <Radar className="size-6 text-laranja-escuro" aria-hidden />
          <h1 className="text-titulo font-semibold text-beringela">Radar de Negócios</h1>
        </div>
        <p className="mt-0.5 text-sm text-texto-suave">{titulo}</p>
        {abas}
      </header>
      <div className="flex flex-col gap-4 px-4 pt-4"><div className="flex justify-end"><AtualizarRadar /></div>{children}</div>
    </main>
  );
}
