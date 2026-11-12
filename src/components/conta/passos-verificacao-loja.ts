// Regras puras do assistente "Verificar minha loja" (servem no navegador e nos testes).
import { cnpjValido, mascaraDocumento, soDigitos } from "@/lib/cpf-cnpj";
import { API_VERIFICACAO_LOJA, MAX_ARQUIVO_VERIFICACAO_LOJA } from "@/lib/verificacao-loja/constantes";

export type NumeroPasso = 1 | 2 | 3 | 4;
export const TOTAL_PASSOS = 4;
export const NOMES_PASSOS = ["CNPJ", "Comprovante", "Fachada", "Conferir"] as const;

export const PERGUNTAS: Record<NumeroPasso, string> = {
  1: "Qual é o CNPJ da loja?",
  2: "Mande um comprovante de endereço",
  3: "Quer mandar uma foto da frente da loja?",
  4: "Confira e envie",
};

export const AVISO_IA = "Uma inteligência artificial confere os seus documentos. Eles não ficam guardados: são apagados quando a conferência termina (no máximo em 7 dias, se a equipe precisar rever).";
export const ACEITA_ARQUIVO = "application/pdf,image/jpeg,image/png";
const TIPOS = ["application/pdf", "image/jpeg", "image/png"];

/** O que o assistente precisa saber do arquivo (um `File` do navegador serve). */
export type ArquivoEscolhido = { name: string; size: number; type: string };
export type DadosVerificacaoLoja = {
  cnpj: string;
  comprovante?: ArquivoEscolhido | null;
  fachada?: ArquivoEscolhido | null;
};

const ERRO_TIPO = "Envie o arquivo em PDF, JPG ou PNG.";
const ERRO_TAMANHO = "Cada arquivo pode ter até 2 MB.";

/** Mensagem do arquivo escolhido (tipo e tamanho), ou null se está bom. */
export function erroArquivo(a: ArquivoEscolhido): string | null {
  if (!TIPOS.includes(a.type)) return ERRO_TIPO;
  if (a.size < 1 || a.size > MAX_ARQUIVO_VERIFICACAO_LOJA) return ERRO_TAMANHO;
  return null;
}

/** Mesmas frases da rota de envio, para a pessoa ler igual no celular e no servidor. */
export function erroCnpj(texto: string): string | null {
  const d = soDigitos(texto);
  if (d.length === 11) return "Esse número é de CPF. O selo de loja pede CNPJ.";
  return cnpjValido(d) ? null : "Confira o número do CNPJ.";
}

/** Confere só o que o passo pergunta. Passo 4 confere tudo de novo antes de enviar. */
export function erroDoPasso(passo: NumeroPasso, d: DadosVerificacaoLoja): string | null {
  if (passo === 1) return erroCnpj(d.cnpj);
  if (passo === 2) {
    if (!d.comprovante) return "Escolha o comprovante de endereço para continuar.";
    return erroArquivo(d.comprovante);
  }
  if (passo === 3) return d.fachada ? erroArquivo(d.fachada) : null;
  return erroDoPasso(1, d) ?? erroDoPasso(2, d) ?? erroDoPasso(3, d);
}

export function podeAvancar(passo: NumeroPasso, d: DadosVerificacaoLoja): boolean {
  return erroDoPasso(passo, d) === null;
}

export type LinhaResumo = { rotulo: string; valor: string; passo: NumeroPasso };

/** Linhas do passo 4. Cada uma diz de qual passo vem (para o botão "Alterar"). */
export function resumo(d: DadosVerificacaoLoja): LinhaResumo[] {
  return [
    { rotulo: "CNPJ", valor: mascaraDocumento(d.cnpj), passo: 1 },
    { rotulo: "Comprovante de endereço", valor: d.comprovante?.name ?? "Não enviado", passo: 2 },
    { rotulo: "Foto da frente da loja", valor: d.fachada?.name ?? "Não enviada", passo: 3 },
  ];
}

/** Tempo em que "Enviar" ignora o toque depois de chegar ao passo 4 (o toque duplo em "Continuar" não envia). */
export const ESPERA_ENVIAR_MS = 600;

/** true = pode enviar: já passou a espera desde que o passo 4 apareceu. */
export function podeEnviar(chegouNoPasso4Em: number | null, agora: number, espera = ESPERA_ENVIAR_MS): boolean {
  return chegouNoPasso4Em !== null && agora - chegouNoPasso4Em >= espera;
}

/** Trava de toque duplo: `pegar()` só dá certo uma vez até alguém chamar `soltar()`. */
export function criarTrava() {
  let ocupada = false;
  return {
    pegar(): boolean {
      if (ocupada) return false;
      ocupada = true;
      return true;
    },
    soltar() { ocupada = false; },
  };
}

export type ResultadoEnvio =
  | { tipo: "ok"; mensagem: string }
  | { tipo: "erro"; mensagem: string; atualizar: boolean }
  | { tipo: "ignorado" };

type Resposta = { ok: boolean; status: number; json: () => Promise<unknown> };
export type Buscar = (url: string, init: { method: string; body: FormData }) => Promise<Resposta>;

/** Envia os documentos. Se já tem um envio em andamento (mesma trava), não faz nada e devolve "ignorado". */
export async function enviarVerificacaoLoja(
  d: DadosVerificacaoLoja,
  trava: { pegar(): boolean; soltar(): void },
  buscar: Buscar = (url, init) => fetch(url, init),
): Promise<ResultadoEnvio> {
  if (!trava.pegar()) return { tipo: "ignorado" };
  try {
    const corpo = new FormData();
    corpo.set("cnpj", soDigitos(d.cnpj));
    if (d.comprovante) corpo.set("comprovante", d.comprovante as unknown as Blob);
    if (d.fachada) corpo.set("fachada", d.fachada as unknown as Blob);
    const res = await buscar(API_VERIFICACAO_LOJA, { method: "POST", body: corpo });
    const retorno = (await res.json().catch(() => null)) as { ok?: boolean; mensagem?: string } | null;
    if (!res.ok || !retorno?.ok) {
      return {
        tipo: "erro",
        mensagem: retorno?.mensagem ?? "Não foi possível enviar. Confira o tamanho dos arquivos e tente novamente.",
        atualizar: res.status === 409,
      };
    }
    return { tipo: "ok", mensagem: retorno.mensagem ?? "Documentos enviados para conferência." };
  } catch {
    return {
      tipo: "erro",
      mensagem: "Não conseguimos confirmar o envio. Atualize a página para consultar a situação antes de tentar novamente.",
      atualizar: false,
    };
  } finally {
    trava.soltar();
  }
}
