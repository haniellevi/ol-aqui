import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerConfigNumero } from "@/lib/dados/config";
import { EMAIL, idsPeloEmail } from "@/lib/dados/equipe";
import { traduzirErro } from "@/lib/erros";
import type { DadosCompliance, RelatorioCompliance, ResultadoCompliance } from "@/lib/tipos-equipe";

// Tela 8 · Compliance jurídico. Tudo com o token do administrador e só por funções do banco
// (compliance_*), que conferem e_admin(), a consulta aberta com motivo e gravam cada acesso.
// Nada aqui usa a chave secreta: quem não é administrador não lê nada.

type Resposta<T> = { ok: true; dados: T } | { ok: false; erro: string };

const falha = (e: { code?: string; message?: string; details?: string | null } | null): { ok: false; erro: string } => ({
  ok: false,
  erro: traduzirErro(e).mensagem,
});

export type Consulta = { id: string; motivo: string; criado_em: string; vence_em: string };

/** A consulta aberta (só a do próprio administrador e dentro da validade). */
export async function lerConsulta(supabase: SupabaseClient, id: string, userId: string): Promise<Consulta | null> {
  // mesma regra do banco (compliance_minutos): inteiro de 1 a 1440, padrão 60
  const lido = (await lerConfigNumero("compliance.consulta_minutos")) ?? 60;
  const minutos = Math.min(Math.max(Number.isFinite(lido) ? Math.floor(lido) : 60, 1), 1440);
  const { data } = await supabase
    .from("compliance_acessos")
    .select("id, motivo, criado_em, admin_id, tipo")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.tipo !== "abrir" || data.admin_id !== userId || !data.motivo) return null;
  const vence = new Date(new Date(data.criado_em).getTime() + minutos * 60_000);
  if (vence.getTime() <= Date.now()) return null;
  return { id: data.id, motivo: data.motivo, criado_em: data.criado_em, vence_em: vence.toISOString() };
}

/** Grava que a tela foi aberta (antes de mostrar qualquer dado). */
export async function registrarEntrada(supabase: SupabaseClient, ip: string | null): Promise<boolean> {
  const { error } = await supabase.rpc("compliance_entrar", { p_ip: ip });
  return !error;
}

export async function buscarCompliance(
  supabase: SupabaseClient,
  consulta: string,
  busca: string,
  ip: string | null,
): Promise<Resposta<ResultadoCompliance[]>> {
  // E-mail: fica no Clerk. O servidor acha os ids lá e o banco busca só por eles (e grava o e-mail buscado).
  let ids: string[] | null = null;
  if (EMAIL.test(busca.trim())) {
    ids = await idsPeloEmail(busca.trim().toLowerCase());
    if (ids === null) return { ok: false, erro: "A busca por e-mail não está funcionando agora. Tente pelo celular ou pelo nome." };
  }
  const { data, error } = await supabase.rpc("compliance_buscar", { p_consulta: consulta, p_busca: busca, p_ip: ip, p_ids: ids });
  if (error) return falha(error);
  return { ok: true, dados: (data ?? []) as ResultadoCompliance[] };
}

export async function dadosDaConta(
  supabase: SupabaseClient,
  consulta: string,
  usuario: string,
  ip: string | null,
): Promise<Resposta<DadosCompliance>> {
  const { data, error } = await supabase.rpc("compliance_conta", { p_consulta: consulta, p_usuario: usuario, p_ip: ip });
  if (error || !data) return falha(error);
  return { ok: true, dados: data as DadosCompliance };
}

export async function lerRelatorio(supabase: SupabaseClient, relatorio: string, ip: string | null): Promise<Resposta<RelatorioCompliance>> {
  const { data, error } = await supabase.rpc("compliance_relatorio", { p_relatorio: relatorio, p_ip: ip });
  if (error || !data) return falha(error);
  return { ok: true, dados: data as RelatorioCompliance };
}
