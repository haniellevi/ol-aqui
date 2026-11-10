import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { SITE } from "@/lib/formato";

// Todas as consultas usam a sessão da pessoa e respeitam RLS, inclusive para administradores.
export const dynamic = "force-dynamic";

const COLUNAS_VITRINE =
  "id, tipo, slug, nome, descricao, logo_url, capa_url, cidade, bairro, plano, status, teste_expira_em, plano_expira_em, selo_loja_verificada, criado_em, banner_tipo, banner_url, banner_modelo, banner_cor, endereco, lat, lng, horarios, sobre, formas_pagamento, faz_entrega, entrega_obs";
// O IP da loja e os identificadores internos do gateway não saem pela API.
const COLUNAS_PROPOSTA =
  "id, pedido_id, vitrine_id, anuncio_id, mensagem, preco_centavos, foto_url, escolhida, escolhida_em, status, moderado_motivo, criado_em, atualizado_em";
const CABECALHOS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

// Continua também quando o servidor limita a página a menos linhas que o solicitado.
// Cada consulta deve ordenar por uma chave única para não repetir ou pular empates.
async function lerPaginas<T>(consulta: (inicio: number, fim: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const linhas: T[] = [];
  for (;;) {
    const { data, error } = await consulta(linhas.length, linhas.length + 499);
    if (error || !data) throw new Error("Falha na exportação");
    if (!data.length) return linhas;
    linhas.push(...data);
  }
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("Entre na sua conta para continuar.", { status: 401, headers: CABECALHOS });

  try {
    const db = await createClient();
    const proprios = (tabela: string, colunas: string, dono = "usuario_id", ordem = "id") =>
      lerPaginas((inicio, fim) => db.from(tabela).select(colunas).eq(dono, userId).order(ordem).range(inicio, fim).returns<Record<string, unknown>[]>());
    const [perfil, vitrine, contatos, favoritos, pedidos, conversas, mensagens, aceites, notificacoes, preferencias, avaliacoes, verificacoes, atendimentos, mensagensAtendimento] = await Promise.all([
      db.rpc("meu_perfil"),
      db.from("vitrines_lojas").select(COLUNAS_VITRINE).eq("dono_id", userId).maybeSingle<{ id: string }>(),
      db.rpc("meus_contatos_vitrine").maybeSingle<{ whatsapp: string | null; instagram: string | null }>(),
      proprios("favoritos", "anuncio_id, criado_em", "usuario_id", "anuncio_id"),
      proprios("radar_pedidos", "*", "comprador_id"),
      proprios("robo_conversas", "id, titulo, criado_em, atualizado_em"),
      // Não embute as mensagens na conversa: a relação aninhada também tem limite de linhas.
      proprios("robo_mensagens", "id, conversa_id, papel, conteudo, tipo, criado_em"),
      proprios("aceites", "id, tipo, versao, aceito_em"),
      proprios("notificacoes", "id, tipo, titulo, texto, link, canal, dados, lida_em, enviada_em, criado_em"),
      lerPaginas((inicio, fim) => db.from("preferencias_avisos").select("tipo, canal, ligado, atualizado_em")
        .eq("usuario_id", userId).order("tipo").order("canal").range(inicio, fim)),
      proprios("robo_avaliacoes", "id, mensagem_id, nota, comentario, criado_em, atualizado_em"),
      proprios("perfis_verificacoes", "id, tipo, status, analisado_em, motivo_recusa, criado_em", "perfil_id"),
      proprios("atendimentos_anuncio", "id, anuncio_id, criado_em, atualizado_em", "anunciante_id"),
      lerPaginas((inicio, fim) => db.from("atendimento_mensagens")
        .select("id, conversa_id, autor, texto, criado_em, atendimentos_anuncio!inner(anunciante_id)")
        .eq("atendimentos_anuncio.anunciante_id", userId).order("id").range(inicio, fim)),
    ]);
    const linhaPerfil = Array.isArray(perfil.data) ? perfil.data[0] : perfil.data;
    if (perfil.error || vitrine.error || contatos.error || linhaPerfil?.id !== userId) throw new Error("Falha na exportação");

    const daVitrine = (tabela: string, colunas: string) => vitrine.data
      ? lerPaginas((inicio, fim) => db.from(tabela).select(colunas).eq("vitrine_id", vitrine.data!.id).order("id").range(inicio, fim))
      : Promise.resolve([]);
    const [anuncios, propostasEnviadas, pagamentos, propostasRecebidas] = await Promise.all([
      daVitrine("anuncios", "*"),
      daVitrine("radar_propostas", COLUNAS_PROPOSTA),
      daVitrine("pagamentos", "id, tipo, plano_codigo, anuncio_id, valor_centavos, forma, status, vencimento, pago_em, criado_em"),
      lerPaginas((inicio, fim) => db.from("radar_propostas")
        .select(`${COLUNAS_PROPOSTA}, radar_pedidos!inner(comprador_id)`)
        .eq("radar_pedidos.comprador_id", userId).eq("status", "ativa").order("id").range(inicio, fim)),
    ]);

    const dados = {
      gerado_em: new Date().toISOString(),
      site: `Mercado da Região (${SITE})`,
      aviso: "Este arquivo reúne os dados disponíveis na sua conta. Guarde com cuidado: ele contém informações pessoais. Registros internos de segurança e cobrança não estão incluídos.",
      perfil: linhaPerfil,
      vitrine: vitrine.data ? { ...vitrine.data, ...contatos.data } : null,
      anuncios,
      propostas_radar_enviadas: propostasEnviadas,
      propostas_radar_recebidas: propostasRecebidas.map((proposta) => {
        const dadosProposta: Record<string, unknown> = { ...proposta };
        delete dadosProposta.radar_pedidos;
        return dadosProposta;
      }),
      pagamentos,
      favoritos,
      pedidos_radar: pedidos,
      conversas_com_o_aki: conversas.map((conversa) => ({
        ...conversa,
        robo_mensagens: mensagens.filter((mensagem) => mensagem.conversa_id === conversa.id),
      })),
      conversas_de_atendimento: atendimentos.map((conversa) => ({
        ...conversa,
        mensagens: mensagensAtendimento.filter((mensagem) => mensagem.conversa_id === conversa.id)
          .map(({ id, autor, texto, criado_em }) => ({ id, autor, texto, criado_em })),
      })),
      avaliacoes_do_aki: avaliacoes,
      notificacoes,
      preferencias_de_avisos: preferencias,
      verificacoes,
      aceites_dos_termos: aceites,
    };

    const dia = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(dados, null, 2), {
      headers: {
        ...CABECALHOS,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="mercado-da-regiao-meus-dados-${dia}.json"`,
      },
    });
  } catch {
    // Nunca entregar um arquivo parcial com aparência de exportação bem-sucedida.
    return new Response("Não deu para juntar seus dados agora. Tente de novo.", { status: 500, headers: CABECALHOS });
  }
}
