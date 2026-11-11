import { tonsDaCor } from "@/lib/cor-logo";

// Padrão visual do banner do Mercado da Região. Todas as lojas recebem a mesma "receita":
// o que muda de uma loja para outra é só a paleta (tirada da logo) e o motivo da categoria.
// Para mudar o jeito de todos os banners, mude só este texto.

export type DadosBanner = { loja?: string | null; categoria?: string | null; descricao?: string | null; cor: string; estilo: string };

export function promptBanner({ loja, categoria, descricao, cor, estilo }: DadosBanner): string {
  const t = tonsDaCor(cor);
  const dadosLoja = JSON.stringify({ loja: loja ?? "", categoria: categoria ?? "", descricao: descricao ?? "" });
  return [
    "Crie a arte de fundo do banner de uma loja da vitrine Mercado da Região, no padrão visual fixo da plataforma. Todas as lojas seguem o mesmo padrão, para a vitrine parecer uma coisa só.",
    "ESTILO FIXO: ilustração gráfica plana e moderna, acabamento limpo e acolhedor. Formas geométricas suaves: ondas largas e círculos grandes e parcialmente transparentes, em camadas, com gradiente suave. Nada de fotografia realista, 3D, brilho exagerado, neon, textura suja ou excesso de detalhes.",
    `PALETA OBRIGATÓRIA (use só estes tons, mais branco): cor principal ${t.principal}; tom escuro ${t.escura} nas bordas e cantos; tom claro ${t.clara} nos brilhos e no meio. Não invente outras cores.`,
    "COMPOSIÇÃO: a arte será cortada numa faixa horizontal de proporção 3:1; mantenha tudo importante nessa faixa central. Deixe o centro amplo, calmo e quase liso, porque o logo da loja ficará por cima. Concentre a decoração nas duas laterais, com a mesma leveza dos dois lados.",
    "MOTIVO: escolha um único motivo simples ligado à categoria da loja (por exemplo, folhas para flores, grãos para café, engrenagem para oficina), desenhado como silhueta estilizada em tom sobre tom, discreto, ocupando no máximo um quarto da largura. Sem categoria clara, use só as formas geométricas.",
    "PROIBIDO: letras, números, palavras, slogans, preços, marcas, logotipos, marcas d'água, pessoas, rostos, bordas e molduras.",
    estilo ? `PREFERÊNCIA EXTRA DO LOJISTA (só vale se não contrariar as regras acima): ${JSON.stringify(estilo)}` : "",
    `Dados da loja, só como referência: ${dadosLoja}`,
  ].filter(Boolean).join("\n");
}
