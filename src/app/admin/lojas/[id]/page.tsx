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
import { localidadesGestao } from "@/lib/admin/gestao-dados";
import type { LojaGestao } from "@/lib/admin/gestao";
import { HistoricoGestao } from "@/components/admin/historico-gestao";
import { FormGestaoLoja } from "../gestao-formularios";
import { FormLixeiraLoja } from "../../lixeira/formularios";
import type { Lixeira } from "@/lib/admin/lixeira";
import { FormArquivoLoja } from "./arquivo";
import { FormCortesiaRadar } from "./cortesia-radar";
import { cortesiaRadarAtiva } from "@/lib/admin/cortesia-radar";
import { eSuperAdmin } from "@/lib/admin/auth";
import { Botao } from "@/components/ui/botao";
import { escolherLoja } from "@/app/(conta)/_loja/actions";
import { FormCancelarConviteDono, FormConvidarDono } from "../montagem-formularios";

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
  gratis: "Grátis", inadimplente: "Inadimplente", suspensa: "Suspensa", arquivada: "Arquivada", excluida: "Na lixeira",
  montagem: "Em montagem",
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
  const [lojas, fichaR, planos, regiao, gestaoR, locais, lixeiraR, superAdmin, conviteR, cortesiaR] = await Promise.all([
    supabase.rpc("admin_lojas", { p_busca: id, p_limite: 1 }),
    supabase.rpc("admin_ficha_loja", { p_loja: id }),
    admin ? supabase.from("planos").select("codigo, nome").order("ordem") : Promise.resolve({ data: [], error: null }),
    supabase.from("microrregioes").select("id, nome"),
    admin ? supabase.rpc("admin_loja_detalhe", { p_id: id }) : Promise.resolve({data:null,error:null}),
    admin ? localidadesGestao(supabase) : Promise.resolve(null),
    admin ? supabase.rpc("admin_lixeira") : Promise.resolve({ data: null, error: null }),
    admin ? eSuperAdmin(supabase) : Promise.resolve(false),
    // P5c: convite pendente do dono (só o super admin recebe linha).
    admin ? supabase.rpc("super_convite_dono_pendente", { p_loja: id }).maybeSingle<{ final_telefone: string; expira_em: string }>()
      : Promise.resolve({ data: null, error: null }),
    // Cortesia do Radar: tabela sem leitura direta; só administrador, lida no servidor.
    admin ? cortesiaRadarAtiva(id) : Promise.resolve({ cortesia: null, erro: false }),
  ]);

  const voltar = <Link href={LINK_ADMIN_LOJAS} className={`${estiloBotaoSec} mb-4`}>Voltar para Lojas</Link>;
  if (lojas.error || fichaR.error) {
    return <>{voltar}<Titulo>Ficha da loja</Titulo><Aviso tipo="erro">Não foi possível carregar a ficha. Atualize a página.</Aviso></>;
  }
  const loja = (lojas.data as LojaAdmin[] | null)?.[0];
  const ficha = fichaR.data as Ficha | null;
  if (!loja || loja.id !== id.toLowerCase() || !ficha) notFound();
  const gestao = gestaoR.data as LojaGestao | null;
  const arquivada = loja.situacao === "arquivada";
  const excluida = loja.situacao === "excluida";
  const montagem = loja.status === "montagem";
  const naLixeira = (lixeiraR.data as Lixeira | null)?.lojas.find((l) => l.id === loja.id) ?? null;
  const comConta = excluida && naLixeira?.origem === "conta";
  const local = [loja.cidade, regiao.data?.find((r) => r.id === loja.microrregiao_id)?.nome].filter(Boolean).join(" · ");
  const vencimento = loja.situacao === "teste" || loja.situacao === "teste_vencido" ? loja.teste_expira_em : loja.plano_expira_em;

  return (
    <div className="space-y-3 [overflow-wrap:anywhere]">
      {voltar}
      <Titulo sub={[loja.tipo === "loja" ? "Loja" : "Vendedor individual", local].filter(Boolean).join(" · ")}>{loja.nome}</Titulo>
      <Cartao>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={arquivada ? "secondary" : excluida ? "destructive" : loja.status === "suspensa" ? "destructive" : "default"}>{SITUACAO[loja.situacao]}</Badge>
          {loja.status === "ativa" && <Link href={linkLoja(encodeURIComponent(loja.slug))} className={estiloBotaoSec}>Ver vitrine</Link>}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Dado rotulo="Responsável">{montagem ? "Equipe Mercado da Região, até o dono aceitar" : loja.dono_nome ?? "Indisponível"}</Dado>
          {loja.whatsapp && <Dado rotulo="WhatsApp">{telefone(loja.whatsapp)}</Dado>}
          <Dado rotulo="Plano">{montagem ? "Teste grátis começa quando o dono aceitar" : loja.plano_efetivo_nome ?? loja.plano_nome ?? "Sem plano"}</Dado>
          {vencimento && <Dado rotulo="Vencimento">{quando(vencimento)}</Dado>}
          <Dado rotulo="Anúncios no ar">
            {inteiro(loja.anuncios_ativos)}{loja.limite_anuncios !== null && !montagem ? ` de ${inteiro(loja.limite_anuncios)}` : ""}
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
            {!montagem && <Link href={`/admin/usuarios/${loja.dono_id}`} className={estiloBotaoSec}>Gerenciar titular</Link>}
            <Link href={`${LINK_ADMIN_ANUNCIOS}?loja=${loja.id}`} prefetch={false} className={estiloBotaoSec}>Ver anúncios</Link>
            <Link href={`${LINK_ADMIN_PAGAMENTOS}?loja=${loja.id}&ambiente=todos`} prefetch={false} className={estiloBotaoSec}>Ver pagamentos</Link>
          </div>
        )}
      </Cartao>
      {montagem && !arquivada && !excluida && (
        <Cartao>
          <h2 className="mb-2 text-sm font-semibold text-beringela">Loja em montagem</h2>
          <p className="mb-3 text-sm text-texto-suave">
            Só a equipe vê esta loja. Cadastre os produtos e a aparência pela conta, como ajudante: o produto publicado fica pronto
            e vai ao ar quando o dono aceitar. O teste grátis começa no dia do aceite.
          </p>
          {superAdmin ? (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                <form action={escolherLoja}>
                  <input type="hidden" name="loja" value={loja.id} />
                  <input type="hidden" name="voltar" value="/minha-conta/loja" />
                  <Botao type="submit" variante="secundario">Cuidar da loja</Botao>
                </form>
                <form action={escolherLoja}>
                  <input type="hidden" name="loja" value={loja.id} />
                  <input type="hidden" name="voltar" value="/anunciar" />
                  <Botao type="submit" variante="secundario">Cadastrar produto</Botao>
                </form>
              </div>
              <h3 className="mb-2 text-sm font-semibold">Convite para o dono</h3>
              {conviteR.error ? (
                <Aviso tipo="erro">Não foi possível ver o convite pendente. Atualize a página.</Aviso>
              ) : conviteR.data && (
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                  <p>Convite aberto para o WhatsApp terminado em {conviteR.data.final_telefone}, vale até {quando(conviteR.data.expira_em)}. Um convite novo cancela este.</p>
                  <FormCancelarConviteDono loja={loja.id} />
                </div>
              )}
              <FormConvidarDono loja={loja.id} nome={loja.nome} />
            </>
          ) : (
            <p className="text-sm">Só o super admin cuida da loja em montagem e convida o dono.</p>
          )}
        </Cartao>
      )}
      {admin && !arquivada && !excluida && (gestao && locais && !gestaoR.error ? <details className="rounded-card border border-borda bg-cartao p-3" open>
        <summary className="cursor-pointer text-sm font-semibold text-beringela">Editar cadastro da loja</summary>
        <div className="mt-4"><FormGestaoLoja loja={gestao} locais={locais} /></div>
      </details> : <Aviso tipo="erro">Não foi possível carregar a edição da loja. Atualize a página.</Aviso>)}
      {podeOperar && !arquivada && !excluida && !montagem && (
        <Cartao>
          <h2 className="mb-3 text-sm font-semibold text-beringela">Operação</h2>
          {planos.error ? <Aviso tipo="erro">Não foi possível carregar os planos. Atualize a página.</Aviso> : null}
          <FormAcaoLoja key={loja.status} loja={loja} planos={planos.data ?? []}
            permitidas={admin && !planos.error ? null : ["suspender", "reativar"]} />
        </Cartao>
      )}
      {admin && !arquivada && !excluida && !montagem && (
        <Cartao>
          <h2 className="mb-2 text-sm font-semibold text-beringela">Cortesia do Radar</h2>
          <p className="mb-3 text-sm text-texto-suave">
            Libera tudo do Radar (ver pedidos &quot;Só lojas&quot;, mandar ofertas e receber aviso na hora), mesmo sem selo ou plano pago, até a data escolhida.
          </p>
          {cortesiaR.erro ? (
            <Aviso tipo="erro">Não foi possível ver a cortesia do Radar. Atualize a página.</Aviso>
          ) : cortesiaR.cortesia ? (
            <p className="mb-3 text-sm font-semibold text-verde-escuro">
              Cortesia ativa até {quando(cortesiaR.cortesia.ate)}{cortesiaR.cortesia.motivo ? ` · ${cortesiaR.cortesia.motivo}` : ""}
            </p>
          ) : (
            <p className="mb-3 text-sm text-texto-suave">Sem cortesia ativa.</p>
          )}
          <FormCortesiaRadar vitrineId={loja.id} ativa={!!cortesiaR.cortesia} />
        </Cartao>
      )}
      {admin && loja.tipo === "loja" && !excluida && (
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
      {admin && <HistoricoGestao db={supabase} tipo="loja" id={id} />}
      {admin && !arquivada && !lixeiraR.error && <FormLixeiraLoja id={loja.id} naLixeira={excluida} comConta={comConta} />}
      {excluida && naLixeira && <Aviso tipo="erro">Na lixeira até {quando(naLixeira.apagar_apos)}. Para apagar antes, use a <Link href="/admin/lixeira" className="font-semibold underline">Lixeira</Link>.</Aviso>}
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
