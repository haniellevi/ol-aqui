import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Db = ReturnType<typeof supabaseAdmin>;
const BUCKET = "anuncios";
const LOTE = 1000;

function ok(r: { error: { message: string } | null }) {
  if (r.error) throw new Error(r.error.message);
}

/** Conta na lixeira (30 dias)? O site fecha o acesso e mostra /conta-em-exclusao. */
export async function contaEmExclusao(id: string) {
  const { data, error } = await supabaseAdmin().from("lixeira_contas").select("usuario_id").eq("usuario_id", id).maybeSingle();
  if (error) throw new Error("Não foi possível conferir a conta.");
  return Boolean(data);
}

/**
 * LGPD: conta apagada no Clerk. Remove o perfil e os arquivos. Se houver pagamentos (guarda
 * fiscal) ou conteúdo congelado (prova), anonimiza: guarda só isso e apaga o resto.
 * Idempotente: o webhook e a limpeza diária podem chamar mais de uma vez.
 */
export async function apagarConta(id: string) {
  const db = supabaseAdmin();

  // A conta já não existe no Clerk. Revoga também JWT emitido antes da exclusão,
  // sem depender de manter o perfil e sem renovar a data quando o evento se repete.
  ok(await db.rpc("revogar_conta_definitivamente", { p_id: id }));
  // A pasta entra na fila antes de apagar o perfil: se o Storage falhar, a limpeza tenta de novo.
  if (/^[A-Za-z0-9_]+$/.test(id)) {
    ok(await db.from("limpeza_arquivos").upsert({ pasta: id }, { onConflict: "pasta", ignoreDuplicates: true }));
  }

  const apagou = await db.from("perfis").delete().eq("id", id);
  if (!apagou.error) {
    // O banco já confirmou a cascata. Se o Storage falhar, a pasta continua na fila.
    await apagarPasta(db, id);
    return;
  }

  // Só as retenções conhecidas permitem manter o perfil: cobrança (FK de pagamentos) ou
  // conteúdo congelado (gatilho 55000). Outros erros precisam de nova tentativa e investigação.
  const retencao =
    (apagou.error.code === "23503" && apagou.error.message.includes('"pagamentos_vitrine_id_fkey"')) ||
    apagou.error.code === "55000";
  if (!retencao) throw new Error(apagou.error.message);

  const vitrines = await db.from("vitrines_lojas").select("id").eq("dono_id", id);
  ok(vitrines);
  const ids = (vitrines.data ?? []).map((v) => v.id as string);
  // Os congelados e o que está ligado a eles ficam (o banco também recusa apagá-los).
  const pedidosCongelados = await db.from("radar_pedidos").select("id").eq("status", "congelado");
  ok(pedidosCongelados);
  const congelados = (pedidosCongelados.data ?? []).map((p) => p.id as string);
  if (ids.length) {
    // Anúncio citado numa proposta de pedido congelado também é prova.
    let presos: string[] = [];
    if (congelados.length) {
      const ligados = await db.from("radar_propostas").select("anuncio_id").in("pedido_id", congelados).not("anuncio_id", "is", null);
      ok(ligados);
      presos = [...new Set((ligados.data ?? []).map((p) => p.anuncio_id as string))];
    }
    let anuncios = db.from("anuncios").delete().in("vitrine_id", ids)
      .neq("status", "congelado").is("congelado_motivo", null)
      .or("status_antes_exclusao.is.null,status_antes_exclusao.neq.congelado");
    if (presos.length) anuncios = anuncios.not("id", "in", `(${presos.join(",")})`);
    ok(await anuncios);
    let propostas = db.from("radar_propostas").delete().in("vitrine_id", ids);
    if (congelados.length) propostas = propostas.not("pedido_id", "in", `(${congelados.join(",")})`);
    ok(await propostas);
    for (const vitrineId of ids) {
      // Nome e endereço de anonimização precisam entrar juntos. A URL antiga pode conter dados pessoais.
      ok(
        await db
          .from("vitrines_lojas")
          .update({
            status: "suspensa",
            nome: "Loja encerrada",
            slug: `encerrada-${vitrineId}`,
            cidade: "Conta excluída",
            bairro: null,
            criado_ip: null,
            selo_loja_verificada: false,
            descricao: null,
            whatsapp: null,
            cnpj: null,
            logo_url: null,
            capa_url: null,
            sobre: null,
            endereco: null,
            lat: null,
            lng: null,
            instagram: null,
            site_url: null,
            telefone_publico: null,
            entrega_obs: null,
            horarios: null,
            formas_pagamento: [],
            faz_entrega: null,
            banner_tipo: "modelo",
            banner_url: null,
            banner_moderado_url: null,
            banner_moderado_motivo: null,
            banner_moderado_em: null,
          })
          .eq("id", vitrineId),
      );
    }
    ok(await db.from("loja_secoes").delete().in("vitrine_id", ids));
    ok(await db.from("lixeira_lojas").delete().in("vitrine_id", ids));
  }
  ok(await db.from("radar_pedidos").delete().eq("comprador_id", id).neq("status", "congelado"));
  ok(await db.from("robo_conversas").delete().eq("usuario_id", id));
  ok(await db.from("robo_avaliacoes").delete().eq("usuario_id", id));
  // Livro-caixa sem o vínculo da conta, como ocorreria no ON DELETE SET NULL do perfil.
  ok(await db.from("robo_uso").update({ usuario_id: null }).eq("usuario_id", id));
  ok(await db.from("preferencias_avisos").delete().eq("usuario_id", id));
  ok(await db.from("equipe").delete().eq("usuario_id", id));
  ok(await db.from("perfis_verificacoes").delete().eq("perfil_id", id));
  ok(await db.from("verificacoes_vendedor_pf").delete().eq("perfil_id", id));
  ok(await db.from("whatsapp_desafios").delete().eq("usuario_id", id));
  ok(await db.from("favoritos").delete().eq("usuario_id", id));
  ok(await db.from("notificacoes").delete().eq("usuario_id", id));
  ok(await db.from("lixeira_contas").delete().eq("usuario_id", id));
  ok(
    await db
      .from("perfis")
      .update({ nome: "Conta excluída", whatsapp: null, whatsapp_verificado_em: null, whatsapp_origem: "clerk", avatar_url: null, cidade: null, bairro: null, criado_ip: null, selo_negociador_certificado: false, e_admin: false })
      .eq("id", id),
  );
  // As fotos das provas ficam: só sai o que nenhum registro usa mais.
  await apagarPasta(db, id);
}

/** Apaga a pasta da pessoa (só o que ninguém usa mais) e tira da fila. */
async function apagarPasta(db: Db, id: string) {
  await apagarArquivos(db, id, true);
  ok(await db.from("limpeza_arquivos").delete().eq("pasta", id));
}

/**
 * Esvazia a fila de arquivos do Storage (fotos de anúncios e lojas apagados e pastas de
 * contas apagadas). O que falhar fica na fila para a próxima limpeza.
 */
export async function limparFilaArquivos(db: Db) {
  let removidos = 0;
  const fila = await db.from("limpeza_arquivos").select("id, url, pasta").order("id").limit(LOTE);
  ok(fila);
  const itens = (fila.data ?? []) as { id: number; url: string | null; pasta: string | null }[];
  const urls = itens.filter((i) => i.url);
  if (urls.length) {
    // Confere de novo: a URL pode ter voltado a ser usada.
    const livres = await db.rpc("urls_sem_uso", { p_urls: urls.map((i) => i.url) });
    ok(livres);
    await removerUrls(db, (livres.data as string[] | null) ?? []);
    ok(await db.from("limpeza_arquivos").delete().in("id", urls.map((i) => i.id)));
    removidos += urls.length;
  }
  for (const item of itens.filter((i) => i.pasta)) {
    try {
      await apagarPasta(db, item.pasta!);
      removidos++;
    } catch (e) {
      console.error("limpeza pasta", item.pasta, e);
    }
  }
  return removidos;
}

/** Apaga os arquivos da pasta <id>/ do bucket. Com `soSemUso`, mantém os que ainda são usados. */
export async function apagarArquivos(db: Db, id: string, soSemUso = false) {
  if (!/^[A-Za-z0-9_]+$/.test(id)) return; // id do Clerk (user_...): nunca apaga fora da pasta da pessoa
  const bucket = db.storage.from(BUCKET);
  const pastas = [id];
  let arquivos: string[] = [];
  while (pastas.length) {
    const pasta = pastas.pop()!;
    for (let inicio = 0; ; inicio += LOTE) {
      const { data, error } = await bucket.list(pasta, { limit: LOTE, offset: inicio });
      if (error) throw new Error(error.message);
      for (const item of data ?? []) {
        const caminho = `${pasta}/${item.name}`;
        if (item.id) arquivos.push(caminho);
        else pastas.push(caminho); // sem id = subpasta
      }
      if ((data?.length ?? 0) < LOTE) break;
    }
  }
  if (soSemUso && arquivos.length) {
    const urls = arquivos.map((c) => bucket.getPublicUrl(c).data.publicUrl);
    const livres = await db.rpc("urls_sem_uso", { p_urls: urls });
    ok(livres);
    const sobra = new Set((livres.data as string[] | null) ?? []);
    arquivos = arquivos.filter((_, i) => sobra.has(urls[i]));
  }
  await removerCaminhos(db, arquivos);
}

/** Apaga do Storage as URLs públicas devolvidas pelo banco (já conferidas como sem uso). */
export async function removerUrls(db: Db, urls: string[]) {
  const marca = `/storage/v1/object/public/${BUCKET}/`;
  const caminhos = urls
    .map((u) => (u.includes(marca) ? u.slice(u.indexOf(marca) + marca.length) : null))
    .filter((c): c is string => !!c && /^[A-Za-z0-9._/-]+$/.test(c) && !c.includes(".."));
  await removerCaminhos(db, caminhos);
}

async function removerCaminhos(db: Db, caminhos: string[]) {
  const bucket = db.storage.from(BUCKET);
  for (let i = 0; i < caminhos.length; i += LOTE) {
    const { error } = await bucket.remove(caminhos.slice(i, i + LOTE));
    if (error) throw new Error(error.message);
  }
}
