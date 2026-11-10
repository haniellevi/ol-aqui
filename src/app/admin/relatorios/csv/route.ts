import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import {
  NOME_TIPO_RECEITA,
  RELATORIOS,
  lerAnuncios,
  lerConversao,
  lerCustoAki,
  lerFiltrosRelatorio,
  lerFunil,
  lerReceita,
  nomeMes,
} from "@/lib/admin/relatorios";
import type { RelatorioId } from "@/lib/tipos-relatorios";

// Tela 15 · CSV de um bloco dos relatórios (?r=funil|anuncios|conversao|receita|aki&de=&ate=&regiao=).
// Só admin: confere e_admin com o token da pessoa, e as funções do banco conferem de novo.
// Quem não é admin recebe 404. ";" e BOM para abrir certo no Excel em português;
// célula que começa com = + - @ vira texto (não vira fórmula).

export const dynamic = "force-dynamic";

/** Uma célula segura: entre aspas, aspas dobradas e sem virar fórmula na planilha. */
function celula(v: string | number | null | undefined): string {
  let t = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return `"${t.replace(/"/g, '""')}"`;
}

const reais = (centavos: number, casas = 2) => (centavos / 100).toFixed(casas).replace(".", ",");
const naoAchou = () => new Response("Página não encontrada", { status: 404 });
const falhou = () => new Response("Não deu para ler o relatório agora. Tente de novo.", { status: 503 });

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return naoAchou();
  const supabase = await createClient();
  const { data: admin } = await supabase.rpc("e_admin");
  if (admin !== true) return naoAchou();

  const sp = new URL(req.url).searchParams;
  const r = sp.get("r") as RelatorioId | null;
  if (!r || !RELATORIOS.includes(r)) return new Response("Escolha um relatório.", { status: 400 });
  const { filtros } = lerFiltrosRelatorio(sp);

  let cabecalho: string[];
  let linhas: (string | number)[][];
  if (r === "funil") {
    const f = await lerFunil(supabase, filtros);
    if (!f) return falhou();
    cabecalho = ["Indicador", "Quantidade"];
    linhas = [
      ["Visualizações de anúncio", f.visualizacoes],
      ["Cliques no WhatsApp", f.cliques_whatsapp],
      ["Compartilhamentos", f.compartilhamentos],
      ["Anúncios marcados como vendidos", f.vendidos],
      ["Vendi pelo Mercado da Região", f.vendidos_pelo_olaki],
      ["Vendi fora do Mercado da Região", f.vendidos_fora],
      ["Vendido sem resposta", f.vendidos_sem_resposta],
    ];
  } else if (r === "anuncios") {
    const a = await lerAnuncios(supabase, filtros);
    if (!a) return falhou();
    cabecalho = ["Categoria", "Cidade", "No ar agora", "Publicados no período"];
    linhas = a.map((l) => [l.categoria, l.cidade, l.no_ar, l.publicados]);
  } else if (r === "conversao") {
    const c = await lerConversao(supabase, filtros);
    if (!c) return falhou();
    cabecalho = ["Mês em que começou", "Começaram o teste", "Pagaram um plano", "Ainda em teste", "Acabou sem pagar"];
    linhas = c.map((l) => [nomeMes(l.mes), l.comecaram, l.pagaram, l.em_teste, l.nao_pagaram]);
  } else if (r === "receita") {
    const rc = await lerReceita(supabase, filtros);
    if (!rc) return falhou();
    cabecalho = ["Mês", "Tipo", "Pagamentos", "Total (R$)"];
    linhas = rc.map((l) => [nomeMes(l.mes), NOME_TIPO_RECEITA[l.tipo] ?? l.tipo, l.quantidade, reais(l.total_centavos)]);
  } else {
    const k = await lerCustoAki(supabase, filtros);
    if (!k) return falhou();
    cabecalho = ["Mês", "Respostas", "Conversas", "Respostas com erro", "Custo (R$)"];
    linhas = k.map((l) => [nomeMes(l.mes), l.respostas, l.conversas, l.erros, reais(l.custo_centavos, 4)]);
  }

  const csv = `﻿${[cabecalho, ...linhas].map((l) => l.map(celula).join(";")).join("\r\n")}\r\n`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mercado-da-regiao-relatorio-${r}-${filtros.de}-a-${filtros.ate}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
