import { Search } from "lucide-react";
import { manterFiltros, type ParametrosUrl } from "@/components/busca/parametros";
import { EntradaComSugestoes } from "@/components/busca/entrada-com-sugestoes";

// 16px no toque (evita o zoom do iPhone) e 14px com mouse, como os outros campos (DESIGN.md, seção 3).
const ESTILO_ENTRADA = "h-full min-w-0 flex-1 bg-transparent text-lg text-texto placeholder:text-texto-suave focus:outline-none pointer-fine:md:text-base";

// Busca "O que você procura?" (DESIGN.md, seção 9): uma só por tela, 44px, fundo branco e borda de campo,
// sem laranja (o laranja da tela fica para a ação principal). A lupa à direita é o botão de buscar.
// Formulário GET para /busca: funciona sem JavaScript
// e o endereço do resultado pode ser compartilhado. Com `sugestoes`, mostra categorias, lojas
// e anúncios enquanto a pessoa digita (precisa de JavaScript; sem ele, fica a busca de sempre).
export function CampoBusca({
  valor = "",
  rotuloVisivel = false,
  manter = {},
  autoFocus = false,
  id = "busca-q",
  caminho = "/busca",
  sugestoes = false,
  regiao = "",
  placeholder,
}: {
  valor?: string;
  /** Mostra o rótulo como título acima (Início). Senão fica só para o leitor de tela. */
  rotuloVisivel?: boolean;
  /** Parâmetros que continuam valendo ao buscar de novo (ex.: categoria, cidade). */
  manter?: ParametrosUrl;
  autoFocus?: boolean;
  id?: string;
  caminho?: string;
  /** Lista de sugestões abaixo do campo enquanto digita (cabeçalho e página de busca). */
  sugestoes?: boolean;
  /** Cidade escolhida: ao trocar, o campo recomeça e esquece as sugestões da cidade anterior. */
  regiao?: string;
  placeholder?: string;
}) {
  return (
    <form action={caminho} method="get" role="search" className="flex flex-col gap-2">
      <label htmlFor={id} className={rotuloVisivel ? "text-titulo font-semibold" : "sr-only"}>
        O que você procura?
      </label>
      {Object.entries(manterFiltros(manter)).flatMap(([k, v]) =>
        (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean).map((valor, i) => <input key={`${k}-${i}`} type="hidden" name={k} value={valor} />),
      )}
      <div className="relative flex h-controle items-center rounded-campo border border-borda-campo bg-cartao pl-3 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-laranja-escuro">
        {sugestoes ? (
          <EntradaComSugestoes key={`${regiao}|${valor}`} id={id} valor={valor} autoFocus={autoFocus} className={ESTILO_ENTRADA} placeholder={placeholder ?? "O que você procura?"} />
        ) : (
          <input
            id={id}
            type="search"
            name="q"
            defaultValue={valor}
            placeholder={placeholder ?? "O que você procura?"}
            enterKeyHint="search"
            autoComplete="off"
            maxLength={120}
            autoFocus={autoFocus}
            className={ESTILO_ENTRADA}
          />
        )}
        <button
          type="submit"
          aria-label="Buscar"
          className="inline-flex size-controle shrink-0 items-center justify-center rounded-campo text-beringela hover:bg-fundo focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro"
        >
          <Search className="size-5" aria-hidden />
        </button>
      </div>
    </form>
  );
}
