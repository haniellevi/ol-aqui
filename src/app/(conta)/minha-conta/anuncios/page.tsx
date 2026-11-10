import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BarChart3, Clock, Eye, Heart, MessageCircle, Pin, Plus } from "lucide-react";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { meusAnuncios } from "@/lib/dados/anuncios";
import { fraseResultado, resultadosDestaques } from "@/lib/dados/destaques";
import type { ResultadoDestaque } from "@/lib/tipos-destaques";
import { LINK_PLANOS, linkDestacar } from "@/lib/rotas";
import { ehUuid, inteiro, linkAnuncio, preco, tempoRelativo } from "@/lib/formato";
import type { MeuAnuncio, StatusAnuncio } from "@/lib/tipos";
import { Botao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import { Vazio } from "@/components/ui/vazio";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { AcoesAnuncio } from "@/components/conta/acoes-anuncio";
import { Aviso } from "@/components/conta/aviso";
import { resumoPlano } from "@/components/conta/resumo-plano";
import { BotaoFixar } from "@/components/vitrine/botao-fixar";
import { meusFixados, meusRecursosVitrine, planosPublicos } from "@/lib/dados/vitrine-completa";
import { textoDisponivelEm } from "@/components/vitrine/regras";

import { ABAS_ANUNCIOS as ABAS, ROTULO_ANUNCIO as ROTULO, RESULTADOS_ANUNCIO, abaDoStatus } from "@/components/conta/situacao-anuncios";
import { FiltroMeusAnuncios } from "@/components/conta/filtro-meus-anuncios";
import { FotoMeuAnuncio } from "@/components/conta/foto-meu-anuncio";

export const metadata: Metadata = { title: "Meus anúncios" };

export default async function PaginaMeusAnuncios({ searchParams }: { searchParams: Promise<{ aba?: string | string[]; resultado?: string; anuncio?: string; salvo?: string }> }) {
  const [sp, conta, anuncios, destaques] = await Promise.all([searchParams, meuPerfilEVitrine(), meusAnuncios(), resultadosDestaques()]);

  if (!conta) throw new Error("Não foi possível carregar sua conta. Tente novamente.");
  if (!conta.vitrine) {
    return (
      <PaginaConta>
        <TopoConta titulo="Meus anúncios" />
        <Vazio titulo="Você ainda não vende no OLAKI" texto="Comece agora: leva poucos minutos.">
          <Botao href="/quero-vender" larguraTotal>Quero vender</Botao>
        </Vazio>
      </PaginaConta>
    );
  }

  const contagem = Object.fromEntries(
    ABAS.map((a) => [a.chave, anuncios.filter((x) => (a.status as readonly StatusAnuncio[]).includes(x.status)).length]),
  ) as Record<(typeof ABAS)[number]["chave"], number>;
  const pedida = Array.isArray(sp.aba) ? sp.aba[0] : sp.aba;
  const salvo = typeof sp.salvo === "string" && ehUuid(sp.salvo) ? anuncios.find((a) => a.id === sp.salvo && a.status !== "excluido") : null;
  const aba = ABAS.find((a) => a.chave === pedida) ?? (salvo ? ABAS.find((a) => a.chave === abaDoStatus(salvo.status))! : ABAS[0]);
  const alterado = typeof sp.anuncio === "string" ? anuncios.find((a) => a.id === sp.anuncio) : null;
  const resultado = typeof sp.resultado === "string" && Object.hasOwn(RESULTADOS_ANUNCIO, sp.resultado) ? sp.resultado as keyof typeof RESULTADOS_ANUNCIO : null;
  const aviso = salvo ? RESULTADOS_ANUNCIO.salvo : alterado && resultado && (resultado === alterado.status || (resultado === "restaurado" && alterado.status !== "excluido")) ? RESULTADOS_ANUNCIO[resultado] : null;
  if (aba.chave === "lixeira" && contagem.lixeira === 0 && resultado === "restaurado" && alterado && alterado.status !== "excluido") {
    redirect(`/minha-conta/anuncios?aba=${abaDoStatus(alterado.status)}&resultado=restaurado&anuncio=${alterado.id}`);
  }
  const lista = anuncios.filter((x) => (aba.status as readonly StatusAnuncio[]).includes(x.status));
  const plano = resumoPlano(conta);
  // resultado do destaque mais recente de cada anúncio (ativo ou que já acabou)
  const ultimoDestaque = new Map<string, ResultadoDestaque>();
  for (const d of destaques) {
    if (d.anuncio_id && (d.status === "ativo" || d.status === "encerrado") && !ultimoDestaque.has(d.anuncio_id)) ultimoDestaque.set(d.anuncio_id, d);
  }
  // pedido de destaque esperando pagamento (o mais recente de cada anúncio): botão para continuar
  const pagamentoPendente = new Map<string, ResultadoDestaque>();
  for (const d of destaques) {
    if (d.anuncio_id && d.status === "aguardando_pagamento" && d.pagamento_status === "pendente" && !pagamentoPendente.has(d.anuncio_id)) {
      pagamentoPendente.set(d.anuncio_id, d);
    }
  }
  // Loja com "fixar no topo" no plano: botão em cada anúncio no ar (o banco confere o limite)
  const loja = conta.vitrine.tipo === "loja";
  const [fixados, recursos] = loja ? await Promise.all([meusFixados(conta.vitrine.id), meusRecursosVitrine()]) : [new Set<string>(), null];
  const podeFixar = !!recursos && recursos.fixados_max !== 0;
  // Plano sem "fixar no topo": avisa uma vez, com os planos que têm (lidos da tabela de planos)
  const disponivelFixar = loja && !podeFixar ? textoDisponivelEm(await planosPublicos(), "fixados") : null;

  return (
    <PaginaConta larga>
      <TopoConta titulo="Meus anúncios" texto={plano ? plano.uso : undefined}>
        <Botao href="/anunciar" icone={<Plus />} larguraTotal className="sm:w-fit">
          Novo anúncio
        </Botao>
      </TopoConta>

      {aviso && <Aviso tipo="ok">{aviso}</Aviso>}

      {!conta.podePublicar && (
        <Aviso tipo="atencao">
          <span>Você está no limite do seu plano. Para pôr mais anúncios no ar, pause um ou troque de plano.</span>
          <Link href="/minha-conta/plano" className="inline-flex min-h-10 items-center underline underline-offset-4">
            Ver planos
          </Link>
        </Aviso>
      )}

      <FiltroMeusAnuncios aba={aba.chave} contagem={contagem} />
      <nav aria-label="Situação dos anúncios" className="hidden min-w-0 sm:block">
        <ul className="flex flex-wrap gap-2">
          {ABAS.map((a) => (
            <li key={a.chave}>
              <Chip href={`/minha-conta/anuncios?aba=${a.chave}`} ativo={a.chave === aba.chave} scroll={false}>
                {a.nome}
                <span className="ml-1 opacity-80">({contagem[a.chave]})</span>
              </Chip>
            </li>
          ))}
        </ul>
      </nav>

      {loja && !podeFixar && (aba.chave === "ativos" || aba.chave === "todos") && lista.some((a) => a.status === "ativo") && (
        <p className="flex flex-wrap items-center gap-x-2 text-base text-texto-suave">
          <Pin className="size-4 shrink-0 text-laranja-escuro" aria-hidden />
          <span>Fixar produtos no topo da loja: {disponivelFixar ?? "não faz parte do seu plano agora"}.</span>
          <Link
            href={`${LINK_PLANOS}?origem=vitrine`}
            className="inline-flex min-h-10 items-center font-semibold text-laranja-escuro underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-laranja-escuro"
          >
            Ver os planos
          </Link>
        </p>
      )}

      {aba.chave === "lixeira" && <Aviso>As fotos e o histórico ficam guardados. Ao restaurar, anúncios que estavam no ar voltam pausados. Vendas e bloqueios são preservados.</Aviso>}
      <p className="text-sm text-texto-suave" aria-live="polite">{lista.length} {lista.length === 1 ? "anúncio" : "anúncios"} em {aba.nome.toLowerCase()}</p>
      {lista.length === 0 ? (
        <Vazio titulo={aba.chave === "lixeira" ? "Sua lixeira está vazia" : aba.chave === "todos" ? "Seus anúncios começam aqui" : `Nenhum anúncio em "${aba.nome}"`}
          texto={aba.chave === "lixeira" ? "Anúncios movidos para cá poderão ser restaurados." : aba.chave === "todos" ? "Crie um anúncio com fotos, preço e localização para vender na sua região." : "Escolha outra situação para encontrar seus anúncios."}>
          <Botao href={aba.chave === "todos" ? "/anunciar" : "/minha-conta/anuncios"} larguraTotal>
            {aba.chave === "todos" ? "Criar anúncio" : "Ver meus anúncios"}
          </Botao>
        </Vazio>
      ) : (
        <ul className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          {lista.map((a) => (
            <li key={a.id}>
              <LinhaAnuncio
                anuncio={a}
                destaque={ultimoDestaque.get(a.id)}
                pendente={pagamentoPendente.get(a.id)}
                fixado={fixados.has(a.id)}
                mostrarFixar={loja && (podeFixar || fixados.has(a.id))}
              />
            </li>
          ))}
        </ul>
      )}
    </PaginaConta>
  );
}

function LinhaAnuncio({
  anuncio: a,
  destaque: d,
  pendente: p,
  fixado = false,
  mostrarFixar = false,
}: {
  anuncio: MeuAnuncio;
  destaque?: ResultadoDestaque;
  pendente?: ResultadoDestaque;
  fixado?: boolean;
  mostrarFixar?: boolean;
}) {
  const titulo = a.titulo?.trim() || "Anúncio sem título";
  const rotulo = ROTULO[a.status];
  const publico = a.status === "ativo" || a.status === "vendido";
  const pago = !!a.pago_ate && new Date(a.pago_ate).getTime() > Date.now();
  const destaque = !!a.destaque_ate && new Date(a.destaque_ate).getTime() > Date.now();
  const quando = tempoRelativo(a.status === "rascunho" ? a.atualizado_em : a.publicado_em ?? a.criado_em);

  const foto = <FotoMeuAnuncio key={a.fotos[0] ?? "sem-foto"} src={a.fotos[0]} />;

  return (
    <article aria-label={titulo} className="flex min-w-0 flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
      <div className="flex gap-3">
        {publico ? (
          <Link href={linkAnuncio(a.id, a.titulo)} aria-hidden tabIndex={-1}>
            {foto}
          </Link>
        ) : (
          foto
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-legenda font-bold ${rotulo.cor}`}>{rotulo.texto}</span>
            {destaque && <span className="rounded-full bg-patrocinado-fundo px-2 py-0.5 text-legenda font-bold text-beringela">Destaque</span>}
            {pago && <span className="rounded-full bg-fundo px-2 py-0.5 text-legenda font-bold text-laranja-escuro">Avulso pago</span>}
            {fixado && <span className="rounded-full bg-selecao px-2 py-0.5 text-legenda font-bold text-beringela">No topo da loja</span>}
          </div>
          <h2 className="line-clamp-2 break-words text-base font-semibold leading-5">
            {publico ? (
              <Link href={linkAnuncio(a.id, a.titulo)} className="hover:underline focus-visible:outline-3 focus-visible:outline-laranja-escuro">
                {titulo}
              </Link>
            ) : (
              titulo
            )}
          </h2>
          <p className="text-lg font-bold leading-6">{preco(a.preco_centavos)}</p>
          {a.cidade && <p className="break-words text-sm text-texto-suave">{[a.bairro, a.cidade].filter(Boolean).join(", ")}</p>}
          {quando && <p className="text-legenda text-texto-suave">{a.status === "rascunho" ? `Salvo ${quando}` : quando}</p>}
        </div>
      </div>

      {a.status === "excluido" && <p className="rounded-card bg-fundo p-3 text-sm text-texto-suave">Na lixeira{a.excluido_em ? ` ${tempoRelativo(a.excluido_em)}` : ""}. Antes: {a.status_antes_exclusao ? ROTULO[a.status_antes_exclusao].texto.toLowerCase() : "anúncio"}.</p>}
      {(a.status === "pausado" || a.status === "expirado") && <p className="text-sm text-texto-suave">Fora da busca. Revise os dados antes de reativar.</p>}
      {a.status === "vendido" && <p className="text-sm text-texto-suave">Venda concluída. O contato para este anúncio está encerrado.</p>}
      {(a.status === "em_analise" || (a.status === "pausado" && a.motivo_analise?.startsWith("Recusado:"))) && a.motivo_analise && (
        <p className="rounded-card bg-aviso-fundo p-2 text-sm font-semibold text-aviso">Motivo: {a.motivo_analise}</p>
      )}
      {a.status === "congelado" && (
        <p className="rounded-card bg-perigo-fundo p-2 text-sm font-semibold text-perigo">Este anúncio foi bloqueado pela equipe. Fale com o suporte.</p>
      )}

      {a.status !== "rascunho" && (
        <dl className="grid grid-cols-3 gap-2 rounded-card bg-fundo p-2 text-center">
          <Numero icone={<Eye />} rotulo="visualizações" valor={a.visualizacoes} />
          <Numero icone={<MessageCircle />} rotulo="cliques no WhatsApp" valor={a.cliques_whatsapp} />
          <Numero icone={<Heart />} rotulo="favoritos" valor={a.total_favoritos} />
        </dl>
      )}

      {d && (
        <p className="flex items-start gap-2 rounded-card bg-fundo p-2 text-sm">
          <BarChart3 className="mt-0.5 size-4 shrink-0 text-laranja-escuro" aria-hidden />
          <span>
            {d.status === "ativo" ? `${d.tipo_nome}: seu destaque` : `Seu último destaque (${d.tipo_nome})`} teve {fraseResultado(d)}.
          </span>
        </p>
      )}

      {p && a.status === "ativo" && (
        <div className="flex flex-col gap-2 rounded-card bg-aviso-fundo p-3">
          <p className="flex items-start gap-2 text-sm font-semibold text-aviso">
            <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
            Pagamento pendente: {p.tipo_nome} ({preco(p.preco_centavos)})
          </p>
          <Botao href={linkDestacar(a.id, p.id)} variante="secundario" tamanho="pequeno" className="w-fit">
            Continuar o pagamento
          </Botao>
        </div>
      )}

      <AcoesAnuncio
        id={a.id}
        status={a.status}
        titulo={titulo}
        temPagamento={pago || destaque || !!p}
        maisAcoes={a.status !== "excluido" && mostrarFixar && (a.status === "ativo" || fixado) ? <BotaoFixar anuncioId={a.id} fixado={fixado} comoItemDeMenu /> : undefined}
      />
    </article>
  );
}

function Numero({ icone, rotulo, valor }: { icone: React.ReactNode; rotulo: string; valor: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <dt className="order-2 text-legenda leading-4 text-texto-suave">{rotulo}</dt>
      <dd className="order-1 flex items-center gap-1 text-base font-bold">
        <span className="inline-flex text-laranja-escuro [&>svg]:size-4" aria-hidden>
          {icone}
        </span>
        {inteiro(valor)}
      </dd>
    </div>
  );
}
