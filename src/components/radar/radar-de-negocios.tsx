import { formatarNome } from "@/lib/formatar-nome";
// components/radar/radar-de-negocios.tsx
// Radar de Negócios: a "lista quente" invertida do Mercado da Região.
// "Propor" abre a tela do pedido (/radar/[id]) com a folha de proposta: anúncio ou foto, preço e mensagem.
import type { ReactNode } from "react";
import Link from "next/link";
import { BadgeCheck, Clock, Flame, Hourglass, Lock, MapPin, MapPinOff, Lightbulb, MessageCircle, Radar, Send, ShieldCheck, Users } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import type { CategoriaComFilhas } from "@/lib/tipos";
import { SeloVisibilidade } from "./selo-visibilidade";
import type { Visibilidade } from "@/lib/tipos-radar";
import { AtualizarRadar } from "./atualizar-radar";
import { AvisoVerificar } from "./aviso-verificar";
import { faixaPreco, dataHoraCurta } from "./util";
import { LINK_PLANOS, linkMeuPedidoRadar, linkPedidoRadarLoja } from "@/lib/rotas";
import { Badge } from "@/components/ui/badge";
import { Seletor } from "@/components/conta/seletor";

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
  /** Onde vale ("Toda a região" ou as cidades) e quem vê. */
  areaTexto?: string | null;
  visibilidade?: Visibilidade | null;
  /** Atende o Radar e está na área do pedido (do banco). Sem o campo, vale o acesso ao Radar. */
  podeProporAqui?: boolean;
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
  linkVerificar = null,
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
  /** Plano pago com Radar, mas loja sem o selo: link da verificação (no lugar de "Ver planos"). */
  linkVerificar?: string | null;
}) {
  const restantes = propostasRestantes;
  const podePropor = temAcesso && (restantes === null || restantes > 0);

  // Modo fácil (docs/designs/radar-v2.md): letra 18px, títulos 24px e controles de 48px.
  return (
    <main className="mx-auto min-h-dvh max-w-5xl bg-fundo pb-28">
      <header className=" border-b border-borda bg-cartao px-4 pt-5 pb-4">
        <div className="flex items-center gap-2">
          <Radar className="size-7 text-laranja-escuro" aria-hidden />
          <h1 className="text-facil-titulo font-semibold text-beringela">Radar de Negócios</h1>
        </div>
        <p className="mt-0.5 text-facil text-texto-suave">
          {pedidos.length} {pedidos.length === 1 ? "pedido aberto nesta página" : "pedidos abertos nesta página"}
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">{abas}<AtualizarRadar tamanho="grande" /></div>

        <form action="/radar" method="get" className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="aba" value="regiao" />
          {textoBusca && <input type="hidden" name="q" value={textoBusca} />}
          <div className="min-w-0 flex-[1_1_14rem]">
            <Seletor rotulo="Filtrar por categoria" name="nicho" id="radar-nicho" tamanho="grande" defaultValue={nicho} key={nicho}>
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
            </Seletor>
          </div>
          <Botao type="submit" variante="secundario" tamanho="grande">Filtrar</Botao>
        </form>
        {nicho === "meu_nicho" && <p className="mt-2 text-facil text-texto-suave">Pedidos nas categorias dos seus anúncios no ar.</p>}
      </header>

      {!temAcesso && (linkVerificar
        ? <AvisoVerificar href={linkVerificar} titulo="Esses clientes já querem comprar." className="mx-4 mt-4" />
        : <FaixaUpgrade planos={planos} titulo="Esses clientes já querem comprar." />)}
      {temAcesso && restantes !== null && (
        restantes > 0 ? (
          <p className="mx-4 mt-4 rounded-card bg-fundo px-4 py-3 text-facil text-beringela">
            Você ainda pode enviar <strong>{restantes}</strong> {restantes === 1 ? "oferta" : "ofertas"} {emTeste ? "durante o teste" : "neste mês"}.
          </p>
        ) : (
          <FaixaUpgrade planos={planos} titulo="Você atingiu o limite de novas ofertas do plano." />
        )
      )}

      <ul className="grid grid-cols-1 items-start gap-4 px-4 pt-4 md:grid-cols-2">
        {pedidos.map((p) => (
          <li key={p.id}>
            <CartaoPedido pedido={p} temAcesso={temAcesso} podePropor={podePropor} linkVerificar={linkVerificar} />
          </li>
        ))}
        {pedidos.length === 0 && (
          <li className="rounded-card border border-dashed border-borda bg-cartao p-8 text-center text-facil text-texto-suave">
            Nenhum pedido aberto para este filtro nesta página.
          </li>
        )}
      </ul>
      {(anterior || proxima) && (
        <nav aria-label="Páginas dos pedidos" className="mt-4 flex flex-wrap items-center justify-center gap-3 px-4">
          {anterior && <Botao href={anterior} variante="secundario" tamanho="grande">Anterior</Botao>}
          <span className="text-facil text-texto-suave">Página {pagina}</span>
          {proxima && <Botao href={proxima} variante="secundario" tamanho="grande">Próxima</Botao>}
        </nav>
      )}
    </main>
  );
}

// Ação do cartão: largura toda dentro do cartão, 48px (Botao grande).
const ACAO_CARTAO = "w-full sm:max-w-none";

function CartaoPedido({
  pedido: p,
  temAcesso,
  podePropor,
  linkVerificar,
}: {
  pedido: PedidoRadar;
  temAcesso: boolean;
  podePropor: boolean;
  linkVerificar: string | null;
}) {
  const modoPrazo = p.modoContato === "propostas_prazo";
  const propus = p.jaPropus;
  const esgotado = p.totalPropostas >= p.maxPropostas && !propus;
  const liberado = podePropor || propus; // quem já propôs pode voltar a ver e editar sem gastar proposta
  const linkPedido = linkPedidoRadarLoja(p.id);
  // Só manda oferta quem atende ESTE pedido (plano com Radar e dentro da área).
  const naArea = p.podeProporAqui ?? temAcesso;
  // Pedido "Todo mundo" para quem não pode propor (sem plano ou loja de fora da área): mostra os
  // detalhes e convida a indicar (nunca o desbloqueio de plano).
  const soIndicar = p.visibilidade === "todos" && !naArea && !p.souComprador && !propus;
  const foraDaArea = soIndicar && temAcesso;

  return (
    <article className="overflow-hidden rounded-card border border-borda bg-cartao">
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          {p.categoriaNome && <Badge variant="secondary" tamanho="grande">{p.categoriaNome}</Badge>}
          {p.urgencia !== "normal" && (
            <Badge variant="warning" tamanho="grande">
              <Flame aria-hidden />
              {p.urgencia === "hoje" ? "Precisa hoje" : "Esta semana"}
            </Badge>
          )}
          {modoPrazo && p.propostasAte && (
            <Badge variant="warning" tamanho="grande">
              <Hourglass aria-hidden />
              Propostas até {dataHoraCurta(p.propostasAte)}
            </Badge>
          )}
          <SeloVisibilidade visibilidade={p.visibilidade} />
          {p.compradorCertificado && (
            <Badge variant="success" tamanho="grande">
              <BadgeCheck aria-hidden />
              Comprador certificado
            </Badge>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-facil text-texto-suave">
            <Clock className="size-4" aria-hidden />
            {tempoAtras(p.criadoEm)}
          </span>
        </div>

        {/* O que procura: sempre visível, é o "gancho" que vende o plano */}
        <h2 className="mt-2 text-facil-titulo font-semibold break-words text-beringela">
          <Link href={p.souComprador ? linkMeuPedidoRadar(p.id) : linkPedido} className="rounded-card hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro">
            {formatarNome(p.titulo)}
          </Link>
        </h2>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <span className="text-facil font-bold text-beringela tabular-nums">
            {faixaPreco(p.precoMinCentavos, p.precoMaxCentavos)}
          </span>
          <span className="inline-flex items-center gap-1 text-facil text-texto-suave">
            <MapPin className="size-5" aria-hidden />
            {p.areaTexto ?? p.cidade}
          </span>
        </div>

        <div className="relative mt-3">
          {temAcesso || soIndicar ? (
            <div className="rounded-card bg-fundo p-3 text-facil text-texto">
              {p.detalhes ? <p className="break-words whitespace-pre-line">{p.detalhes}</p> : <p className="text-texto-suave">Sem detalhes extras.</p>}
              {temAcesso && !foraDaArea && p.compradorNome && (
                <p className="mt-2 text-facil text-texto-suave">
                  Comprador: {p.compradorNome}
                  {modoPrazo && " · prefere receber as ofertas e escolher com quem falar"}
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Texto falso: o real nunca chega ao navegador de quem não tem acesso */}
              <div aria-hidden className="rounded-card bg-fundo p-3 text-facil text-beringela blur-[5px] select-none">
                <p>Detalhes do pedido com modelo, ano, condição de pagamento e prazo para fechar negócio.</p>
                <p className="mt-2">Comprador: ••••••• · (89) 9••••-••••</p>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-beringela/90 px-4 py-2 text-facil font-semibold text-white">
                  <Lock className="size-4" aria-hidden />
                  Exclusivo para lojistas assinantes
                </span>
              </div>
            </>
          )}
        </div>

        {foraDaArea && (
          <p className="mt-3 inline-flex items-start gap-2 text-facil font-semibold text-beringela">
            <MapPinOff className="mt-1 size-5 shrink-0" aria-hidden />
            Este pedido é para lojas de {p.areaTexto ?? p.cidade}.
          </p>
        )}

        <p className="mt-3 inline-flex items-center gap-1 text-facil text-texto-suave">
          <Users className="size-4" aria-hidden />
          {p.totalPropostas === 0
            ? "Nenhuma proposta ainda. Seja o primeiro!"
            : `${p.totalPropostas} de ${p.maxPropostas} propostas enviadas`}
        </p>

        <div className="mt-3">
          {p.souComprador ? (
            <Botao href={linkMeuPedidoRadar(p.id)} variante="secundario" tamanho="grande" icone={<Users />} className={ACAO_CARTAO}>
              Seu pedido · ver propostas
            </Botao>
          ) : soIndicar ? (
            <Botao href={linkPedido} variante="secundario" tamanho="grande" icone={<Lightbulb />} className={ACAO_CARTAO}>
              Eu sei onde tem
            </Botao>
          ) : !temAcesso && linkVerificar ? (
            <Botao href={linkVerificar} tamanho="grande" icone={<ShieldCheck />} className={ACAO_CARTAO}>
              Verificar minha loja
            </Botao>
          ) : !temAcesso || !liberado ? (
            <Botao href={`${LINK_PLANOS}?origem=radar`} tamanho="grande" icone={<Lock />} className={ACAO_CARTAO}>
              Desbloquear e mandar oferta
            </Botao>
          ) : esgotado ? (
            <Botao variante="secundario" tamanho="grande" icone={<Send />} className={ACAO_CARTAO} disabled>
              Propostas esgotadas
            </Botao>
          ) : (
            <Botao
              href={`${linkPedido}?propor=1`}
              variante={modoPrazo ? "primario" : "whatsapp"}
              tamanho="grande"
              icone={modoPrazo ? <Send /> : <MessageCircle />}
              className={ACAO_CARTAO}
            >
              {propus ? "Ver minha proposta" : "Mandar oferta"}
            </Botao>
          )}
        </div>
      </div>
    </article>
  );
}

function FaixaUpgrade({ planos, titulo }: { planos: PlanoResumo[]; titulo: string }) {
  // Nomes e preços vêm do painel administrativo (tabela planos)
  const lista = planos.map((p) => `${p.nome} (${reaisCentavos.format(p.preco_centavos / 100)}${!p.periodo_dias || p.periodo_dias === 30 ? "/mês" : ` a cada ${p.periodo_dias} dias`})`).join(" ou ");
  return (
    <section className="mx-4 mt-4 flex flex-col gap-3 rounded-card bg-beringela p-4 text-white">
      <p className="text-facil font-bold">{titulo}</p>
      <p className="text-facil text-white/85">
        Assine {lista || "um plano com Radar"} para ver os detalhes e mandar sua oferta antes da concorrência.
      </p>
      <Botao href={`${LINK_PLANOS}?origem=radar`} tamanho="grande" larguraTotal>
        Ver planos
      </Botao>
    </section>
  );
}
