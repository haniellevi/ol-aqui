import { Search } from "lucide-react";
import { manterFiltros, type ParametrosUrl } from "@/components/busca/parametros";
import { EntradaComSugestoes } from "@/components/busca/entrada-com-sugestoes";

const ESTILO_ENTRADA = "h-full min-w-0 flex-1 bg-transparent text-base text-texto placeholder:text-texto-suave focus:outline-none";

// Busca grande "O que você procura?". Formulário GET para /busca: funciona sem JavaScript
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
  toqueAmplo = false,
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
  toqueAmplo?: boolean;
}) {
  return (
    <form action={caminho} method="get" role="search" className="flex flex-col gap-2">
      <label htmlFor={id} className={rotuloVisivel ? "text-titulo font-semibold" : "sr-only"}>
        O que você procura?
      </label>
      {Object.entries(manterFiltros(manter)).flatMap(([k, v]) =>
        (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean).map((valor, i) => <input key={`${k}-${i}`} type="hidden" name={k} value={valor} />),
      )}
      <div className={`relative flex items-center gap-2 rounded-card bg-cartao pl-3 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-laranja-escuro ${toqueAmplo ? "h-[50px] border border-borda-campo md:h-10 md:pr-1" : "h-12 border-2 border-beringela pr-1 md:h-10"}`}>
        <Search className="size-5 shrink-0 text-beringela @max-[12rem]/busca-topo:hidden" aria-hidden />
        {sugestoes ? (
          <EntradaComSugestoes key={`${regiao}|${valor}`} id={id} valor={valor} autoFocus={autoFocus} className={ESTILO_ENTRADA} placeholder={toqueAmplo ? "Buscar anúncios" : undefined} />
        ) : (
          <input
            id={id}
            type="search"
            name="q"
            defaultValue={valor}
            placeholder={toqueAmplo ? "Buscar anúncios" : "Ex.: moto, geladeira, casa"}
            enterKeyHint="search"
            autoComplete="off"
            maxLength={120}
            autoFocus={autoFocus}
            className={ESTILO_ENTRADA}
          />
        )}
        <button
          type="submit"
          className={`inline-flex shrink-0 items-center rounded-campo bg-laranja px-3 text-sm font-semibold text-beringela hover:brightness-95 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro active:brightness-90 md:h-7 @max-[12rem]/busca-topo:h-8 @max-[12rem]/busca-topo:px-2 ${toqueAmplo ? "h-12 max-md:rounded-s-none" : "h-8"}`}
        >
          <Search className="hidden size-5 @max-[12rem]/busca-topo:block" aria-hidden />
          <span className="@max-[12rem]/busca-topo:sr-only">Buscar</span>
        </button>
      </div>
    </form>
  );
}
