// /radar/[id]: o pedido visto por quem vende, com a folha "Propor".
// Quem decide se pode propor é o banco (propor_radar); aqui só escolhemos o que mostrar.
import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, ChevronLeft, Hourglass, Lock, MapPinOff, MessageCircle, ShieldAlert, Star, Store } from "lucide-react";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { acessoRadar, meusAnunciosNoAr, minhaPropostaNoPedido, pedidoRadar, planosComRadar, regrasRadar } from "@/lib/dados/radar";
import { LINK_PLANOS, LINK_RADAR, linkMeuPedidoRadar } from "@/lib/rotas";
import { preco, tempoRelativo } from "@/lib/formato";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { dataHoraCurta, faixaPreco } from "@/components/radar/util";
import { FolhaPropor } from "@/components/radar/folha-propor";
import { FolhaIndicar } from "@/components/radar/folha-indicar";
import { SeloVisibilidade } from "@/components/radar/selo-visibilidade";
import type { PlanoRadar } from "@/lib/tipos-radar";

export const metadata = { title: "Pedido no Radar" };

export default async function PedidoLojaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ propor?: string }>;
}) {
  const [{ id }, { propor }] = await Promise.all([params, searchParams]);
  const pedido = await pedidoRadar(id);
  const voltar = (
    <Link href={LINK_RADAR} className="-ml-2 inline-flex min-h-12 w-fit items-center gap-1 px-2 text-facil font-semibold text-laranja-escuro">
      <ChevronLeft className="size-5" aria-hidden />
      Radar
    </Link>
  );

  if (!pedido) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
        {voltar}
        <Vazio titulo="Este pedido não está mais no ar" texto="O comprador já resolveu ou o prazo acabou. Veja outros pedidos da região.">
          <Botao href={`${LINK_RADAR}?aba=regiao`} larguraTotal tamanho="grande">
            Ver pedidos na região
          </Botao>
        </Vazio>
      </main>
    );
  }
  // Pedido "só lojas" de quem não atende: sem título nem detalhes, só o aviso e os planos.
  // Vem antes de qualquer outra regra (comprador, proposta) para nada do pedido vazar.
  if (pedido.bloqueado) {
    const planosBloqueio = await planosComRadar();
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6 pb-10">
        {voltar}
        <section className="flex flex-col gap-2 rounded-card bg-cartao p-4 shadow-1">
          <h1 className="inline-flex items-center gap-2 text-facil-titulo leading-7 font-semibold text-beringela">
            <Lock className="size-5 shrink-0" aria-hidden />
            Este pedido é só para lojas verificadas.
          </h1>
          <p className="text-facil text-texto-suave">Loja verificada com plano que tem Radar vê os pedidos e manda ofertas.</p>
        </section>
        <Planos planos={planosBloqueio} titulo="Quer ver pedidos como este?" />
      </main>
    );
  }
  if (pedido.sou_comprador) redirect(linkMeuPedidoRadar(id));

  const [conta, minha, acesso, planos] = await Promise.all([meuPerfilEVitrine(), minhaPropostaNoPedido(id), acessoRadar(), planosComRadar()]);
  if (!conta) throw new Error("Não foi possível carregar sua conta. Tente novamente.");
  const modoPrazo = pedido.modo_contato === "propostas_prazo";
  const aberto = pedido.situacao === "aberto";
  const cheio = pedido.total_propostas >= pedido.max_propostas;
  const temCredito = acesso.temAcesso && (acesso.restantes === null || acesso.restantes > 0);

  const indicar = pedido.visibilidade === "todos" && !acesso.temAcesso;
  // Indicar vale enquanto o pedido está aberto e dentro da validade, mesmo com o prazo das propostas vencido (a regra é do banco).
  const aceitaIndicacao = pedido.status === "aberto" && new Date(pedido.expira_em).getTime() > Date.now();

  let rodape: React.ReactNode;
  if (indicar) {
    // Quem não atende vê o pedido "Todo mundo" e pode dizer onde tem; nunca "Mandar oferta".
    rodape = aceitaIndicacao ? (
      <section className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
        <p className="text-facil text-texto">Conhece alguém que vende isso? Indique o anúncio para ajudar o comprador.</p>
        <FolhaIndicar pedidoId={pedido.id} />
      </section>
    ) : (
      <p className="rounded-card bg-fundo p-4 text-center text-facil text-texto-suave">Este pedido não recebe mais indicações.</p>
    );
  } else if (!conta?.vitrine) {
    rodape = (
      <Vazio icone={<Store />} titulo="Você vende?" texto="Crie sua vitrine grátis para mandar ofertas aos compradores da região.">
        <Botao href="/quero-vender" larguraTotal tamanho="grande">
          Quero vender
        </Botao>
      </Vazio>
    );
  } else if (!pedido.mesma_regiao) {
    rodape = (
      <Vazio icone={<MapPinOff />} titulo="Pedido de outra região" texto="Você só pode mandar proposta para compradores da região da sua loja.">
        <Botao href={`${LINK_RADAR}?aba=regiao`} variante="secundario" larguraTotal tamanho="grande">
          Ver pedidos da minha região
        </Botao>
      </Vazio>
    );
  } else if (!aberto && !minha) {
    rodape = <p className="rounded-card bg-fundo p-4 text-center text-facil text-texto-suave">Este pedido não recebe mais propostas.</p>;
  } else if (!acesso.temAcesso || (!minha && !temCredito)) {
    rodape = <Planos planos={planos} titulo={acesso.temAcesso ? "Suas propostas disponíveis acabaram" : "Este cliente já quer comprar"} />;
  } else if (!minha && cheio) {
    rodape = <p className="rounded-card bg-fundo p-4 text-center text-facil text-texto-suave">Este pedido já recebeu todas as propostas.</p>;
  } else {
    const [anuncios, regras] = await Promise.all([meusAnunciosNoAr(), regrasRadar(conta.perfil.microrregiao_id)]);
    rodape = (
      <FolhaPropor
        pedidoId={pedido.id}
        modoPrazo={modoPrazo}
        podeEditar={aberto && minha?.status !== "oculta" && !minha?.escolhida}
        podeChamar={aberto && !modoPrazo && minha?.status === "ativa"}
        abrirLogo={propor === "1" && aberto}
        anuncios={anuncios}
        mensagemMax={regras.mensagemMax}
        minha={minha}
        restantes={minha ? null : acesso.restantes}
      />
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6 pb-10">
      {voltar}
      <section className="flex flex-col gap-2 rounded-card bg-cartao p-4 shadow-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-facil text-texto-suave">
          {pedido.categoria_nome && <span>{pedido.categoria_nome} ·</span>}
          <span>{pedido.area_texto ?? pedido.cidade} ·</span>
          <span>{tempoRelativo(pedido.criado_em)}</span>
          <SeloVisibilidade visibilidade={pedido.visibilidade} />
        </p>
        <h1 className="text-facil-titulo font-semibold break-words text-beringela">{pedido.titulo}</h1>
        {pedido.detalhes ? (
          <p className="text-facil break-words whitespace-pre-line text-texto">{pedido.detalhes}</p>
        ) : (
          !pedido.tem_acesso && (
            <p className="inline-flex items-center gap-2 text-facil text-texto-suave">
              <Lock className="size-4" aria-hidden />
              Detalhes só para quem tem plano com Radar.
            </p>
          )
        )}
        <p className="text-facil font-bold text-beringela">{faixaPreco(pedido.preco_min_centavos, pedido.preco_max_centavos)}</p>
        <p className="flex flex-wrap items-center gap-x-3 text-facil text-texto-suave">
          {pedido.comprador_primeiro_nome && <span>Comprador: {pedido.comprador_primeiro_nome}</span>}
          {pedido.comprador_certificado && (
            <span className="inline-flex items-center gap-1 font-semibold text-verde-escuro">
              <BadgeCheck className="size-4" aria-hidden />
              Comprador certificado
            </span>
          )}
          <span>
            {pedido.total_propostas}/{pedido.max_propostas} propostas
          </span>
        </p>
        {modoPrazo && pedido.propostas_ate ? (
          <p className="inline-flex items-center gap-2 text-facil font-semibold text-laranja-escuro">
            <Hourglass className="size-4" aria-hidden />
            {aberto ? `Propostas até ${dataHoraCurta(pedido.propostas_ate)}` : "O prazo das propostas acabou"}
          </p>
        ) : (
          acesso.temAcesso && (
            <p className="inline-flex items-center gap-2 text-facil text-texto-suave">
              <MessageCircle className="size-4" aria-hidden />
              Ao propor, você chama o comprador no WhatsApp.
            </p>
          )
        )}
      </section>

      {minha && (
        <section className="flex flex-col gap-2 rounded-card border border-borda bg-cartao p-4">
          <h2 className="text-3xl font-bold">Sua proposta</h2>
          {minha.status === "oculta" ? (
            <p className="inline-flex items-start gap-2 text-facil font-semibold text-perigo">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              Tirada pela equipe{minha.moderado_motivo ? `: ${minha.moderado_motivo}` : ""}
            </p>
          ) : minha.escolhida ? (
            <p className="inline-flex items-center gap-2 text-facil font-semibold text-verde-escuro">
              <Star className="size-4" aria-hidden />
              O comprador escolheu sua proposta para conversar.
            </p>
          ) : null}
          <p className="text-facil font-bold text-beringela">{minha.preco_centavos != null ? preco(minha.preco_centavos) : "Preço a combinar"}</p>
          {minha.mensagem && <p className="text-facil break-words whitespace-pre-line">{minha.mensagem}</p>}
        </section>
      )}

      {rodape}
    </main>
  );
}

function Planos({ planos, titulo }: { planos: PlanoRadar[]; titulo: string }) {
  return (
    <section className="flex flex-col gap-3 rounded-card bg-beringela p-4 text-white">
      <p className="text-facil font-bold">{titulo}</p>
      <p className="text-facil text-white/85">Com um plano com Radar você vê os detalhes e manda sua oferta antes da concorrência.</p>
      {planos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {planos.map((p) => (
            <li key={p.codigo} className="flex items-center justify-between gap-3 rounded-campo bg-white/10 px-3 py-2">
              <span className="font-semibold">{p.nome}</span>
              <span className="text-right text-facil">
                {preco(p.preco_centavos)}
                {p.periodo_dias === 30 ? "/mês" : ` a cada ${p.periodo_dias} dias`}
                {p.propostas_radar_mes != null && <span className="block text-legenda text-white/80">{p.propostas_radar_mes} propostas por mês</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Botao href={`${LINK_PLANOS}?origem=radar`} larguraTotal tamanho="grande">
        Ver planos
      </Botao>
    </section>
  );
}
