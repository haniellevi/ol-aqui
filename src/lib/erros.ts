import type { ErroTela } from "@/lib/tipos";

// Converte erros do Supabase/Postgres em texto para a pessoa (sem detalhe técnico).
// O banco já manda mensagem em português nos códigos de validação; nos outros usamos frases fixas.

type ErroBanco = { code?: string; message?: string; details?: string | null } | null | undefined;

const PADRAO = "Algo deu errado. Tente de novo.";

/** Códigos cuja mensagem do banco já está pronta para mostrar. */
const MENSAGEM_DO_BANCO = new Set(["23514", "23505", "22023", "P0001", "42501"]);

export function traduzirErro(e: ErroBanco): ErroTela {
  if (!e) return { mensagem: PADRAO };
  const codigo = e.code;
  const campo = e.details?.startsWith("campo:") ? e.details.slice(6) : undefined;
  if (codigo === "28000") return { mensagem: "Entre na sua conta para continuar.", codigo };
  if (codigo && MENSAGEM_DO_BANCO.has(codigo) && e.message && !/violates|permission denied|row-level/i.test(e.message)) {
    return { mensagem: e.message, campo, codigo };
  }
  if (codigo === "23505") return { mensagem: "Isso já existe. Escolha outro.", campo, codigo };
  if (codigo === "42501") return { mensagem: "Você não tem permissão para isso.", codigo };
  return { mensagem: PADRAO, codigo };
}
