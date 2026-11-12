import { Search } from "lucide-react";
import { manterFiltros, type ParametrosUrl } from "@/components/busca/parametros";

// Busca grande "O que você procura?". Formulário GET para /busca: funciona sem JavaScript
// e o endereço do resultado pode ser compartilhado.
export function CampoBusca({
  valor = "",
  rotuloVisivel = false,
  manter = {},
  autoFocus = false,
  id = "busca-q",
  caminho = "/busca",
  compacto = false,
}: {
  valor?: string;
  /** Mostra o rótulo como título acima (Início). Senão fica só para o leitor de tela. */
  rotuloVisivel?: boolean;
  /** Parâmetros que continuam valendo ao buscar de novo (ex.: categoria, cidade). */
  manter?: ParametrosUrl;
  autoFocus?: boolean;
  id?: string;
  caminho?: string;
  /** Versão baixa (44px) para o cabeçalho e a barra fixa do Início. */
  compacto?: boolean;
}) {
  return (
    <form action={caminho} method="get" role="search" className={`flex flex-col gap-2 ${compacto ? "min-w-0 flex-1" : ""}`}>
      <label htmlFor={id} className={rotuloVisivel ? "text-[22px] font-semibold leading-7" : "sr-only"}>
        O que você procura?
      </label>
      {Object.entries(manterFiltros(manter)).flatMap(([k, v]) =>
        (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean).map((valor, i) => <input key={`${k}-${i}`} type="hidden" name={k} value={valor} />),
      )}
      <div className={`flex items-center gap-2 bg-cartao pl-3 pr-1 ${compacto ? "h-11 rounded-campo border border-borda-campo" : "h-14 rounded-card border-2 border-beringela"} focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-laranja-escuro`}>
        <Search className={`shrink-0 text-beringela ${compacto ? "size-5" : "size-6"}`} aria-hidden />
        <input
          id={id}
          type="search"
          name="q"
          defaultValue={valor}
          placeholder={compacto ? "O que você procura?" : "Ex.: moto, geladeira, casa"}
          enterKeyHint="search"
          autoComplete="off"
          maxLength={120}
          autoFocus={autoFocus}
          className="h-full min-w-0 flex-1 bg-transparent text-base text-texto placeholder:text-texto-suave focus:outline-none"
        />
        <button
          type="submit"
          className={`inline-flex shrink-0 items-center rounded-campo bg-laranja font-semibold ${compacto ? "h-9 px-3 text-sm" : "h-12 px-4 text-base"} text-beringela hover:brightness-95 active:brightness-90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro`}
        >
          Buscar
        </button>
      </div>
    </form>
  );
}
