// /radar/[id]: o pedido visto por quem vende, com a folha "Propor".
// Quem decide se pode propor é o banco (propor_radar); aqui só escolhemos o que mostrar.
import { formatarNome } from "@/lib/formatar-nome";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, ChevronLeft, Hourglass, Lock, MapPinOff, MessageCircle, ShieldAlert, Star, Store } from "lucide-react";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { acessoRadar, meusAnunciosNoAr, minhaPropostaNoPedido, pedidoRadar, planosComRadar, regrasRadar } from "@/lib/dados/radar";
import { LINK_PLANOS, LINK_RADAR, linkMeuPedidoRadar } from "@/lib/rotas";
import { preco, tempoRelativo } from "@/lib/formato";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { dataHoraCurta, faixaPreco, FOCO_LINK, linkVerificarParaRadar } from "@/components/radar/util";
import { AvisoVerificar } from "@/components/radar/aviso-verificar";
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
    <Link href={LINK_RADAR} className={`inline-flex min-h-11 w-fit items-center gap-1 text-lg font-semibold text-laranja-escuro hover:underline ${FOCO_LINK}`}>
      <ChevronLeft className="size-5" aria-hidden />
      Radar
    </Link>
  );

  if (!pedido) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-3 sm:gap-4 sm:px-6">
        {voltar}
        <Vazio titulo="Este pedido não está mais no ar" texto="O comprador já resolveu ou o prazo acabou. Veja outros pedidos da região.">
          <Botao href={`${LINK_RADAR}?aba=regiao`} className="min-h-11! self-start">
            Ver pedidos na região
          </Botao>
        </Vazio>
      </main>
    );
  }
  // Pedido "só lojas" de quem não atende: sem título nem detalhes, só o aviso e os planos.
  // Vem antes de qualquer outra regra (comprador, proposta) para nada do pedido vazar.
  if (pedido.bloqueado) {
    const [planosBloqueio, contaBloqueio, acessoBloqueio] = await Promise.all([planosComRadar(), meuPerfilEVitrine(), acessoRadar()]);
    const verificarBloqueio = linkVerificarParaRadar(contaBloqueio, acessoBloqueio.temAcesso);
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-3 sm:gap-4 sm:px-6 pb-10">
        {voltar}
        <section className="flex flex-col gap-2 rounded-card border border-borda bg-cartao p-3 sm:p-4">
          <h1 className="inline-flex items-center gap-2 text-3xl leading-7 font-semibold text-beringela">
            <Lock className="size-5 shrink-0" aria-hidden />
            Este pedido é só para lojas com acesso ao Radar.
          </h1>
          <p className="text-lg text-texto-suave">O acesso exige loja verificada com plano Radar ou cortesia da equipe.</p>
        </section>
        {verificarBloqueio ? (
          <AvisoVerificar href={verificarBloqueio} titulo="Quer ver pedidos como este?" />
        ) : (
          <Planos planos={planosBloqueio} titulo="Quer ver pedidos como este?" />
        )}
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

  const verificar = linkVerificarParaRadar(conta, acesso.temAcesso);
  // Só manda oferta quem atende ESTE pedido (plano com Radar e dentro da área). Num pedido "Todo mundo",
  // quem não pode propor (inclusive loja de fora da área) indica: "Eu sei onde tem". Quem já propôs segue na própria proposta.
  const podePropor = pedido.pode_propor === true;
  const indicar = pedido.visibilidade === "todos" && !podePropor && !minha;
  const foraDaArea = indicar && acesso.temAcesso;
  // Indicar vale enquanto o pedido está aberto e dentro da validade, mesmo com o prazo das propostas vencido (a regra é do banco).
  const aceitaIndicacao = pedido.status === "aberto" && new Date(pedido.expira_em).getTime() > Date.now();

  let rodape: React.ReactNode;
  if (indicar) {
    // Quem não atende vê o pedido "Todo mundo" e pode dizer onde tem; nunca "Mandar oferta".
    rodape = (
      <>
        {foraDaArea && (
          <p className="inline-flex items-start gap-2 rounded-card bg-fundo p-3 text-lg font-semibold text-beringela">
            <MapPinOff className="mt-1 size-5 shrink-0" aria-hidden />
            Este pedido é para lojas de {pedido.area_texto ?? pedido.cidade}.
          </p>
        )}
        {aceitaIndicacao ? (
          <section className="flex flex-col gap-3 rounded-card border border-borda bg-cartao p-3 sm:p-4">
            <p className="text-lg text-texto">Conhece um anúncio que atende ao pedido? Indique ao comprador.</p>
            <FolhaIndicar pedidoId={pedido.id} />
          </section>
        ) : (
          <p className="rounded-card bg-fundo p-3 text-center text-lg text-texto-suave">Este pedido não recebe mais indicações.</p>
        )}
        {verificar && <AvisoVerificar href={verificar} titulo="Quer mandar ofertas no Radar?" />}
      </>
    );
  } else if (!conta?.vitrine) {
    rodape = (
      <Vazio icone={<Store />} titulo="Você vende?" texto="Crie uma vitrine para começar a vender. Confira como receber pedidos no Radar.">
        <Botao href="/quero-vender" className="min-h-11! self-start">
          Quero vender
        </Botao>
      </Vazio>
    );
  } else if (!pedido.mesma_regiao) {
    rodape = (
      <Vazio icone={<MapPinOff />} titulo="Pedido de outra região" texto="Você só pode mandar proposta para compradores da região da sua loja.">
        <Botao href={`${LINK_RADAR}?aba=regiao`} variante="secundario" className="min-h-11! self-start">
          Ver pedidos da minha região
        </Botao>
      </Vazio>
    );
  } else if (!aberto && !minha) {
    rodape = <p className="rounded-card bg-fundo p-3 text-center text-lg text-texto-suave">Este pedido não recebe mais propostas.</p>;
  } else if (!acesso.temAcesso && verificar) {
    rodape = <AvisoVerificar href={verificar} titulo="Este cliente já quer comprar" />;
  } else if (!acesso.temAcesso || (!minha && !temCredito)) {
    rodape = <Planos planos={planos} titulo={acesso.temAcesso ? "Suas propostas disponíveis acabaram" : "Este cliente já quer comprar"} />;
  } else if (!minha && cheio) {
    rodape = <p className="rounded-card bg-fundo p-3 text-center text-lg text-texto-suave">Este pedido já recebeu todas as propostas.</p>;
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
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-3 sm:gap-4 sm:px-6 pb-10">
      {voltar}
      <section aria-labelledby="titulo-pedido-loja" className="flex min-w-0 flex-col gap-2 rounded-card border border-borda bg-cartao p-3 sm:p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-texto-suave">
          <SeloVisibilidade visibilidade={pedido.visibilidade} />
          <span className="[overflow-wrap:anywhere]">{pedido.area_texto ?? pedido.cidade}</span>
          {pedido.categoria_nome && <span className="[overflow-wrap:anywhere]">· {pedido.categoria_nome}</span>}
          <span>· {tempoRelativo(pedido.criado_em)}</span>
        </div>
        <h1 id="titulo-pedido-loja" className="text-3xl font-semibold text-beringela [overflow-wrap:anywhere]">{formatarNome(pedido.titulo)}</h1>
        {pedido.detalhes ? (
          <p className="text-lg [overflow-wrap:anywhere] whitespace-pre-line text-texto">{pedido.detalhes}</p>
        ) : (
          !pedido.tem_acesso && (
            <p className="inline-flex items-center gap-2 text-lg text-texto-suave">
              <Lock className="size-4" aria-hidden />
              Detalhes só para quem tem plano com Radar.
            </p>
          )
        )}
        <p className="text-lg font-bold text-beringela">{faixaPreco(pedido.preco_min_centavos, pedido.preco_max_centavos)}</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-texto-suave [overflow-wrap:anywhere]">
          {pedido.comprador_primeiro_nome && <span>Comprador: {formatarNome(pedido.comprador_primeiro_nome)}</span>}
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
          <p className="inline-flex items-center gap-2 text-lg font-semibold text-laranja-escuro">
            <Hourglass className="size-4" aria-hidden />
            {aberto ? `Propostas até ${dataHoraCurta(pedido.propostas_ate)}` : "O prazo das propostas acabou"}
          </p>
        ) : (
          (podePropor || minha) && (
            <p className="inline-flex items-center gap-2 text-lg text-texto-suave">
              <MessageCircle className="size-4" aria-hidden />
              Ao propor, você chama o comprador no WhatsApp.
            </p>
          )
        )}
      </section>

      {minha && (
        <section className="flex flex-col gap-2 rounded-card border border-borda bg-cartao p-3 sm:p-4">
          <h2 className="text-2xl font-semibold text-beringela">Sua proposta</h2>
          {minha.status === "oculta" ? (
            <p className="inline-flex items-start gap-2 text-lg font-semibold text-perigo">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              Tirada pela equipe{minha.moderado_motivo ? `: ${minha.moderado_motivo}` : ""}
            </p>
          ) : minha.escolhida ? (
            <p className="inline-flex items-center gap-2 text-lg font-semibold text-verde-escuro">
              <Star className="size-4" aria-hidden />
              O comprador escolheu sua proposta para conversar.
            </p>
          ) : null}
          <p className="text-lg font-bold text-beringela">{minha.preco_centavos != null ? preco(minha.preco_centavos) : "Preço a combinar"}</p>
          {minha.mensagem && <p className="text-lg [overflow-wrap:anywhere] whitespace-pre-line">{minha.mensagem}</p>}
        </section>
      )}

      {rodape}
    </main>
  );
}

function Planos({ planos, titulo }: { planos: PlanoRadar[]; titulo: string }) {
  return (
    <section className="flex flex-col gap-3 rounded-card bg-beringela p-4 text-white">
      <p className="text-lg font-bold">{titulo}</p>
      <p className="text-lg text-white/85">Com acesso ao Radar, você vê os pedidos da sua área e envia propostas.</p>
      {planos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {planos.map((p) => (
            <li key={p.codigo} className="flex items-center justify-between gap-3 rounded-campo bg-white/10 px-3 py-2">
              <span className="text-lg font-semibold">{p.nome}</span>
              <span className="text-right text-lg">
                {preco(p.preco_centavos)}
                {p.periodo_dias === 30 ? "/mês" : ` a cada ${p.periodo_dias} dias`}
                {p.propostas_radar_mes != null && <span className="block text-lg text-white/85">{p.propostas_radar_mes} propostas por mês</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Botao href={`${LINK_PLANOS}?origem=radar`} className="min-h-11! self-start">
        Ver planos
      </Botao>
    </section>
  );
}
