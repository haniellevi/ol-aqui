import { Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { classesEntradaGrupo, classesGrupoCampo } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { manterFiltros, type ParametrosUrl } from "@/components/busca/parametros";
import { EntradaComSugestoes } from "@/components/busca/entrada-com-sugestoes";

// Busca "O que você procura?" (DESIGN.md, seção 9): uma só por tela, sem laranja (o laranja da tela fica
// para a ação principal). Estilo vem das peças oficiais: caixa de `input.tsx` e lupa do botão "ghost".
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
      <div className={classesGrupoCampo}>
        {sugestoes ? (
          <EntradaComSugestoes key={`${regiao}|${valor}`} id={id} valor={valor} autoFocus={autoFocus} className={classesEntradaGrupo} placeholder={placeholder ?? "O que você procura?"} />
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
            className={classesEntradaGrupo}
          />
        )}
        <button
          type="submit"
          aria-label="Buscar"
          className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "size-toque shrink-0")}
        >
          <Search className="size-5" aria-hidden />
        </button>
      </div>
    </form>
  );
}
