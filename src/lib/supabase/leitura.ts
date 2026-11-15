const FUNCOES_PUBLICAS = new Set([
  "anuncio_fora_do_ar", "anuncio_id_por_slug", "anuncio_publico", "anuncios_cards_extra",
  "anuncios_vitrine", "buscar_anuncios", "buscar_anuncios_com_facetas", "catalogo_anuncios",
  "catalogo_lojas", "catalogo_lojas_busca", "categoria_escondida", "categorias_do_caminho",
  "config_publica", "contagem_categorias_regiao", "contatos_da_loja", "faixa_preco_regiao",
  "recursos_da_loja", "vitrine_publica", "voucher_promocao_ativa",
]);

/** As RPCs permitidas foram conferidas como STABLE; PostgREST usa transação READ ONLY. */
export function criarFetchLeitura(origem: string, chave: string, validade: number, enviar: typeof fetch = fetch): typeof fetch {
  const destino = new URL(origem).origin;
  return async (entrada, opcoes) => {
    if (!Number.isFinite(validade) || Date.now() >= validade) throw new Error("Prévia expirada.");
    const pedido = new Request(entrada, opcoes);
    const url = new URL(pedido.url);
    if (url.origin !== destino || !url.pathname.startsWith("/rest/v1/")) {
      throw new Error("Destino não permitido na prévia de leitura.");
    }

    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/([a-zA-Z0-9_]+)$/);
    if (url.pathname.startsWith("/rest/v1/rpc/") && (!rpc || !FUNCOES_PUBLICAS.has(rpc[1]))) {
      throw new Error("Função não permitida na prévia.");
    }
    const metodo = pedido.method;
    let corpo: string | undefined;
    if (metodo === "POST" && rpc) {
      corpo = await pedido.text();
      const argumentos: unknown = JSON.parse(corpo);
      if (!argumentos || typeof argumentos !== "object" || Array.isArray(argumentos)) {
        throw new Error("Argumentos RPC inválidos.");
      }
    } else if (metodo !== "GET" && metodo !== "HEAD") {
      throw new Error("Escrita desativada na prévia.");
    }

    const headers = new Headers(pedido.headers);
    headers.set("apikey", chave);
    headers.set("authorization", `Bearer ${chave}`);
    headers.delete("cookie");
    return enviar(new Request(url, { method: metodo, headers, body: corpo, signal: pedido.signal }));
  };
}

export function permitePrevia(metodo: string, caminho: string): boolean {
  if (metodo !== "GET" && metodo !== "HEAD") return false;
  return ["/", "/busca", "/termos", "/privacidade", "/planos"].includes(caminho)
    || /^\/(anuncio|loja)\/[a-zA-Z0-9_-]+\/?$/.test(caminho);
}
