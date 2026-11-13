// Os 6 passos do "Anunciar" (TELAS-E-FLUXOS T17–T22). Serve no servidor e no navegador.

export const PASSOS = [
  { slug: "fotos", titulo: "Fotos" },
  { slug: "categoria", titulo: "Categoria" },
  { slug: "detalhes", titulo: "Detalhes" },
  { slug: "preco", titulo: "Preço" },
  { slug: "local", titulo: "Local" },
  { slug: "revisar", titulo: "Revisar" },
] as const;

export type SlugPasso = (typeof PASSOS)[number]["slug"];

export const TOTAL_PASSOS = PASSOS.length;

/** Número do passo (1 a 6). */
export const numeroPasso = (slug: SlugPasso) => PASSOS.findIndex((p) => p.slug === slug) + 1;

/** Endereço de um passo: /anunciar/<passo>?rascunho=<id>[&editar=1]. */
export function urlPasso(slug: SlugPasso, id: string, editar = false): string {
  return `/anunciar/${slug}?rascunho=${encodeURIComponent(id)}${editar ? "&editar=1" : ""}`;
}

/** Passo seguinte (null no último). */
export function proximoPasso(slug: SlugPasso): SlugPasso | null {
  const i = PASSOS.findIndex((p) => p.slug === slug);
  return PASSOS[i + 1]?.slug ?? null;
}

/** Passo anterior (null no primeiro). */
export function passoAnterior(slug: SlugPasso): SlugPasso | null {
  const i = PASSOS.findIndex((p) => p.slug === slug);
  return i > 0 ? PASSOS[i - 1].slug : null;
}

/** Para onde vai o "Salvar e sair". */
export const DESTINO_SAIR = "/minha-conta/anuncios";

/** Campo do banco (details "campo:x") → passo onde a pessoa corrige. */
export function passoDoCampo(campo: string | undefined): SlugPasso | null {
  if (!campo) return null;
  if (campo === "fotos") return "fotos";
  if (campo === "categoria") return "categoria";
  if (campo === "preco" || campo === "preco_centavos") return "preco";
  if (campo === "cidade" || campo === "bairro") return "local";
  return "detalhes"; // título, descrição e campos da categoria
}

/** Status em que o anúncio já está publicado (revisar mostra "Salvar alterações"). */
export const STATUS_PUBLICADO = ["ativo", "em_analise", "vendido"] as const;

export type EstadoForm = {
  /** Etapa para abrir após confirmar a gravação. */
  irPara?: string;
  /** Mensagem de sucesso (ex.: ação que não muda de tela). */
  ok?: string;
  erro?: { mensagem: string; campo?: string; codigo?: string };
  /** Erro por campo (name do input → mensagem). */
  campos?: Record<string, string>;
} | null;
