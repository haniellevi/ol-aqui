import { enderecoBate, nomesBatem } from "./nomes";
import type { Contexto, Decisao, MotivoEquipe, ParecerItem } from "./tipos";

const CONFIANCA_MINIMA = 0.8;

function enc(decisao: Decisao["decisao"], motivo: Decisao["motivo"], motivosEquipe: MotivoEquipe[], parecer: ParecerItem[]): Decisao {
  return { decisao, motivo, motivosEquipe, parecer };
}

// Regras fixas que DECIDEM a verificação. A IA só extrai dados; nada lido de documento vira ordem.
// Só o que for 100% claro aprova; qualquer dúvida vai para a equipe. O parecer nunca leva dados do documento.
export function decidir(ctx: Contexto): Decisao {
  const { receita, comprovante, cadastro } = ctx;
  if (receita.estado === "fora_do_ar") return enc("equipe", null, ["receita_fora_do_ar"], [{ item: "receita", ok: null, nota: "fora do ar" }]);
  if (receita.estado === "nao_encontrada") return enc("pedir_novo", "cnpj_nao_encontrado", [], [{ item: "receita", ok: false, nota: "CNPJ não encontrado" }]);
  const r = receita.dados;
  if (r.situacao.trim().toUpperCase() !== "ATIVA") {
    return enc("recusar", "cnpj_inativo", [], [{ item: "receita", ok: true }, { item: "situacao_cnpj", ok: false, nota: "CNPJ não está ativo" }]);
  }
  const base: ParecerItem[] = [{ item: "receita", ok: true }, { item: "situacao_cnpj", ok: true }];
  if (ctx.pdfSemTexto || comprovante?.legivel === false) {
    return enc("pedir_novo", "arquivo_ilegivel", [], [...base, { item: "comprovante", ok: false, nota: "arquivo ilegível" }]);
  }
  if (comprovante?.tipoDocumento === "nao_e_comprovante") {
    return enc("pedir_novo", "comprovante_invalido", [], [...base, { item: "comprovante", ok: false, nota: "não é um comprovante" }]);
  }
  if (comprovante === null) return enc("equipe", null, ["ia_falhou"], [...base, { item: "comprovante", ok: null, nota: "leitura falhou" }]);

  const motivos: MotivoEquipe[] = [];
  const parecer: ParecerItem[] = [...base];
  const add = (m: MotivoEquipe) => { if (!motivos.includes(m)) motivos.push(m); };

  const duvida = !(comprovante.confianca >= CONFIANCA_MINIMA) || comprovante.tipoDocumento === "outro"
    || comprovante.titular === null || comprovante.cidade === null;
  if (duvida) add("ia_duvida");
  parecer.push({ item: "leitura", ok: !duvida, ...(duvida ? { nota: "leitura com dúvida" } : {}) });

  if (comprovante.titular === null) parecer.push({ item: "titular", ok: null, nota: "não lido" });
  else {
    const candidatos = [r.razaoSocial, r.fantasia ?? "", ...r.socios].filter((n) => n.trim() !== "");
    const bate = candidatos.some((n) => nomesBatem(comprovante.titular as string, n));
    if (!bate) add("nome_diferente");
    parecer.push({ item: "titular", ok: bate, ...(bate ? {} : { nota: "nome diferente" }) });
  }

  if (comprovante.cidade === null) parecer.push({ item: "endereco", ok: null, nota: "cidade não lida" });
  else {
    const bate = enderecoBate(comprovante, cadastro);
    if (!bate) add("endereco_diferente");
    parecer.push({ item: "endereco", ok: bate, ...(bate ? {} : { nota: "endereço diferente" }) });
  }

  if (ctx.cnpjEmOutraLoja) add("cnpj_duplicado");
  parecer.push({ item: "cnpj_unico", ok: !ctx.cnpjEmOutraLoja, ...(ctx.cnpjEmOutraLoja ? { nota: "CNPJ já usado em outra loja" } : {}) });

  if (ctx.cidadeNaRegiao === false) add("cidade_fora_da_regiao");
  parecer.push({ item: "regiao", ok: ctx.cidadeNaRegiao, ...(ctx.cidadeNaRegiao === false ? { nota: "cidade fora da região" } : {}) });

  const f = ctx.fachada;
  if (f && f.legivel) {
    const nomes = [cadastro.nome, r.fantasia ?? ""].filter((n) => n.trim() !== "");
    const nomeRuim = f.nomeVisivel !== null && !nomes.some((n) => nomesBatem(f.nomeVisivel as string, n));
    const estranha = !f.fachadaReal || nomeRuim;
    if (estranha) add("fachada_estranha");
    parecer.push({ item: "fachada", ok: !estranha, ...(estranha ? { nota: "fachada estranha" } : {}) });
  } else parecer.push({ item: "fachada", ok: null, nota: "não avaliada" });

  return motivos.length ? enc("equipe", null, motivos, parecer) : enc("aprovar", null, [], parecer);
}
