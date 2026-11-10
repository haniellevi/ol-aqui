import Link from "next/link";
import { Download, ExternalLink, MessageCircle } from "lucide-react";
import { exigirTela } from "@/lib/admin/equipe";
import { LINK_ADMIN_PAGAMENTOS } from "@/lib/rotas";
import { inteiro, quando, reais } from "@/lib/admin/formato";
import {
  NOME_STATUS,
  NOME_TIPO,
  STATUS_PAGAMENTOS,
  TIPOS_PAGAMENTOS,
  devolucoesAFazer,
  filtrosNoEndereco,
  lerFiltros,
  linkSeguro,
  listarPagamentos,
} from "@/lib/admin/pagamentos";
import { Aviso, Cartao, Numero, Titulo, estiloBotao, estiloBotaoSec, estiloCampo } from "@/components/admin/ui";
import { CopiarLink } from "./copiar-link";
import type { PagamentoAdmin, ResumoPagamentos, StatusPagamento } from "@/lib/tipos-cobranca";

export const metadata = { title: "Pagamentos" };

// Tela 6 · Pagamentos: filtros (status, tipo, região, período), totais, link da fatura do Asaas,
// reenviar o link (pelo WhatsApp da loja ou copiar), devoluções a fazer e exportar CSV. Tudo com o token do admin (RLS).

const LIMITE = 200;

const COR_STATUS: Record<StatusPagamento, string> = {
  pendente: "bg-aviso-fundo text-aviso",
  pago: "bg-sucesso-fundo text-verde-escuro",
  vencido: "bg-perigo-fundo text-perigo",
  estornado: "bg-fundo text-texto-suave",
  cancelado: "bg-fundo text-texto-suave",
};

type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function PagamentosPage({ searchParams }: { searchParams: Params }) {
  const { supabase } = await exigirTela("pagamentos"); // administrador e financeiro
  const filtros = lerFiltros(await searchParams);

  const [lista, resumoR, devolver, regioesR, planosR] = await Promise.all([
    listarPagamentos(supabase, filtros, LIMITE).catch(() => null),
    supabase.rpc("admin_resumo_pagamentos", {
      p_status: filtros.status,
      p_tipo: filtros.tipo,
      p_regiao: filtros.regiao,
      p_de: filtros.de,
      p_ate: filtros.ate,
    }),
    devolucoesAFazer(supabase),
    supabase.from("microrregioes").select("id, nome").order("nome"),
    supabase.from("planos").select("codigo, nome"),
  ]);

  const resumo = ((resumoR.data ?? []) as ResumoPagamentos[]).map((r) => ({
    ...r,
    quantidade: Number(r.quantidade),
    total_centavos: Number(r.total_centavos),
  }));
  const somar = (s: StatusPagamento) => resumo.filter((r) => r.status === s).reduce((t, r) => t + r.total_centavos, 0);
  const contar = (s: StatusPagamento) => resumo.filter((r) => r.status === s).reduce((t, r) => t + r.quantidade, 0);
  const regioes = (regioesR.data ?? []) as { id: string; nome: string }[];
  const nomeRegiao = new Map(regioes.map((r) => [r.id, r.nome]));
  const nomePlano = new Map(((planosR.data ?? []) as { codigo: string; nome: string }[]).map((p) => [p.codigo, p.nome]));
  const endereco = filtrosNoEndereco(filtros);
  const filtrando = endereco.length > 0;

  return (
    <>
      <Titulo sub="Cobranças de planos, anúncios avulsos e destaques. Valores do Asaas; nada é cobrado por aqui.">Pagamentos</Titulo>

      {/* Filtros */}
      <Cartao className="mb-6">
        <form method="get" className="grid grid-cols-1 items-end gap-3 @sm/painel:grid-cols-2 @3xl/painel:grid-cols-4">
          <label className="text-sm font-semibold">
            Situação
            <select name="status" defaultValue={filtros.status ?? ""} className={estiloCampo}>
              <option value="">Todas</option>
              {STATUS_PAGAMENTOS.map((s) => (
                <option key={s} value={s}>
                  {NOME_STATUS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Tipo
            <select name="tipo" defaultValue={filtros.tipo ?? ""} className={estiloCampo}>
              <option value="">Todos</option>
              {TIPOS_PAGAMENTOS.map((t) => (
                <option key={t} value={t}>
                  {NOME_TIPO[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-full text-sm font-semibold @3xl/painel:col-span-2">
            Região
            <select name="regiao" defaultValue={filtros.regiao ?? ""} className={estiloCampo}>
              <option value="">Todas</option>
              {regioes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            De
            <input type="date" name="de" defaultValue={filtros.de ?? ""} className={estiloCampo} />
          </label>
          <label className="text-sm font-semibold">
            Até
            <input type="date" name="ate" defaultValue={filtros.ate ?? ""} className={estiloCampo} />
          </label>
          <div className="col-span-full flex flex-wrap items-center gap-3 ">
            <button type="submit" className={estiloBotao}>
              Filtrar
            </button>
            {filtrando && (
              <Link href={LINK_ADMIN_PAGAMENTOS} className={estiloBotaoSec}>
                Limpar filtros
              </Link>
            )}
            <a href={`${LINK_ADMIN_PAGAMENTOS}/csv${endereco ? `?${endereco}` : ""}`} className={`${estiloBotaoSec} md:ml-auto`} download>
              <Download className="size-5" aria-hidden />
              Exportar CSV
            </a>
          </div>
          <p className="col-span-full text-[13px] text-texto-suave ">
            O período usa a data em que foi pago (ou, se não foi pago, a data do pedido), no horário de Fortaleza.
          </p>
        </form>
      </Cartao>

      {/* Totais */}
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Numero rotulo="Recebido" valor={reais(somar("pago"))} detalhe={`${inteiro(contar("pago"))} pagamentos`} />
        <Numero rotulo="Aguardando" valor={reais(somar("pendente"))} detalhe={`${inteiro(contar("pendente"))} cobranças`} />
        <Numero rotulo="Devolvido" valor={reais(somar("estornado"))} detalhe={`${inteiro(contar("estornado"))} pagamentos`} />
        <Numero
          rotulo="Vencido ou cancelado"
          valor={reais(somar("vencido") + somar("cancelado"))}
          detalhe={`${inteiro(contar("vencido") + contar("cancelado"))} cobranças`}
        />
      </div>
      {resumo.length > 0 && (
        <Cartao className="mb-6 overflow-x-auto focus-visible:outline-2 focus-visible:outline-laranja-escuro" role="region" aria-label="Resumo de pagamentos por tipo" tabIndex={0}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-texto-suave">Por tipo</h2>
          <table className="w-full min-w-[420px] text-left text-sm">
            <caption className="sr-only">Totais de pagamentos por tipo e situação</caption>
            <thead className="text-texto-suave">
              <tr>
                <th scope="col" className="py-2 pr-3 font-semibold">Tipo</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Situação</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">Quantos</th>
                <th scope="col" className="py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {resumo.map((r) => (
                <tr key={`${r.tipo}:${r.status}`}>
                  <td className="py-2 pr-3">{NOME_TIPO[r.tipo] ?? r.tipo}</td>
                  <td className="py-2 pr-3">{NOME_STATUS[r.status] ?? r.status}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{inteiro(r.quantidade)}</td>
                  <td className="py-2 text-right tabular-nums">{reais(r.total_centavos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Cartao>
      )}

      {/* Devoluções a fazer */}
      {devolver.length > 0 && (
        <section aria-labelledby="devolver" className="mb-6">
          <h2 id="devolver" className="mb-3 text-sm font-semibold uppercase tracking-wide text-perigo">
            Devoluções a fazer ({devolver.length})
          </h2>
          <p className="mb-3 text-sm text-texto-suave">
            O dinheiro chegou, mas não deu para aplicar. Devolva no Asaas (a pessoa não perde nada até lá) e o aviso do Asaas fecha o caso.
          </p>
          <ul className="flex flex-col gap-3">
            {devolver.map((p) => (
              <LinhaPagamento key={p.id} p={p} nomePlano={nomePlano} nomeRegiao={nomeRegiao} />
            ))}
          </ul>
        </section>
      )}

      {/* Lista */}
      <section aria-labelledby="lista">
        <h2 id="lista" className="mb-3 text-sm font-semibold uppercase tracking-wide text-texto-suave">
          {lista && lista.length >= LIMITE ? `Os ${LIMITE} mais recentes` : "Pagamentos"}
        </h2>
        {lista === null ? (
          <Aviso tipo="erro">Não deu para ler os pagamentos agora. Atualize a página.</Aviso>
        ) : lista.length === 0 ? (
          <Cartao>
            <p className="text-base text-texto-suave">Nenhum pagamento com estes filtros.</p>
            {filtrando && (
              <Link href={LINK_ADMIN_PAGAMENTOS} className="mt-2 inline-flex min-h-12 items-center font-semibold text-laranja-escuro underline underline-offset-4">
                Ver todos
              </Link>
            )}
          </Cartao>
        ) : (
          <ul className="flex flex-col gap-3">
            {lista.map((p) => (
              <LinhaPagamento key={p.id} p={p} nomePlano={nomePlano} nomeRegiao={nomeRegiao} />
            ))}
          </ul>
        )}
        {lista && lista.length >= LIMITE && (
          <p className="mt-3 text-sm text-texto-suave">Para ver mais, use os filtros ou exporte o CSV.</p>
        )}
      </section>
    </>
  );
}

/** wa.me com a mensagem e o link da fatura, para a equipe reenviar no WhatsApp do vendedor. */
function reenviarNoWhatsApp(numero: string | null, link: string, oQue: string): string | null {
  const digitos = (numero ?? "").replace(/\D/g, "");
  if (digitos.length < 12) return null;
  const texto = `Olá! Aqui é a equipe OLAKI. Segue o link para pagar (${oQue.trim()}): ${link}`;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}

function LinhaPagamento({ p, nomePlano, nomeRegiao }: { p: PagamentoAdmin; nomePlano: Map<string, string>; nomeRegiao: Map<string, string> }) {
  const link = linkSeguro(p.link_pagamento);
  const oQue =
    p.tipo === "assinatura"
      ? `${NOME_TIPO.assinatura} ${p.plano_codigo ? nomePlano.get(p.plano_codigo) ?? p.plano_codigo : ""}${p.meses && p.meses > 1 ? ` · ${p.meses} períodos` : ""}`
      : p.tipo === "anuncio_avulso"
        ? `${NOME_TIPO.anuncio_avulso}${p.anuncio_titulo ? ` · ${p.anuncio_titulo}` : ""}`
        : `${NOME_TIPO.destaque}${p.anuncio_titulo ? ` · ${p.anuncio_titulo}` : ""}`;
  return (
    <li className="rounded-card border border-borda bg-cartao p-4 shadow-1">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-beringela">{oQue}</p>
          <p className="text-sm text-texto-suave">
            {p.vitrine_slug ? (
              <Link href={`/loja/${p.vitrine_slug}`} className="underline underline-offset-2">
                {p.vitrine_nome ?? "Loja"}
              </Link>
            ) : (
              p.vitrine_nome ?? "Loja"
            )}
            {" · "}
            {nomeRegiao.get(p.microrregiao_id) ?? "Região"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tabular-nums text-beringela">{reais(p.valor_centavos)}</p>
          <span className={`rounded-full px-2 py-0.5 text-[13px] font-bold ${COR_STATUS[p.status]}`}>{NOME_STATUS[p.status]}</span>
        </div>
      </div>
      <p className="mt-2 text-[13px] text-texto-suave">
        Pedido {quando(p.criado_em)}
        {p.pago_em ? ` · Pago ${quando(p.pago_em)}` : p.vencimento ? ` · Vence ${p.vencimento.split("-").reverse().join("/")}` : ""}
        {p.forma ? ` · ${p.forma === "pix" ? "Pix" : p.forma === "cartao" ? "Cartão" : "Boleto"}` : ""}
        {p.asaas_cobranca_id ? ` · Asaas ${p.asaas_cobranca_id}` : ""}
      </p>
      {p.devolver_motivo && p.status === "pago" && <p className="mt-2 text-sm font-semibold text-perigo">Devolver: {p.devolver_motivo}</p>}
      {p.observacao && <p className="mt-1 text-sm text-texto-suave">Nota: {p.observacao}</p>}
      {link && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-1 px-3 font-semibold text-laranja-escuro underline-offset-4 hover:underline">
            <ExternalLink className="size-4" aria-hidden />
            Abrir fatura
          </a>
          {p.status === "pendente" && (() => {
            const wa = reenviarNoWhatsApp(p.vitrine_whatsapp, link, oQue);
            return wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-1 px-3 font-semibold text-laranja-escuro underline-offset-4 hover:underline">
                <MessageCircle className="size-4" aria-hidden />
                Reenviar no WhatsApp
              </a>
            ) : null;
          })()}
          {p.status === "pendente" && <CopiarLink link={link} />}
        </div>
      )}
    </li>
  );
}
