import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso, Cartao, Titulo, estiloBotaoSec } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { exigirTela } from "@/lib/admin/equipe";
import { inteiro, quando } from "@/lib/admin/formato";
import { ehUuid, linkLoja, telefone } from "@/lib/formato";
import { LINK_ADMIN_ANUNCIOS, LINK_ADMIN_LOJAS, LINK_ADMIN_PAGAMENTOS } from "@/lib/rotas";
import type { LojaAdmin } from "@/lib/tipos-cobranca";
import { FormAcaoLoja } from "../formularios";
import { FormArquivoLoja } from "./arquivo";

export const metadata = { title: "Ficha da loja" };

type Ficha = {
  atualizado_em: string;
  verificacao: string;
  anuncios: number;
  gerentes: number | null;
  convites: number | null;
  pagamentos: number | null;
  cobrancas_pendentes: number;
  destaques_pagos: number;
  congelados: number;
  historico: { id: string; acao: string; motivo: string; criado_em: string; operador: string | null }[] | null;
};

const SITUACAO = {
  teste: "Em teste", teste_vencido: "Teste vencido", ativa: "Plano em dia", vencida: "Plano vencido",
  gratis: "Grátis", inadimplente: "Inadimplente", suspensa: "Suspensa", arquivada: "Arquivada",
};
const VERIFICACAO: Record<string, string> = {
  pendente: "Pendente", aprovada: "Aprovada", correcao: "Correção solicitada", recusada: "Recusada",
};
const ACOES: Record<string, string> = {
  arquivar: "Loja arquivada", restaurar: "Loja restaurada", suspender: "Loja suspensa", reativar: "Loja reativada",
  cortesia: "Cortesia concedida", trocar_plano: "Plano trocado", dar_selo: "Selo concedido", tirar_selo: "Selo removido",
  verificacao_aprovada: "Verificação aprovada", verificacao_correcao: "Correção solicitada", verificacao_recusada: "Verificação recusada",
};

export default async function FichaLojaPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, papel } = await exigirTela("lojas");
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const admin = papel === "administrador";
  const podeOperar = admin || papel === "suporte";
  const [lojas, fichaR, planos, regiao] = await Promise.all([
    supabase.rpc("admin_lojas", { p_busca: id, p_limite: 1 }),
    supabase.rpc("admin_ficha_loja", { p_loja: id }),
    admin ? supabase.from("planos").select("codigo, nome").order("ordem") : Promise.resolve({ data: [], error: null }),
    supabase.from("microrregioes").select("id, nome"),
  ]);

  const voltar = <Link href={LINK_ADMIN_LOJAS} className={`${estiloBotaoSec} mb-4`}>Voltar para Lojas</Link>;
  if (lojas.error || fichaR.error) {
    return <>{voltar}<Titulo>Ficha da loja</Titulo><Aviso tipo="erro">Não foi possível carregar a ficha. Atualize a página.</Aviso></>;
  }
  const loja = (lojas.data as LojaAdmin[] | null)?.[0];
  const ficha = fichaR.data as Ficha | null;
  if (!loja || loja.id !== id.toLowerCase() || !ficha) notFound();
  const arquivada = loja.situacao === "arquivada";
  const local = [loja.cidade, regiao.data?.find((r) => r.id === loja.microrregiao_id)?.nome].filter(Boolean).join(" · ");
  const vencimento = loja.situacao === "teste" || loja.situacao === "teste_vencido" ? loja.teste_expira_em : loja.plano_expira_em;

  return (
    <div className="space-y-3 [overflow-wrap:anywhere]">
      {voltar}
      <Titulo sub={[loja.tipo === "loja" ? "Loja" : "Vendedor individual", local].filter(Boolean).join(" · ")}>{loja.nome}</Titulo>
      <Cartao>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={arquivada ? "secondary" : loja.status === "suspensa" ? "destructive" : "default"}>{SITUACAO[loja.situacao]}</Badge>
          {loja.status === "ativa" && <Link href={linkLoja(encodeURIComponent(loja.slug))} className={estiloBotaoSec}>Ver vitrine</Link>}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Dado rotulo="Responsável">{loja.dono_nome ?? "Indisponível"}</Dado>
          {loja.whatsapp && <Dado rotulo="WhatsApp">{telefone(loja.whatsapp)}</Dado>}
          <Dado rotulo="Plano">{loja.plano_efetivo_nome ?? loja.plano_nome ?? "Sem plano"}</Dado>
          {vencimento && <Dado rotulo="Vencimento">{quando(vencimento)}</Dado>}
          <Dado rotulo="Anúncios no ar">
            {inteiro(loja.anuncios_ativos)}{loja.limite_anuncios !== null ? ` de ${inteiro(loja.limite_anuncios)}` : ""}
          </Dado>
          <Dado rotulo="Total de anúncios">{inteiro(ficha.anuncios)}</Dado>
          {loja.tipo === "loja" && <Dado rotulo="Verificação">{VERIFICACAO[ficha.verificacao] ?? "Indisponível"}</Dado>}
          {loja.tipo === "loja" && ficha.gerentes !== null && (
            <Dado rotulo="Equipe da loja">{inteiro(ficha.gerentes)} gerentes · {inteiro(ficha.convites ?? 0)} convites</Dado>
          )}
          {ficha.pagamentos !== null && (
            <Dado rotulo="Pagamentos">{inteiro(ficha.pagamentos)} no total · {inteiro(ficha.cobrancas_pendentes)} em aberto</Dado>
          )}
        </dl>
        {admin && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`${LINK_ADMIN_ANUNCIOS}?loja=${loja.id}`} prefetch={false} className={estiloBotaoSec}>Ver anúncios</Link>
            <Link href={`${LINK_ADMIN_PAGAMENTOS}?loja=${loja.id}&ambiente=todos`} prefetch={false} className={estiloBotaoSec}>Ver pagamentos</Link>
          </div>
        )}
      </Cartao>
      {podeOperar && !arquivada && (
        <Cartao>
          <h2 className="mb-3 text-sm font-semibold text-beringela">Operação</h2>
          {planos.error ? <Aviso tipo="erro">Não foi possível carregar os planos. Atualize a página.</Aviso> : null}
          <FormAcaoLoja key={loja.status} loja={loja} planos={planos.data ?? []}
            permitidas={admin && !planos.error ? null : ["suspender", "reativar"]} />
        </Cartao>
      )}
      {admin && loja.tipo === "loja" && (
        <Cartao>
          <h2 className="mb-2 text-sm font-semibold text-beringela">Arquivo</h2>
          <p className="mb-3 text-sm text-texto-suave">
            {arquivada ? "Esta loja está no arquivo." : "Use para lojas encerradas, duplicadas ou de teste."}
          </p>
          <FormArquivoLoja id={loja.id} nome={loja.nome} arquivada={arquivada} atualizado={ficha.atualizado_em}
            ativos={loja.anuncios_ativos} gerentes={ficha.gerentes ?? 0} convites={ficha.convites ?? 0}
            pendentes={ficha.cobrancas_pendentes} destaques={ficha.destaques_pagos} congelados={ficha.congelados} />
        </Cartao>
      )}
      {ficha.historico && (
        <Cartao>
          <h2 className="text-sm font-semibold text-beringela">Histórico administrativo</h2>
          {ficha.historico.length === 30 && <p className="mt-1 text-legenda text-texto-suave">Últimas 30 ações</p>}
          {ficha.historico.length ? (
            <ol className="mt-2 divide-y divide-borda">
              {ficha.historico.map((item) => (
                <li key={item.id} className="py-2 text-sm">
                  <p className="font-semibold">{ACOES[item.acao] ?? item.acao}</p>
                  <p>{item.motivo}</p>
                  <p className="text-legenda text-texto-suave">{quando(item.criado_em)}{item.operador && ` · ${item.operador}`}</p>
                </li>
              ))}
            </ol>
          ) : <p className="mt-2 text-sm text-texto-suave">Nenhuma ação registrada.</p>}
        </Cartao>
      )}
    </div>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return <div><dt className="text-texto-suave">{rotulo}</dt><dd className="font-semibold">{children}</dd></div>;
}
