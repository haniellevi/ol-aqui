// app/radar/page.tsx
// Server Component: busca os pedidos e decide, NO SERVIDOR, o que o usuário pode ver.
// Quem não tem acesso ao Radar nunca recebe detalhes nem nome do comprador no HTML.
// Preços dos planos vêm da tabela `planos` (editável no painel), nunca do código.
import { auth } from "@clerk/nextjs/server";
import { Radar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { garantirPerfil } from "@/lib/perfil";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { acessoRadar, meusPedidos, minhasPropostas, planosComRadar } from "@/lib/dados/radar";
import { linkPedirRadar } from "@/lib/rotas";
import { Botao } from "@/components/ui/botao";
import { RadarDeNegocios, type PedidoRadar, type CategoriaRadar } from "@/components/radar/radar-de-negocios";
import { AbasRadar, type AbaRadar } from "@/components/radar/abas-radar";
import { ExplicacaoRadar } from "@/components/radar/explicacao-radar";
import { ListaMeusPedidos, ListaMinhasPropostas } from "@/components/radar/listas-radar";

export const metadata = {
  title: "Radar de Negócios · OLAKI",
  description: "Peça o que você procura e as lojas da região mandam ofertas.",
};

type LinhaFeed = {
  id: string;
  categoria: CategoriaRadar;
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

export default async function RadarPage({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string }> }) {
  const { aba, q } = await searchParams;
  const { userId } = await auth();

  // Visitante: explica o Radar em 3 passos (pedir exige entrar com o celular).
  if (!userId) return <ExplicacaoRadar textoBusca={q ?? null} />;

  await garantirPerfil();
  const conta = await meuPerfilEVitrine();
  const vende = Boolean(conta?.vitrine);

  // Quem vende vê os pedidos da região e as propostas que mandou; todos veem os próprios pedidos.
  const abas: AbaRadar[] = vende ? ["regiao", "meus", "propostas"] : ["meus", "regiao"];
  const atual: AbaRadar = abas.includes(aba as AbaRadar) ? (aba as AbaRadar) : vende ? "regiao" : "meus";
  const linkPedir = linkPedirRadar(q ?? null);
  const navAbas = <AbasRadar atual={atual} abas={abas} />;

  if (atual === "meus") {
    const pedidos = await meusPedidos();
    return (
      <Moldura titulo="Meus pedidos" abas={navAbas}>
        {pedidos.length > 0 && (
          <Botao href={linkPedir} larguraTotal>
            Pedir outra coisa
          </Botao>
        )}
        <ListaMeusPedidos pedidos={pedidos} linkPedir={linkPedir} />
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
  const [{ temAcesso, restantes }, planos] = await Promise.all([acessoRadar(), planosComRadar()]);
  const { data } = await supabase
    .rpc("radar_feed")
    .eq("microrregiao_id", conta?.perfil.microrregiao_id ?? "")
    .select(
      "id, categoria, titulo, detalhes, preco_min_centavos, preco_max_centavos, categoria_nome, cidade, urgencia, total_propostas, max_propostas, modo_contato, propostas_ate, criado_em, comprador_certificado, comprador_primeiro_nome, ja_propus, sou_comprador",
    )
    .order("criado_em", { ascending: false })
    .limit(40);

  const pedidos: PedidoRadar[] = ((data ?? []) as unknown as LinhaFeed[]).map((p) => ({
    id: p.id,
    categoria: p.categoria,
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

  return (
    <RadarDeNegocios
      pedidos={pedidos}
      temAcesso={temAcesso}
      propostasRestantes={temAcesso ? restantes : 0}
      planos={planos.map((p) => ({ codigo: p.codigo, nome: p.nome, preco_centavos: p.preco_centavos }))}
      abas={navAbas}
    />
  );
}

function Moldura({ titulo, abas, children }: { titulo: string; abas: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh max-w-xl bg-fundo pb-28">
      <header className="sticky top-16 z-10 border-b border-borda bg-cartao/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <Radar className="size-6 text-laranja-escuro" aria-hidden />
          <h1 className="text-xl font-bold tracking-tight text-beringela">Radar de Negócios</h1>
        </div>
        <p className="mt-0.5 text-sm text-texto-suave">{titulo}</p>
        {abas}
      </header>
      <div className="flex flex-col gap-4 px-4 pt-4">{children}</div>
    </main>
  );
}
