// app/radar/page.tsx
// T26 · Radar: início. Aberto a todos.
// - Visitante: a explicação em 3 passos e o botão "Pedir no Radar" (o login vem só ao pedir).
// - Logado: "Meus pedidos" (comprador) e, para quem tem loja, "Pedidos da região".
// Na aba da loja, o servidor decide o que pode ser visto: quem não tem acesso ao Radar
// nunca recebe detalhes nem nome do comprador no HTML. Preços dos planos vêm da tabela `planos`.
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ChevronRight, Inbox, MessageCircle, Plus, Radar, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { garantirPerfil } from "@/lib/perfil";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { meusPedidos, type MeuPedido } from "@/lib/dados/radar";
import { precoFalado, tempoRelativo } from "@/lib/formato";
import { diaEHora, linkPedido, linkPedir, situacaoPedido } from "@/lib/radar";
import { RadarDeNegocios, type PedidoRadar, type PlanoResumo } from "@/components/radar/radar-de-negocios";
import { ComoFuncionaRadar } from "@/components/radar/como-funciona";
import { Botao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import { Vazio } from "@/components/ui/vazio";

export const metadata: Metadata = {
  title: "Radar · OLAKI",
  description: "Não achou o que queria? Diga o que procura e as lojas da região te chamam no WhatsApp.",
};

type Aba = "meus" | "regiao";

export default async function RadarPage({ searchParams }: { searchParams: Promise<{ aba?: string; pedido?: string }> }) {
  const { aba: abaPedida, pedido } = await searchParams;
  // Endereço antigo da busca sem resultado (/radar?pedido=...): vai direto para o pedido preenchido.
  if (pedido) redirect(linkPedir(pedido));
  const { userId } = await auth();

  if (!userId) {
    if (abaPedida === "regiao") redirect(`/entrar?redirect_url=${encodeURIComponent("/radar?aba=regiao")}`);
    return <RadarVisitante />;
  }

  await garantirPerfil();
  const conta = await meuPerfilEVitrine();
  const temLoja = !!conta?.vitrine;
  const aba: Aba = temLoja && abaPedida !== "meus" ? "regiao" : "meus";
  const abas = temLoja ? <Abas atual={aba} /> : null;

  if (aba === "regiao") return <PedidosDaRegiao abas={abas} />;
  return <MeusPedidos abas={abas} />;
}

/* ------------------------------ Visitante ------------------------------ */

function RadarVisitante() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-laranja-escuro">
          <Radar className="size-5" aria-hidden />
          Radar do OLAKI
        </p>
        <h1 className="text-2xl font-bold leading-8 text-beringela">Diga o que procura. As lojas da região te chamam.</h1>
        <p className="text-base text-texto-suave">Não precisa ficar procurando loja por loja. É de graça para quem compra.</p>
      </header>

      <ComoFuncionaRadar />

      <div className="flex flex-col gap-2">
        <Botao href="/radar/pedir" larguraTotal icone={<Radar />}>
          Pedir no Radar
        </Botao>
        <p className="text-center text-sm text-texto-suave">Para pedir, você entra com o seu celular. É rápido.</p>
      </div>

      <section aria-labelledby="titulo-loja" className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
        <div className="flex gap-3">
          <Store className="mt-0.5 size-6 shrink-0 text-laranja-escuro" aria-hidden />
          <div className="flex flex-col gap-1">
            <h2 id="titulo-loja" className="text-lg font-semibold">
              Tem uma loja?
            </h2>
            <p className="text-base text-texto-suave">Veja o que os compradores da região estão procurando agora e mande sua oferta.</p>
          </div>
        </div>
        <Botao href="/radar?aba=regiao" variante="secundario" larguraTotal>
          Ver pedidos da região
        </Botao>
      </section>
    </main>
  );
}

/* ------------------------------ Abas ------------------------------ */

function Abas({ atual }: { atual: Aba }) {
  return (
    <nav aria-label="Radar" className="mt-3 flex gap-2">
      <Chip href="/radar?aba=regiao" ativo={atual === "regiao"} icone={<Store />}>
        Pedidos da região
      </Chip>
      <Chip href="/radar?aba=meus" ativo={atual === "meus"} icone={<Inbox />}>
        Meus pedidos
      </Chip>
    </nav>
  );
}

/* ------------------------------ Comprador ------------------------------ */

async function MeusPedidos({ abas }: { abas: ReactNode }) {
  const pedidos = await meusPedidos();
  const agora = new Date();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold leading-8 text-beringela">
          <Radar className="size-6 text-laranja-escuro" aria-hidden />
          Meus pedidos
        </h1>
        <p className="text-base text-texto-suave">O que você pediu no Radar e as ofertas que chegaram.</p>
        {abas}
      </header>

      {pedidos.length === 0 ? (
        <>
          <Vazio
            icone={<Radar />}
            titulo="Você ainda não pediu nada no Radar."
            texto="Diga o que procura e as lojas da região te chamam no WhatsApp."
          >
            <Botao href="/radar/pedir" larguraTotal icone={<Radar />}>
              Pedir no Radar
            </Botao>
          </Vazio>
          <ComoFuncionaRadar />
        </>
      ) : (
        <>
          <Botao href="/radar/pedir" larguraTotal icone={<Plus />}>
            Fazer outro pedido
          </Botao>
          <ul className="flex flex-col gap-3">
            {pedidos.map((p) => (
              <li key={p.id}>
                <CartaoMeuPedido pedido={p} agora={agora} />
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function CartaoMeuPedido({ pedido: p, agora }: { pedido: MeuPedido; agora: Date }) {
  const s = situacaoPedido(p, agora);
  const ofertas =
    p.total_propostas === 0
      ? s.aberto
        ? "Esperando ofertas"
        : "Nenhuma oferta"
      : p.total_propostas === 1
        ? "1 oferta"
        : `${p.total_propostas} ofertas`;
  const prazo = s.aberto
    ? p.modo_contato === "propostas_prazo" && p.propostas_ate
      ? `Ofertas até ${diaEHora(p.propostas_ate)}`
      : `No ar até ${diaEHora(p.expira_em)}`
    : `Pedido ${tempoRelativo(p.criado_em)}`;

  return (
    <Link
      href={linkPedido(p.id)}
      className="flex items-center gap-3 rounded-card bg-cartao p-4 shadow-1 hover:bg-fundo focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[13px] font-bold ${s.cor}`}>{s.texto}</span>
          {p.modo_contato === "whatsapp_direto" && (
            <span className="inline-flex items-center gap-1 text-[13px] text-texto-suave">
              <MessageCircle className="size-4" aria-hidden />
              Te chamam no WhatsApp
            </span>
          )}
        </div>
        <p className="line-clamp-2 text-base font-semibold text-texto">{p.titulo}</p>
        <p className="text-[15px] text-texto-suave">
          {p.preco_max_centavos != null && <>Até {precoFalado(p.preco_max_centavos)} · </>}
          {p.cidade}
        </p>
        <p className="text-[15px]">
          <strong className="text-beringela">{ofertas}</strong>
          <span className="text-texto-suave"> · {prazo}</span>
        </p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-texto-suave" aria-hidden />
    </Link>
  );
}

/* ------------------------------ Loja ------------------------------ */

async function PedidosDaRegiao({ abas }: { abas: ReactNode }) {
  const userId = (await auth()).userId!;
  const supabase = await createClient();

  const [{ data: acesso }, { data: restantes }, { data: perfil }, { data: planos }] = await Promise.all([
    supabase.rpc("tem_plano_pago"),
    supabase.rpc("propostas_restantes"),
    supabase.from("perfis").select("microrregiao_id").eq("id", userId).single(),
    supabase
      .from("planos")
      .select("codigo, nome, preco_centavos")
      .eq("acesso_radar", true)
      .eq("e_teste", false)
      .order("ordem"),
  ]);
  const temAcesso = acesso === true;

  const { data } = await supabase
    .rpc("radar_feed")
    .eq("microrregiao_id", perfil?.microrregiao_id)
    .select(
      "id, categoria, titulo, detalhes, preco_max_centavos, cidade, urgencia, total_propostas, max_propostas, modo_contato, propostas_ate, criado_em, comprador_certificado, comprador_primeiro_nome, ja_propus",
    )
    .order("criado_em", { ascending: false })
    .limit(40);

  const pedidos: PedidoRadar[] = (data ?? []).map((p) => ({
    id: p.id,
    categoria: p.categoria,
    titulo: p.titulo,
    cidade: p.cidade,
    urgencia: p.urgencia,
    precoMaxCentavos: p.preco_max_centavos,
    totalPropostas: p.total_propostas,
    maxPropostas: p.max_propostas,
    modoContato: p.modo_contato,
    propostasAte: p.propostas_ate,
    criadoEm: p.criado_em,
    compradorCertificado: p.comprador_certificado,
    jaPropus: p.ja_propus,
    // Bloqueio real: dados sensíveis só vão para quem tem acesso.
    detalhes: temAcesso ? p.detalhes : null,
    compradorNome: temAcesso ? p.comprador_primeiro_nome : null,
  }));

  return (
    <RadarDeNegocios
      pedidos={pedidos}
      temAcesso={temAcesso}
      propostasRestantes={temAcesso ? (restantes as number | null) : 0}
      planos={(planos ?? []) as PlanoResumo[]}
      abas={abas}
    />
  );
}
