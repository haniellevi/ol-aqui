import "server-only";
import type { Receita, ReceitaResultado } from "./tipos";

// Consulta pública da BrasilAPI (nomes de campos confirmados em docs/designs/verificacao-lojas-spike.md).
// Qualquer falha de rede, limite ou resposta estranha vira "fora_do_ar": nunca reprova a loja por culpa da consulta.
const TAMANHO_MAXIMO = 100_000;

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function mapear(b: Record<string, unknown>): Receita {
  const tipo = texto(b.descricao_tipo_de_logradouro);
  const rua = texto(b.logradouro);
  const socios = Array.isArray(b.qsa)
    ? b.qsa.map(s => (s && typeof s === "object" ? texto((s as Record<string, unknown>).nome_socio) : "")).filter(Boolean)
    : [];
  const ibge = b.codigo_municipio_ibge;
  return {
    situacao: texto(b.descricao_situacao_cadastral),
    razaoSocial: texto(b.razao_social),
    fantasia: texto(b.nome_fantasia) || null,
    socios,
    municipioIbge: typeof ibge === "number" && Number.isFinite(ibge) && ibge > 0 ? ibge : null,
    cidade: texto(b.municipio),
    uf: texto(b.uf),
    logradouro: rua ? [tipo, rua].filter(Boolean).join(" ") : null,
    abertura: texto(b.data_inicio_atividade) || null,
  };
}

export async function consultarCnpj(cnpj: string): Promise<ReceitaResultado> {
  const digitos = String(cnpj ?? "").replace(/\D/g, "");
  if (digitos.length !== 14) return { estado: "nao_encontrada" };
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`, {
      signal: AbortSignal.timeout(8_000), cache: "no-store", redirect: "error",
    });
    if (r.status === 404 || r.status === 400) return { estado: "nao_encontrada" };
    if (!r.ok) return { estado: "fora_do_ar" };
    const corpo = await r.text();
    if (corpo.length > TAMANHO_MAXIMO) return { estado: "fora_do_ar" };
    const json: unknown = JSON.parse(corpo);
    if (!json || typeof json !== "object" || Array.isArray(json)) return { estado: "fora_do_ar" };
    return { estado: "ok", dados: mapear(json as Record<string, unknown>) };
  } catch {
    return { estado: "fora_do_ar" };
  }
}
