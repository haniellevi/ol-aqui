// components/radar/radar-de-negocios.tsx
// Radar de Negócios: a "lista quente" invertida do OLAKI.
// "Propor" abre a tela do pedido (/radar/[id]) com a folha de proposta: anúncio ou foto, preço e mensagem.
import type { ReactNode } from "react";
import Link from "next/link";
import { BadgeCheck, Clock, Flame, Hourglass, Lock, MapPin, MessageCircle, Radar, Send, Users } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import type { CategoriaComFilhas } from "@/lib/tipos";
import { AtualizarRadar } from "./atualizar-radar";
import { faixaPreco, dataHoraCurta } from "./util";
import { LINK_PLANOS, linkMeuPedidoRadar, linkPedidoRadarLoja } from "@/lib/rotas";

export type PedidoRadar = {
  id: string;
  titulo: string;
  detalhes: string | null; // null quando o usuário não tem acesso
  cidade: string;
  urgencia: "normal" | "esta_semana" | "hoje";
  precoMaxCentavos: number | null;
  totalPropostas: number;
  maxPropostas: number;
  modoContato: "whatsapp_direto" | "propostas_prazo";
  propostasAte: string | null;
  criadoEm: string;
  compradorCertificado: boolean;
  compradorNome: string | null; // null quando bloqueado
  jaPropus: boolean;
  souComprador: boolean; // o pedido é meu (não proponho no meu próprio pedido)
  precoMinCentavos: number | null;
  categoriaNome: string | null;
};

export type PlanoResumo = { codigo: string; nome: string; preco_centavos: number; periodo_dias?: number };

const reaisCentavos = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function tempoAtras(iso: string) {
  const min = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

export function RadarDeNegocios({
  pedidos,
  temAcesso,
  propostasRestantes,
  emTeste,
  planos,
  abas,
  categorias,
  nicho,
  vende,
  textoBusca,
  pagina,
  anterior,
  proxima,
}: {
  pedidos: PedidoRadar[];
  categorias: CategoriaComFilhas[];
  nicho: string;
  vende: boolean;
  textoBusca: string | null;
  pagina: number;
  anterior?: string;
  proxima?: string;
  temAcesso: boolean;
  propostasRestantes: number | null; // null = ilimitado
  emTeste: boolean;
  planos: PlanoResumo[];
  /** Abas da tela /radar (Meus pedidos, Pedidos na região, Minhas propostas). */
  abas?: ReactNode;
}) {
  const restantes = propostasRestantes;
  const podePropor = temAcesso && (restantes === null || restantes > 0);

  return (
    <main className="mx-auto min-h-dvh max-w-5xl bg-fundo pb-28">
      <header className=" border-b border-borda bg-cartao px-4 pb-4 pt-5">
        <div className="flex items-center gap-2">
          <Radar className="size-6 text-laranja-escuro" aria-hidden />
          <h1 className="text-titulo font-semibold text-beringela">Radar de Negócios</h1>
        </div>
        <p className="mt-0.5 text-sm text-texto-suave">
          {pedidos.length} {pedidos.length === 1 ? "pedido aberto nesta página" : "pedidos abertos nesta página"}
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">{abas}<AtualizarRadar /></div>

        <form action="/radar" method="get" className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="aba" value="regiao" />
          {textoBusca && <input type="hidden" name="q" value={textoBusca} />}
          <div className="min-w-0 flex-[1_1_14rem]">
            <label htmlFor="radar-nicho" className="mb-1 block text-sm font-semibold text-beringela">Filtrar por categoria</label>
            <select
              id="radar-nicho"
              name="nicho"
              defaultValue={nicho}
              key={nicho}
              className="h-11 w-full rounded-campo border border-borda-campo bg-cartao px-3 text-base text-beringela focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro"
            >
              <option value="todas">Todas as categorias</option>
              {vende && <option value="meu_nicho">Das minhas categorias</option>}
              <option value="sem_categoria">Sem categoria</option>
              {categorias.map((c) => c.filhas.length > 0 ? (
                <optgroup key={c.id} label={c.nome}>
                  <option value={c.id}>Todos em {c.nome}</option>
                  {c.filhas.map((filha) => <option key={filha.id} value={filha.id}>{filha.nome}</option>)}
                </optgroup>
              ) : (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <Botao type="submit" variante="secundario">Filtrar</Botao>
        </form>
        {nicho === "meu_nicho" && <p className="mt-2 text-sm text-texto-suave">Pedidos nas categorias dos seus anúncios no ar.</p>}
      </header>

      {!temAcesso && <FaixaUpgrade planos={planos} titulo="Esses clientes já querem comprar." />}
      {temAcesso && restantes !== null && (
        restantes > 0 ? (
          <p className="mx-4 mt-4 rounded-card bg-fundo px-4 py-3 text-sm text-beringela">
            Você ainda pode enviar <strong>{restantes}</strong> {restantes === 1 ? "oferta" : "ofertas"} {emTeste ? "durante o teste" : "neste mês"}.
          </p>
        ) : (
          <FaixaUpgrade planos={planos} titulo="Você atingiu o limite de novas ofertas do plano." />
        )
      )}

      <ul className="grid grid-cols-1 items-start gap-4 px-4 pt-4 md:grid-cols-2">
        {pedidos.map((p) => (
          <li key={p.id}>
            <CartaoPedido pedido={p} temAcesso={temAcesso} podePropor={podePropor} />
          </li>
        ))}
        {pedidos.length === 0 && (
          <li className="rounded-card border border-dashed border-borda bg-cartao p-8 text-center text-sm text-texto-suave">
            Nenhum pedido aberto para este filtro nesta página.
          </li>
        )}
      </ul>
      {(anterior || proxima) && (
        <nav aria-label="Páginas dos pedidos" className="mt-4 flex flex-wrap items-center justify-center gap-3 px-4">
          {anterior && <Botao href={anterior} variante="secundario">Anterior</Botao>}
          <span className="text-sm text-texto-suave">Página {pagina}</span>
          {proxima && <Botao href={proxima} variante="secundario">Próxima</Botao>}
        </nav>
      )}
    </main>
  );
}

function CartaoPedido({
  pedido: p,
  temAcesso,
  podePropor,
}: {
  pedido: PedidoRadar;
  temAcesso: boolean;
  podePropor: boolean;
}) {
  const modoPrazo = p.modoContato === "propostas_prazo";
  const propus = p.jaPropus;
  const esgotado = p.totalPropostas >= p.maxPropostas && !propus;
  const liberado = podePropor || propus; // quem já propôs pode voltar a ver e editar sem gastar proposta
  const linkPedido = linkPedidoRadarLoja(p.id);

  return (
    <article className="overflow-hidden rounded-card border border-borda bg-cartao">
      <div className="p-3">
        <div className="flex flex-wrap items-center gap-2 text-legenda">
          {p.categoriaNome && <span className="rounded-full bg-fundo px-2 py-0.5 text-texto-suave">{p.categoriaNome}</span>}
          {p.urgencia !== "normal" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-aviso-fundo px-2 py-0.5 font-semibold text-aviso">
              <Flame className="size-3.5" aria-hidden />
              {p.urgencia === "hoje" ? "Precisa hoje" : "Esta semana"}
            </span>
          )}
          {modoPrazo && p.propostasAte && (
            <span className="inline-flex items-center gap-1 rounded-full bg-aviso-fundo px-2 py-0.5 font-semibold text-aviso">
              <Hourglass className="size-3.5" aria-hidden />
              Propostas até {dataHoraCurta(p.propostasAte)}
            </span>
          )}
          {p.compradorCertificado && (
            <span className="inline-flex items-center gap-1 rounded-full bg-verde-escuro px-2 py-0.5 font-semibold text-white">
              <BadgeCheck className="size-3.5" aria-hidden />
              Negociador Certificado
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-texto-suave">
            <Clock className="size-3.5" aria-hidden />
            {tempoAtras(p.criadoEm)}
          </span>
        </div>

        {/* O que procura: sempre visível, é o "gancho" que vende o plano */}
        <h2 className="mt-2 break-words text-base font-semibold leading-snug text-beringela">
          <Link href={p.souComprador ? linkMeuPedidoRadar(p.id) : linkPedido} className="hover:underline focus-visible:outline-3 focus-visible:outline-laranja-escuro">
            {p.titulo}
          </Link>
        </h2>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <span className="text-base font-bold tabular-nums text-beringela">
            {faixaPreco(p.precoMinCentavos, p.precoMaxCentavos)}
          </span>
          <span className="inline-flex items-center gap-1 text-sm text-texto-suave">
            <MapPin className="size-4" aria-hidden />
            {p.cidade}
          </span>
        </div>

        <div className="relative mt-3">
          {temAcesso ? (
            <div className="rounded-card bg-fundo p-3 text-sm leading-5 text-texto">
              {p.detalhes ? <p className="whitespace-pre-line break-words">{p.detalhes}</p> : <p className="text-texto-suave">Sem detalhes extras.</p>}
              <p className="mt-2 text-legenda text-texto-suave">
                Comprador: {p.compradorNome}
                {modoPrazo && " · prefere receber as ofertas e escolher com quem falar"}
              </p>
            </div>
          ) : (
            <>
              {/* Texto falso: o real nunca chega ao navegador de quem não tem acesso */}
              <div aria-hidden className="select-none rounded-card bg-fundo p-3 text-sm text-beringela blur-[5px]">
                <p>Detalhes do pedido com modelo, ano, condição de pagamento e prazo para fechar negócio.</p>
                <p className="mt-2 text-legenda">Comprador: ••••••• · (89) 9••••-••••</p>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-beringela/90 px-3 py-1.5 text-legenda font-semibold text-white">
                  <Lock className="size-3.5" aria-hidden />
                  Exclusivo para lojistas assinantes
                </span>
              </div>
            </>
          )}
        </div>

        <p className="mt-3 inline-flex items-center gap-1 text-legenda text-texto-suave">
          <Users className="size-3.5" aria-hidden />
          {p.totalPropostas === 0
            ? "Nenhuma proposta ainda. Seja o primeiro!"
            : `${p.totalPropostas} de ${p.maxPropostas} propostas enviadas`}
        </p>

      </div>

      {/* Ação principal: largura total, 52px de altura */}
      {p.souComprador ? (
        <Link
          href={linkMeuPedidoRadar(p.id)}
          className="olaki-acao flex min-h-13 w-full items-center justify-center gap-2 px-4 py-3 text-center focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro border-t border-borda bg-cartao text-base font-semibold text-beringela active:brightness-90"
        >
          <Users className="size-5 shrink-0" aria-hidden />
          Seu pedido · ver propostas
        </Link>
      ) : !temAcesso || !liberado ? (
        <Link
          href={`${LINK_PLANOS}?origem=radar`}
          className="olaki-acao flex min-h-13 w-full items-center justify-center gap-2 px-4 py-3 text-center focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro bg-laranja text-base font-semibold text-beringela active:brightness-90"
        >
          <Lock className="size-5 shrink-0" aria-hidden />
          Desbloquear e Propor Produto
        </Link>
      ) : esgotado ? (
        <span
          aria-disabled
          className="olaki-acao flex min-h-13 w-full items-center justify-center gap-2 px-4 py-3 text-center focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro bg-borda text-base font-semibold text-texto-suave"
        >
          <Send className="size-5 shrink-0" aria-hidden />
          Propostas esgotadas
        </span>
      ) : (
        <Link
          href={`${linkPedido}?propor=1`}
          className={`olaki-acao flex min-h-13 w-full items-center justify-center gap-2 px-4 py-3 text-center focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro text-base font-semibold transition-colors active:brightness-90 ${
            modoPrazo ? "bg-laranja text-beringela" : "bg-verde-escuro text-white"
          }`}
        >
          {modoPrazo ? <Send className="size-5 shrink-0" aria-hidden /> : <MessageCircle className="size-5 shrink-0" aria-hidden />}
          {propus ? "Ver minha proposta" : "Propor Produto"}
        </Link>
      )}
    </article>
  );
}

function FaixaUpgrade({ planos, titulo }: { planos: PlanoResumo[]; titulo: string }) {
  // Nomes e preços vêm do painel administrativo (tabela planos)
  const lista = planos.map((p) => `${p.nome} (${reaisCentavos.format(p.preco_centavos / 100)}${!p.periodo_dias || p.periodo_dias === 30 ? "/mês" : ` a cada ${p.periodo_dias} dias`})`).join(" ou ");
  return (
    <section className="mx-4 mt-4 rounded-card bg-beringela p-4 text-white">
      <p className="text-base font-bold">{titulo}</p>
      <p className="mt-1 text-sm text-white/80">
        Assine {lista || "um plano com Radar"} para ver os detalhes e falar com o comprador antes da concorrência.
      </p>
      <Link
        href={`${LINK_PLANOS}?origem=radar`}
        className="mt-3 inline-flex h-11 items-center rounded-card bg-laranja px-5 text-sm font-semibold text-beringela active:brightness-90"
      >
        Ver planos
      </Link>
    </section>
  );
}
