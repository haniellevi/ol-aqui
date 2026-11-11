import Link from "next/link";
import { Download, ExternalLink, MessageCircle } from "lucide-react";
import { exigirTela } from "@/lib/admin/equipe";
import { LINK_ADMIN_PAGAMENTOS } from "@/lib/rotas";
import { inteiro, quando, reais } from "@/lib/admin/formato";
import {
  NOME_AMBIENTE,
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
import { Aviso, Cartao, Numero, Titulo, estiloBotao, estiloBotaoSec, estiloCampo, estiloBotaoDiscreto } from "@/components/admin/ui";
import { CopiarLink } from "./copiar-link";
import type { PagamentoAdmin, ResumoPagamentos, StatusPagamento } from "@/lib/tipos-cobranca";
import { Badge, type TomSelo } from "@/components/ui/badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Pagamentos" };

// Tela 6 · Pagamentos: filtros (status, tipo, região, período), totais, link da fatura do Asaas,
// reenviar o link (pelo WhatsApp da loja ou copiar), devoluções a fazer e exportar CSV. Tudo com o token do admin (RLS).

const LIMITE = 200;

const COR_STATUS: Record<StatusPagamento, TomSelo> = {
  pendente: "warning",
  pago: "success",
  vencido: "destructive",
  estornado: "secondary",
  cancelado: "secondary",
};

type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function PagamentosPage({ searchParams }: { searchParams: Params }) {
  const { supabase, papel } = await exigirTela("pagamentos"); // administrador e financeiro
  const filtros = lerFiltros(await searchParams);

  const [lista, resumoR, devolver, regioesR, planosR] = await Promise.all([
    listarPagamentos(supabase, filtros, LIMITE).catch(() => null),
    supabase.rpc("admin_resumo_pagamentos_filtrado", {
      p_status: filtros.status,
      p_tipo: filtros.tipo,
      p_regiao: filtros.regiao,
      p_de: filtros.de,
      p_ate: filtros.ate,
      p_ambiente: filtros.ambiente === "todos" ? null : filtros.ambiente,
      p_loja: filtros.loja,
    }),
    devolucoesAFazer(supabase, filtros).catch(() => null),
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
  const recarregar = `${LINK_ADMIN_PAGAMENTOS}${endereco ? `?${endereco}` : ""}`;

  return (
    <>
      <Titulo sub="Acompanhe as cobranças de planos, anúncios avulsos e destaques. Use o filtro de ambiente para separar produção, testes e pagamentos sem origem registrada.">Pagamentos</Titulo>

      {/* Filtros */}
      <Cartao className="mb-6">
        <form method="get" className="grid grid-cols-1 items-end gap-3 @sm/painel:grid-cols-2 @3xl/painel:grid-cols-4">
          {filtros.loja && <input type="hidden" name="loja" value={filtros.loja} />}
          <label className="text-sm font-medium">
            Ambiente
            <select name="ambiente" defaultValue={filtros.ambiente} className={estiloCampo}>
              {Object.entries(NOME_AMBIENTE).map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">
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
          <label className="text-sm font-medium">
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
          <label className="col-span-full text-sm font-medium @3xl/painel:col-span-2">
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
          <label className="text-sm font-medium">
            De
            <input type="date" name="de" defaultValue={filtros.de ?? ""} className={estiloCampo} />
          </label>
          <label className="text-sm font-medium">
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
          {filtros.loja && <p className="col-span-full text-sm text-texto-suave">Pagamentos da {papel === "administrador" ? <Link href={`/admin/lojas/${filtros.loja}`} className="text-laranja-escuro underline underline-offset-2">loja selecionada</Link> : "loja selecionada"}.</p>}
          <p className="col-span-full text-legenda text-texto-suave ">
            O período usa a data em que foi pago (ou, se não foi pago, a data do pedido), no horário de Fortaleza.
          </p>
        </form>
      </Cartao>

      {/* Totais */}
      {resumoR.error ? (
        <div className="mb-6"><Aviso tipo="erro">Resumo indisponível. <a href={recarregar} className="font-semibold underline underline-offset-2">Tentar novamente</a></Aviso></div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Numero rotulo="Marcados como pagos" valor={reais(somar("pago"))} detalhe={`${inteiro(contar("pago"))} pagamentos`} />
          <Numero rotulo="Aguardando" valor={reais(somar("pendente"))} detalhe={`${inteiro(contar("pendente"))} cobranças`} />
          <Numero rotulo="Devolvido" valor={reais(somar("estornado"))} detalhe={`${inteiro(contar("estornado"))} pagamentos`} />
          <Numero
            rotulo="Vencido ou cancelado"
            valor={reais(somar("vencido") + somar("cancelado"))}
            detalhe={`${inteiro(contar("vencido") + contar("cancelado"))} cobranças`}
          />
        </div>
      )}
      {!resumoR.error && resumo.length > 0 && (
        <Cartao className="mb-6 px-0 pb-0">
          <h2 className="mb-1 px-3 text-lg font-semibold text-beringela">Por tipo</h2>
          <Table rotulo="Resumo de pagamentos por tipo" className="min-w-[420px]">
            <TableCaption className="sr-only">Totais de pagamentos por tipo e situação</TableCaption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">Tipo</TableHead>
                <TableHead scope="col">Situação</TableHead>
                <TableHead scope="col" className="text-right">Quantos</TableHead>
                <TableHead scope="col" className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumo.map((r) => (
                <TableRow key={`${r.tipo}:${r.status}`}>
                  <TableCell>{NOME_TIPO[r.tipo] ?? r.tipo}</TableCell>
                  <TableCell>{NOME_STATUS[r.status] ?? r.status}</TableCell>
                  <TableCell className="text-right">{inteiro(r.quantidade)}</TableCell>
                  <TableCell className="text-right">{reais(r.total_centavos)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Cartao>
      )}

      {/* Devoluções a fazer */}
      {devolver === null ? (
        <div className="mb-6"><Aviso tipo="erro">Fila de devoluções indisponível. <a href={recarregar} className="font-semibold underline underline-offset-2">Tentar novamente</a></Aviso></div>
      ) : devolver.length > 0 && (
        <section aria-labelledby="devolver" className="mb-6">
          <h2 id="devolver" className="mb-3 text-lg font-semibold text-perigo">
            Devoluções a fazer ({devolver.length})
          </h2>
          <p className="mb-3 text-sm text-texto-suave">
            Pagamentos recebidos que não puderam ser aplicados. Esta fila usa os filtros de ambiente e loja. Confira o ambiente antes de abrir a cobrança no Asaas.
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
        <h2 id="lista" className="mb-3 text-lg font-semibold text-beringela">
          {lista && lista.length >= LIMITE ? `Os ${LIMITE} mais recentes` : "Pagamentos"}
        </h2>
        {lista === null ? (
          <Aviso tipo="erro">Lista de pagamentos indisponível. <a href={recarregar} className="font-semibold underline underline-offset-2">Tentar novamente</a></Aviso>
        ) : lista.length === 0 ? (
          <Cartao>
            <p className="text-base text-texto-suave">Nenhum pagamento com estes filtros.</p>
            {filtrando && (
              <Link href={LINK_ADMIN_PAGAMENTOS} className={`${estiloBotaoDiscreto} mt-2`}>
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
  const texto = `Olá! Aqui é a equipe Mercado da Região. Segue o link para pagar (${oQue.trim()}): ${link}`;
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
          <p className="text-base font-semibold text-beringela [overflow-wrap:anywhere]">{oQue}</p>
          <p className="text-sm text-texto-suave">
            {NOME_AMBIENTE[p.ambiente]} · {p.vitrine_nome ? (
              <Link href={`${LINK_ADMIN_PAGAMENTOS}?loja=${p.vitrine_id}&ambiente=${p.ambiente}`} className="underline underline-offset-2">
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
          <Badge variant={COR_STATUS[p.status]}>{NOME_STATUS[p.status]}</Badge>
        </div>
      </div>
      <p className="mt-2 text-legenda text-texto-suave">
        Pedido {quando(p.criado_em)}
        {p.pago_em ? ` · Pago ${quando(p.pago_em)}` : p.vencimento ? ` · Vence ${p.vencimento.split("-").reverse().join("/")}` : ""}
        {p.forma ? ` · ${p.forma === "pix" ? "Pix" : p.forma === "cartao" ? "Cartão" : "Boleto"}` : ""}
        {p.asaas_cobranca_id ? ` · Asaas ${p.asaas_cobranca_id}` : ""}
      </p>
      {p.devolver_motivo && p.status === "pago" && <p className="mt-2 text-sm font-semibold text-perigo">Devolver: {p.devolver_motivo}</p>}
      {p.observacao && <p className="mt-1 text-sm text-texto-suave">Nota: {p.observacao}</p>}
      {link && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <a href={link} target="_blank" rel="noopener noreferrer" className={`${estiloBotaoDiscreto}`}>
            <ExternalLink className="size-4" aria-hidden />
            Abrir fatura
          </a>
          {p.status === "pendente" && (() => {
            const wa = reenviarNoWhatsApp(p.vitrine_whatsapp, link, oQue);
            return wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" className={`${estiloBotaoDiscreto}`}>
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
