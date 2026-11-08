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
import type { PlanoRadar } from "@/lib/tipos-radar";

export const metadata = { title: "Pedido no Radar · OLAKI" };

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
    <Link href={LINK_RADAR} className="-ml-2 inline-flex min-h-12 w-fit items-center gap-1 px-2 text-base font-semibold text-laranja-escuro">
      <ChevronLeft className="size-5" aria-hidden />
      Radar
    </Link>
  );

  if (!pedido) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
        {voltar}
        <Vazio titulo="Este pedido não está mais no ar" texto="O comprador já resolveu ou o prazo acabou. Veja outros pedidos da região.">
          <Botao href={`${LINK_RADAR}?aba=regiao`} larguraTotal>
            Ver pedidos na região
          </Botao>
        </Vazio>
      </main>
    );
  }
  if (pedido.sou_comprador) redirect(linkMeuPedidoRadar(id));

  const [conta, minha, acesso, planos] = await Promise.all([meuPerfilEVitrine(), minhaPropostaNoPedido(id), acessoRadar(), planosComRadar()]);
  const modoPrazo = pedido.modo_contato === "propostas_prazo";
  const aberto = pedido.situacao === "aberto";
  const cheio = pedido.total_propostas >= pedido.max_propostas;
  const temCredito = acesso.temAcesso && (acesso.restantes === null || acesso.restantes > 0);

  let rodape: React.ReactNode;
  if (!conta?.vitrine) {
    rodape = (
      <Vazio icone={<Store />} titulo="Você vende?" texto="Crie sua vitrine grátis para mandar ofertas aos compradores da região.">
        <Botao href="/quero-vender" larguraTotal>
          Quero vender
        </Botao>
      </Vazio>
    );
  } else if (!pedido.mesma_regiao) {
    rodape = (
      <Vazio icone={<MapPinOff />} titulo="Pedido de outra região" texto="Você só pode mandar proposta para compradores da região da sua loja.">
        <Botao href={`${LINK_RADAR}?aba=regiao`} variante="secundario" larguraTotal>
          Ver pedidos da minha região
        </Botao>
      </Vazio>
    );
  } else if (!aberto && !minha) {
    rodape = <p className="rounded-card bg-fundo p-4 text-center text-base text-texto-suave">Este pedido não recebe mais propostas.</p>;
  } else if (!minha && !temCredito) {
    rodape = <Planos planos={planos} semCredito={acesso.temAcesso} />;
  } else if (!minha && cheio) {
    rodape = <p className="rounded-card bg-fundo p-4 text-center text-base text-texto-suave">Este pedido já recebeu todas as propostas.</p>;
  } else {
    const [anuncios, regras] = await Promise.all([meusAnunciosNoAr(), regrasRadar(conta.perfil.microrregiao_id)]);
    rodape = (
      <FolhaPropor
        pedidoId={pedido.id}
        modoPrazo={modoPrazo}
        podeEditar={aberto && minha?.status !== "oculta"}
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
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-texto-suave">
          {pedido.categoria_nome && <span>{pedido.categoria_nome} ·</span>}
          <span>{pedido.cidade} ·</span>
          <span>{tempoRelativo(pedido.criado_em)}</span>
        </p>
        <h1 className="text-xl font-bold leading-7">{pedido.titulo}</h1>
        {pedido.detalhes ? (
          <p className="whitespace-pre-line text-base text-texto">{pedido.detalhes}</p>
        ) : (
          !pedido.tem_acesso && (
            <p className="inline-flex items-center gap-1.5 text-[15px] text-texto-suave">
              <Lock className="size-4" aria-hidden />
              Detalhes só para quem tem plano com Radar.
            </p>
          )
        )}
        <p className="text-lg font-bold text-beringela">{faixaPreco(pedido.preco_min_centavos, pedido.preco_max_centavos)}</p>
        <p className="flex flex-wrap items-center gap-x-3 text-sm text-texto-suave">
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
          <p className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-laranja-escuro">
            <Hourglass className="size-4" aria-hidden />
            {aberto ? `Propostas até ${dataHoraCurta(pedido.propostas_ate)}` : "O prazo das propostas acabou"}
          </p>
        ) : (
          <p className="inline-flex items-center gap-1.5 text-[15px] text-texto-suave">
            <MessageCircle className="size-4" aria-hidden />
            Ao propor, você chama o comprador no WhatsApp.
          </p>
        )}
      </section>

      {minha && (
        <section className="flex flex-col gap-2 rounded-card border border-borda bg-cartao p-4">
          <h2 className="text-base font-bold">Sua proposta</h2>
          {minha.status === "oculta" ? (
            <p className="inline-flex items-start gap-1.5 text-[15px] font-semibold text-perigo">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              Tirada pela equipe{minha.moderado_motivo ? `: ${minha.moderado_motivo}` : ""}
            </p>
          ) : minha.escolhida ? (
            <p className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-verde-escuro">
              <Star className="size-4" aria-hidden />
              Escolhida! O comprador vai te chamar no WhatsApp.
            </p>
          ) : null}
          <p className="text-lg font-bold text-beringela">{minha.preco_centavos != null ? preco(minha.preco_centavos) : "Preço a combinar"}</p>
          {minha.mensagem && <p className="whitespace-pre-line text-[15px]">{minha.mensagem}</p>}
        </section>
      )}

      {rodape}
    </main>
  );
}

function Planos({ planos, semCredito }: { planos: PlanoRadar[]; semCredito: boolean }) {
  return (
    <section className="flex flex-col gap-3 rounded-card bg-beringela p-4 text-white">
      <p className="text-lg font-bold">{semCredito ? "Suas propostas grátis acabaram" : "Este cliente já quer comprar"}</p>
      <p className="text-base text-white/85">Com um plano com Radar você vê os detalhes e manda sua oferta antes da concorrência.</p>
      {planos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {planos.map((p) => (
            <li key={p.codigo} className="flex items-center justify-between gap-3 rounded-campo bg-white/10 px-3 py-2">
              <span className="font-semibold">{p.nome}</span>
              <span className="text-right text-[15px]">
                {preco(p.preco_centavos)}
                {p.periodo_dias === 30 ? "/mês" : ` a cada ${p.periodo_dias} dias`}
                {p.propostas_radar_mes != null && <span className="block text-[13px] text-white/80">{p.propostas_radar_mes} propostas por mês</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Botao href={`${LINK_PLANOS}?origem=radar`} larguraTotal>
        Ver planos
      </Botao>
    </section>
  );
}
