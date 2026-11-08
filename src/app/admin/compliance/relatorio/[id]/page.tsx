import Link from "next/link";
import { exigirAdmin } from "@/lib/admin/auth";
import { ipDoNavegador } from "@/lib/admin/equipe";
import { quando } from "@/lib/admin/formato";
import { lerRelatorio } from "@/lib/dados/compliance";
import { emailsDaConta } from "@/lib/dados/equipe";
import { ehUuid } from "@/lib/formato";
import { LINK_ADMIN_COMPLIANCE } from "@/lib/rotas";
import { Aviso, Titulo } from "@/components/admin/ui";
import { DadosConta } from "../../dados-conta";
import { BotaoImprimir } from "../../formularios";

export const metadata = { title: "Relatório do Compliance" };
export const dynamic = "force-dynamic";

// Tela 8 · Relatório para imprimir (o navegador salva em PDF; sem biblioteca de PDF).
// Só quem pediu, dentro da validade (compliance_relatorio confere). Cada abertura fica gravada.

// Na impressão some o menu do painel e os botões; o relatório ocupa a folha toda.
const ESTILO_IMPRESSAO = `
@media print {
  aside, nav, .nao-imprimir { display: none !important; }
  main { max-width: none !important; padding: 0 !important; }
  body { background: #fff !important; }
  @page { margin: 16mm 14mm; }
}`;

export default async function RelatorioPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await exigirAdmin();
  const { id } = await params;
  const r = ehUuid(id) ? await lerRelatorio(supabase, id, await ipDoNavegador()) : null;

  if (!r || !r.ok) {
    return (
      <>
        <Titulo>Relatório do Compliance</Titulo>
        <Aviso tipo="erro">{r && !r.ok ? r.erro : "Relatório não encontrado."}</Aviso>
        <Link href={LINK_ADMIN_COMPLIANCE} prefetch={false} className="mt-4 inline-flex min-h-12 items-center font-semibold text-laranja-escuro underline underline-offset-4">
          Voltar ao Compliance
        </Link>
      </>
    );
  }
  const { cabecalho: c, dados } = r.dados;
  // Histórico cortado no máximo de linhas: o período real começa na linha mais antiga que entrou.
  const cortado = dados.historico.length >= dados.historico_limite && dados.historico.length > 0;
  const inicio = cortado ? dados.historico[dados.historico.length - 1].criado_em : dados.desde;
  const emails = await emailsDaConta(dados.usuario_id);

  return (
    <article className="text-beringela">
      <style>{ESTILO_IMPRESSAO}</style>
      <div className="nao-imprimir mb-6 flex flex-wrap items-center gap-3">
        <BotaoImprimir />
        <Link href={LINK_ADMIN_COMPLIANCE} prefetch={false} className="inline-flex min-h-12 items-center font-semibold text-laranja-escuro underline underline-offset-4">
          Voltar ao Compliance
        </Link>
      </div>

      <header className="rounded-card border border-borda bg-cartao p-4 print:border-beringela">
        <p className="text-sm font-semibold uppercase tracking-wide text-texto-suave">OLAKI · Compliance jurídico</p>
        <h1 className="mt-1 text-2xl font-bold">Relatório de registros de conta</h1>
        <p className="text-sm text-texto-suave">Marco Civil da Internet (Lei 12.965/2014), art. 15 · registros de acesso a aplicações</p>
        <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[12rem_1fr]">
          <dt className="text-sm text-texto-suave">Relatório nº</dt>
          <dd className="break-all font-mono text-sm">{c.relatorio_id}</dd>
          <dt className="text-sm text-texto-suave">Gerado em</dt>
          <dd>{quando(c.gerado_em)} (horário de Brasília/Fortaleza)</dd>
          <dt className="text-sm text-texto-suave">Impresso em</dt>
          <dd>{quando(c.impresso_em)}</dd>
          <dt className="text-sm text-texto-suave">Quem gerou</dt>
          <dd>
            {c.gerado_por_nome ?? "—"} <span className="font-mono text-sm text-texto-suave">({c.gerado_por_id})</span>
          </dd>
          <dt className="text-sm text-texto-suave">Motivo</dt>
          <dd className="break-words font-semibold">{c.motivo}</dd>
          {c.motivo_consulta && c.motivo_consulta !== c.motivo && (
            <>
              <dt className="text-sm text-texto-suave">Motivo da consulta</dt>
              <dd className="break-words">{c.motivo_consulta}</dd>
            </>
          )}
          <dt className="text-sm text-texto-suave">Conta</dt>
          <dd className="break-all font-mono text-sm">{dados.usuario_id}</dd>
          <dt className="text-sm text-texto-suave">Período do histórico</dt>
          <dd>
            {quando(inicio)} a {quando(c.impresso_em)}
            {cortado && (
              <span className="block text-sm font-semibold text-perigo">
                Lista cortada nas {dados.historico_limite} linhas mais novas. O período pedido começava em {quando(dados.desde)}.
              </span>
            )}
          </dd>
          <dt className="text-sm text-texto-suave">IP de quem gerou</dt>
          <dd className="text-sm">
            {c.ip_navegador ?? "—"} (informado pelo painel do OLAKI) · {c.ip_banco ?? "—"} (gravado pelo banco)
          </dd>
        </dl>
      </header>

      <DadosConta d={dados} relatorio emails={emails} />

      <footer className="mt-8 border-t border-borda pt-3 text-sm text-texto-suave">
        <p>
          Datas e horários são os gravados pelo sistema do OLAKI no momento de cada ação. Os IPs marcados com * são os que chegaram ao
          banco: costumam ser do servidor do site do OLAKI, e não da pessoa (veja o aviso no começo). A porta lógica de origem não é
          gravada. Este relatório foi gerado a pedido e o próprio pedido ficou registrado (quem, quando e motivo).
        </p>
        <p className="mt-2">Relatório nº {c.relatorio_id}</p>
      </footer>
    </article>
  );
}
