import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { ehPapel, podeVerTela } from "@/lib/tipos-equipe";
import { NOME_AMBIENTE, NOME_STATUS, NOME_TIPO, lerFiltros, listarTodosPagamentos } from "@/lib/admin/pagamentos";

// Tela 6 · Exportar CSV dos pagamentos com os mesmos filtros da tela. Só administrador e financeiro:
// confere o papel com o token da pessoa (e a RLS de pagamentos também barra). Os outros recebem 404.
// ";" e BOM para abrir certo no Excel em português; célula que começa com = + - @ vira texto.

export const dynamic = "force-dynamic";

const LIMITE = 10_000;

const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza" });
const quando = (iso: string | null) => (iso ? dataHora.format(new Date(iso)) : "");
const valor = (centavos: number) => (centavos / 100).toFixed(2).replace(".", ",");

/** Uma célula segura: entre aspas, aspas dobradas e sem virar fórmula na planilha. */
function celula(v: string | number | null | undefined): string {
  let t = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return `"${t.replace(/"/g, '""')}"`;
}

const naoAchou = () => new Response("Página não encontrada", { status: 404 });

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return naoAchou();
  const supabase = await createClient();
  const { data: papel } = await supabase.rpc("meu_papel");
  if (!ehPapel(papel) || !podeVerTela(papel, "pagamentos")) return naoAchou();

  const filtros = lerFiltros(new URL(req.url).searchParams);
  let linhas;
  let cortado = false;
  try {
    ({ linhas, cortado } = await listarTodosPagamentos(supabase, filtros, LIMITE));
  } catch {
    return new Response("Não deu para ler os pagamentos agora. Tente de novo.", { status: 503 });
  }
  const [{ data: regioes }, { data: planos }] = await Promise.all([
    supabase.from("microrregioes").select("id, nome"),
    supabase.from("planos").select("codigo, nome"),
  ]);
  const nomeRegiao = new Map(((regioes ?? []) as { id: string; nome: string }[]).map((r) => [r.id, r.nome]));
  const nomePlano = new Map(((planos ?? []) as { codigo: string; nome: string }[]).map((p) => [p.codigo, p.nome]));

  const cabecalho = [
    "Pedido em",
    "Pago em",
    "Vencimento",
    "Ambiente",
    "Tipo",
    "Situação",
    "Valor (R$)",
    "Forma",
    "Loja",
    "Plano",
    "Períodos",
    "Anúncio",
    "Região",
    "Cobrança no Asaas",
    "Link da fatura",
    "Devolver",
    "Nota",
  ];
  const corpo = linhas.map((p) =>
    [
      quando(p.criado_em),
      quando(p.pago_em),
      p.vencimento ? p.vencimento.split("-").reverse().join("/") : "",
      NOME_AMBIENTE[p.ambiente],
      NOME_TIPO[p.tipo] ?? p.tipo,
      NOME_STATUS[p.status] ?? p.status,
      valor(p.valor_centavos),
      p.forma === "pix" ? "Pix" : p.forma === "cartao" ? "Cartão" : p.forma === "boleto" ? "Boleto" : "",
      p.vitrine_nome,
      p.plano_codigo ? nomePlano.get(p.plano_codigo) ?? p.plano_codigo : "",
      p.meses,
      p.anuncio_titulo,
      nomeRegiao.get(p.microrregiao_id) ?? "",
      p.asaas_cobranca_id,
      p.link_pagamento,
      p.status === "pago" ? p.devolver_motivo : "",
      p.observacao,
    ]
      .map(celula)
      .join(";"),
  );
  // Passou do máximo: a última linha avisa, para ninguém achar que o arquivo está completo.
  const aviso = cortado
    ? [celula(`Atenção: este arquivo tem só os ${LIMITE.toLocaleString("pt-BR")} pagamentos mais novos. Use as datas para baixar o resto.`)]
    : [];
  const csv = `﻿${[cabecalho.map(celula).join(";"), ...corpo, ...aviso].join("\r\n")}\r\n`;
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mercado-da-regiao-pagamentos-${hoje}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
