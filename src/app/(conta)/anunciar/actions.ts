"use server";
// Server Actions do "Anunciar" (T17–T22). Cada passo salva o rascunho com o cliente do usuário
// (a RLS só deixa mexer no que é dele) e confere os dados antes, para dar a mensagem no campo certo.
// O banco confere tudo de novo (gatilhos de validação, limite do plano e moderação).
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { meuAnuncio } from "@/lib/dados/anuncios";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { categoriaDoAnuncio, categoriaPorId } from "@/lib/dados/categorias";
import { listarCidades } from "@/lib/dados/regiao";
import { lerConfigNumero } from "@/lib/dados/config";
import { avulsoParaMim } from "@/lib/dados/cobranca";
import { asaasConfigurado } from "@/lib/asaas";
import { traduzirErro } from "@/lib/erros";
import { centavosDoTexto, ehUuid } from "@/lib/formato";
import { filtrarAtributos, lerAtributos } from "@/components/anunciar/atributos";
import {
  DESTINO_SAIR,
  STATUS_PUBLICADO,
  proximoPasso,
  urlPasso,
  type EstadoForm,
  type SlugPasso,
} from "@/components/anunciar/passos";
import type { MeuAnuncio, Resultado } from "@/lib/tipos";

const NAO_ACHOU = "Anúncio não encontrado.";
const MAX_FOTOS_BANCO = 12; // check de anuncios.fotos no banco
const MAX_DESCRICAO = 4000; // check de anuncios.descricao no banco
const MAX_BAIRRO = 80;
const MAX_PRECO_CENTAVOS = 100_000_000_000; // R$ 1 bilhão: acima disso é erro de digitação

type Comum = { id: string; editar: boolean; sair: boolean };

function lerComum(form: FormData): Comum {
  return {
    id: String(form.get("id") ?? ""),
    editar: form.get("editar") === "1",
    sair: form.get("acao") === "sair",
  };
}

const publicado = (a: MeuAnuncio) => (STATUS_PUBLICADO as readonly string[]).includes(a.status);

/** Para onde ir depois de salvar: "Salvar e sair" → Meus anúncios; senão → próximo passo. */
function destino(passo: SlugPasso, c: Comum): string {
  if (c.sair) return `${DESTINO_SAIR}?salvo=${encodeURIComponent(c.id)}`;
  const prox = proximoPasso(passo);
  return prox ? urlPasso(prox, c.id, c.editar) : DESTINO_SAIR;
}

async function abrir(id: string): Promise<MeuAnuncio | null> {
  if (!ehUuid(id)) return null;
  const a = await meuAnuncio(id);
  return a && a.status !== "congelado" && a.status !== "excluido" ? a : null;
}

/**
 * Grava as colunas no anúncio. Erro do banco já volta traduzido.
 * Com `antes` (anúncio já publicado): se a moderação do banco segurou o texto da edição,
 * leva para a tela "em análise" em vez de seguir como se nada tivesse acontecido.
 */
async function gravar(id: string, colunas: Record<string, unknown>, antes?: MeuAnuncio, versao?: string): Promise<EstadoForm> {
  const db = await createClient();
  let atualizacao = db.from("anuncios").update(colunas).eq("id", id);
  if (versao) atualizacao = atualizacao.eq("atualizado_em", versao);
  const { data, error } = await atualizacao.select("id, status").maybeSingle();
  if (error) return { erro: traduzirErro(error) };
  if (!data) return { erro: { mensagem: versao ? "O anúncio mudou. Recarregue esta página e confira os dados antes de salvar." : NAO_ACHOU } };
  if (antes && publicado(antes) && antes.status !== "em_analise" && data.status === "em_analise") {
    redirect(`/anunciar/pronto?id=${encodeURIComponent(id)}&status=analise`);
  }
  return null;
}

/* ------------------------------ Começar ------------------------------ */

/**
 * Cria um rascunho novo e abre o passo 1 (botão "Começar um anúncio novo").
 * Com `avulso` (botão "Fazer um anúncio avulso" da tela de limite), cria mesmo no limite do plano,
 * desde que o avulso seja oferecido para a pessoa e o pagamento esteja ligado. O banco segue
 * barrando o excesso de rascunhos e só põe no ar com vaga no plano ou avulso pago.
 */
export async function novoRascunho(opcoes?: { avulso?: boolean; chave?: string }): Promise<EstadoForm> {
  const conta = await meuPerfilEVitrine();
  if (!conta) return { erro: { mensagem: "Entre na sua conta para continuar.", codigo: "28000" } };
  if (!conta.vitrine) redirect("/quero-vender");
  if (conta.vitrine.status === "suspensa") redirect("/anunciar");
  // T16: limite do plano aparece ANTES do passo 1, na tela /anunciar (menos no caminho do avulso)
  if (!conta.podePublicar) {
    const avulso = opcoes?.avulso === true && asaasConfigurado() ? await avulsoParaMim(conta.vitrine) : null;
    if (!avulso) redirect("/anunciar");
  }
  if (opcoes?.chave && !ehUuid(opcoes.chave)) return { erro: { mensagem: "Não foi possível começar. Abra esta página novamente." } };
  const db = await createClient();
  const { data, error } = await db
    .from("anuncios")
    .insert({ ...(opcoes?.chave ? { id: opcoes.chave } : {}), vitrine_id: conta.vitrine.id, status: "rascunho" })
    .select("id")
    .single();
  if (error?.code === "23505" && opcoes?.chave) {
    const existente = await meuAnuncio(opcoes.chave);
    if (existente?.status === "rascunho") redirect(urlPasso("fotos", existente.id));
  }
  if (error || !data) return { erro: traduzirErro(error) };
  redirect(urlPasso("fotos", String(data.id)));
}

/* ------------------------------- Fotos ------------------------------- */

/**
 * Salva a lista de fotos (na ordem; a primeira é a capa). Chamado pelo passo Fotos
 * a cada envio, troca de ordem ou remoção.
 */
export async function salvarFotos(id: string, fotos: string[], fotosAntes?: string[]): Promise<Resultado & { fotosAtuais?: string[] }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: { mensagem: "Entre na sua conta para continuar.", codigo: "28000" } };
  const anuncio = await abrir(id);
  if (!anuncio) return { ok: false, erro: { mensagem: NAO_ACHOU } };

  const conta = await meuPerfilEVitrine();
  if (!conta?.vitrine) return { ok: false, erro: { mensagem: NAO_ACHOU } };
  const regiao = conta.vitrine.microrregiao_id;
  const maximo = Math.min((await lerConfigNumero("anuncio.fotos_maximo", regiao)) ?? MAX_FOTOS_BANCO, MAX_FOTOS_BANCO);
  if (!Array.isArray(fotos) || fotos.length > maximo) {
    return { ok: false, erro: { mensagem: `Use no máximo ${maximo} fotos.`, campo: "fotos" } };
  }
  const prefixo = `/storage/v1/object/public/anuncios/${userId}/`;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origemOlaki = base ? new URL(base) : null;
  const valida = (u: unknown) => {
    if (typeof u !== "string" || u.length > 500 || !origemOlaki) return false;
    try {
      const url = new URL(u);
      const resto = url.pathname.startsWith(prefixo) ? url.pathname.slice(prefixo.length) : "";
      return (
        url.protocol === origemOlaki.protocol &&
        url.host === origemOlaki.host && // só o Storage do OLAKI (o banco confere de novo com fotos.origem)
        !url.search &&
        !url.hash &&
        /^[A-Za-z0-9._/-]+$/.test(resto) &&
        !resto.split("/").some((parte) => parte === "" || parte === "." || parte === "..")
      );
    } catch {
      return false;
    }
  };
  if (!fotos.every(valida) || new Set(fotos).size !== fotos.length) {
    return { ok: false, erro: { mensagem: "Use só fotos enviadas pelo OLAKI.", campo: "fotos" } };
  }
  if (publicado(anuncio) && fotos.length < ((await lerConfigNumero("anuncio.fotos_minimo", regiao)) ?? 0)) {
    return { ok: false, erro: { mensagem: "Anúncio publicado precisa de foto. Coloque outra antes de tirar esta.", campo: "fotos" } };
  }

  const db = await createClient();
  const anteriores = fotosAntes ?? anuncio.fotos;
  if (!Array.isArray(anteriores) || anteriores.length > MAX_FOTOS_BANCO || !anteriores.every((f) => typeof f === "string" && f.length <= 500)) {
    return { ok: false, erro: { mensagem: "Lista de fotos inválida." } };
  }
  // Comparação atômica: outra aba ou o Aki não podem perder fotos por uma lista desatualizada.
  const { data, error } = await db.from("anuncios").update({ fotos }).eq("id", id)
    .filter("fotos", "eq", `{${anteriores.map((f) => JSON.stringify(f)).join(",")}}`).select("id").maybeSingle();
  if (error) return { ok: false, erro: traduzirErro(error) };
  if (data) return { ok: true, dados: undefined };
  const atual = await db.from("anuncios").select("fotos, vitrines_lojas!inner(dono_id)").eq("id", id).eq("vitrines_lojas.dono_id", userId).maybeSingle();
  if (atual.error || !atual.data) return { ok: false, erro: { mensagem: "Não foi possível confirmar as fotos. Tente de novo." } };
  const fotosAtuais = (atual.data.fotos ?? []) as string[];
  // Uma resposta perdida pode ter sido gravada. Repetir a mesma lista é seguro.
  if (JSON.stringify(fotosAtuais) === JSON.stringify(fotos)) return { ok: true, dados: undefined };
  return { ok: false, fotosAtuais, erro: { mensagem: "As fotos mudaram em outra janela ou pelo Aki. A lista salva foi atualizada nesta tela. Confira e tente novamente." } };
}

/* ----------------------------- Categoria ----------------------------- */

export async function salvarCategoria(_antes: EstadoForm, form: FormData): Promise<EstadoForm> {
  const c = lerComum(form);
  const anuncio = await abrir(c.id);
  if (!anuncio) return { erro: { mensagem: NAO_ACHOU } };

  const categoriaId = String(form.get("categoria_id") ?? "");
  if (!categoriaId) {
    if (c.sair && !publicado(anuncio)) redirect(DESTINO_SAIR);
    return { erro: { mensagem: "Escolha a categoria do anúncio.", campo: "categoria" } };
  }
  // anúncio que já esteve no ar (no ar, pausado...) e continua na mesma categoria (mesmo escondida no painel): segue sem mudar nada
  if (categoriaId === anuncio.categoria_id && anuncio.publicado_em) redirect(destino("categoria", c));
  const achada = ehUuid(categoriaId) ? await categoriaPorId(categoriaId) : null;
  if (!achada) return { erro: { mensagem: "Essa categoria não está mais disponível. Escolha outra.", campo: "categoria" } };
  if (!achada.pai) {
    return { erro: { mensagem: `Escolha uma subcategoria de "${achada.categoria.nome}".`, campo: "categoria" } };
  }

  if (categoriaId !== anuncio.categoria_id) {
    const origem = anuncio.categoria_id ? await categoriaDoAnuncio(anuncio.categoria_id) : null;
    if (anuncio.categoria_id && !origem) return { erro: { mensagem: "Não foi possível conferir a categoria atual. Tente novamente." } };
    const r = await gravar(c.id, {
      categoria_id: categoriaId,
      atributos: filtrarAtributos(anuncio.atributos, achada.categoria.campos, origem?.categoria.campos ?? []),
    }, undefined, anuncio.atualizado_em);
    if (r) {
      if (publicado(anuncio) && r.erro?.campo && r.erro.campo !== "categoria") {
        r.erro.mensagem += " Esse anúncio já está publicado: para trocar de categoria, preencha antes os campos novos ou crie outro anúncio.";
      }
      return r;
    }
  }
  redirect(destino("categoria", c));
}

/* ----------------------------- Detalhes ------------------------------ */

export async function salvarDetalhes(_antes: EstadoForm, form: FormData): Promise<EstadoForm> {
  const c = lerComum(form);
  const anuncio = await abrir(c.id);
  if (!anuncio) return { erro: { mensagem: NAO_ACHOU } };
  const categoriaDoForm = form.get("categoria_id");
  if (categoriaDoForm != null && categoriaDoForm !== (anuncio.categoria_id ?? "")) {
    return { erro: { mensagem: "A categoria mudou. Recarregue esta página para ver os campos atuais." } };
  }
  const exigir = !c.sair || publicado(anuncio); // rascunho pode sair incompleto

  const campos: Record<string, string> = {};
  const titulo = String(form.get("titulo") ?? "").replace(/\s+/g, " ").trim();
  if (titulo.length > 90) campos.titulo = "O título pode ter no máximo 90 letras.";
  else if (exigir && titulo.length < 5) campos.titulo = "Escreva um título com pelo menos 5 letras. Ex.: Moto Titan 150 2015.";

  const descricao = String(form.get("descricao") ?? "").replace(/\r\n/g, "\n").trim();
  if (descricao.length > MAX_DESCRICAO) campos.descricao = `A descrição pode ter no máximo ${MAX_DESCRICAO} letras.`;

  // já esteve no ar: usa a categoria dele mesmo se o painel esconder (os campos continuam editáveis)
  const cat = anuncio.categoria_id
    ? await (anuncio.publicado_em ? categoriaDoAnuncio(anuncio.categoria_id) : categoriaPorId(anuncio.categoria_id))
    : null;
  const definicoes = cat?.categoria.campos ?? [];
  const lidos = lerAtributos(definicoes, form, exigir);
  Object.assign(campos, lidos.erros);

  if (Object.keys(campos).length) {
    return { erro: { mensagem: "Confira os campos marcados." }, campos };
  }

  // atributos de fora da categoria (anúncio antigo) são mantidos como estão
  const chaves = new Set(definicoes.map((campo) => campo.chave));
  const extras = Object.fromEntries(Object.entries(anuncio.atributos).filter(([chave]) => !chaves.has(chave)));
  const r = await gravar(
    c.id,
    {
      titulo: titulo || null,
      descricao: descricao || null,
      atributos: { ...extras, ...lidos.atributos },
    },
    anuncio,
    anuncio.atualizado_em,
  );
  if (r) {
    if (r.erro?.campo) r.campos = { [r.erro.campo === "titulo" || r.erro.campo === "descricao" ? r.erro.campo : `attr_${r.erro.campo}`]: r.erro.mensagem };
    return r;
  }
  redirect(destino("detalhes", c));
}

/* ------------------------------- Preço ------------------------------- */

export async function salvarPreco(_antes: EstadoForm, form: FormData): Promise<EstadoForm> {
  const c = lerComum(form);
  const anuncio = await abrir(c.id);
  if (!anuncio) return { erro: { mensagem: NAO_ACHOU } };

  const aCombinar = form.get("a_combinar") === "on";
  const exigir = !c.sair || publicado(anuncio); // anúncio no ar não fica sem preço por engano
  const aceitaTroca = form.get("aceita_troca") === "on";
  const texto = String(form.get("preco") ?? "").trim();
  let centavos: number | null = null;

  if (!aCombinar) {
    centavos = centavosDoTexto(texto);
    if (texto && centavos === null) return { erro: { mensagem: "Use um preço como 1.500,50, com no máximo duas casas decimais." }, campos: { preco: "Ex.: 1.500,50. Use no máximo duas casas decimais." } };
    if (centavos !== null && centavos > MAX_PRECO_CENTAVOS) return { erro: { mensagem: "Esse preço está alto demais. Confira." }, campos: { preco: "Confira o valor." } };
    if (centavos === 0) return { erro: { mensagem: "O preço não pode ser zero. Marque \"A combinar\" se preferir." }, campos: { preco: "O preço não pode ser zero." } };
    if (centavos === null && exigir) {
      return { erro: { mensagem: "Coloque o preço ou marque \"A combinar\"." }, campos: { preco: "Coloque o preço ou marque \"A combinar\"." } };
    }
  }

  const r = await gravar(c.id, { preco_centavos: centavos, aceita_troca: aceitaTroca }, anuncio);
  if (r) return r;
  redirect(destino("preco", c));
}

/* ------------------------------- Local ------------------------------- */

export async function salvarLocal(_antes: EstadoForm, form: FormData): Promise<EstadoForm> {
  const c = lerComum(form);
  const anuncio = await abrir(c.id);
  if (!anuncio) return { erro: { mensagem: NAO_ACHOU } };
  const conta = await meuPerfilEVitrine();
  if (!conta?.vitrine) return { erro: { mensagem: "Entre na sua conta para continuar.", codigo: "28000" } };

  const cidade = String(form.get("cidade") ?? "").trim();
  const bairro = String(form.get("bairro") ?? "").replace(/\s+/g, " ").trim();
  const exigir = !c.sair || publicado(anuncio);

  if (!cidade && exigir) return { erro: { mensagem: "Escolha a cidade." }, campos: { cidade: "Escolha a cidade." } };
  if (cidade) {
    const cidades = await listarCidades(conta.vitrine.microrregiao_id);
    if (!cidades.length) return { erro: { mensagem: "Não foi possível carregar as cidades desta região. Tente de novo." }, campos: { cidade: "As cidades estão indisponíveis." } };
    if (!cidades.some((x) => x.nome === cidade)) {
      return { erro: { mensagem: "Escolha uma cidade da lista." }, campos: { cidade: "Escolha uma cidade da lista." } };
    }
  }
  if (bairro.length > MAX_BAIRRO) return { erro: { mensagem: "Bairro muito comprido." }, campos: { bairro: `Use no máximo ${MAX_BAIRRO} letras.` } };

  const r = await gravar(c.id, { cidade: cidade || null, bairro: bairro || null });
  if (r) return r;
  redirect(destino("local", c));
}

/* ------------------------------ Publicar ----------------------------- */

export async function publicarAnuncio(_antes: EstadoForm, form: FormData): Promise<EstadoForm> {
  const c = lerComum(form);
  const anuncio = await abrir(c.id);
  if (!anuncio) return { erro: { mensagem: NAO_ACHOU } };

  if (publicado(anuncio)) {
    // já está no ar: cada passo já salvou as mudanças
    redirect(`${DESTINO_SAIR}?salvo=${encodeURIComponent(anuncio.id)}`);
  }

  const db = await createClient();
  const { data, error } = await db.rpc("publicar_anuncio", { anuncio_id: c.id });
  if (error) return { erro: traduzirErro(error) };
  const status = typeof data === "string" ? data : "";
  if (status === "em_analise") redirect(`/anunciar/pronto?id=${encodeURIComponent(c.id)}&status=analise`);
  if (status === "ativo") redirect(`/anunciar/pronto?id=${encodeURIComponent(c.id)}`);
  return { erro: traduzirErro(null) };
}
