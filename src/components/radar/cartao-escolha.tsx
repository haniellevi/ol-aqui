import type { ReactNode } from "react";
import { Check } from "lucide-react";

// Cartão grande de escolha do Radar (Modo fácil): um rádio de verdade, escondido, dentro do rótulo.
// Teclado: Tab entra no grupo, setas trocam; o leitor de tela lê o título e a ajuda.
// Mesmo desenho dos cartões de plano (escolher-plano.tsx) e das opções do anúncio (form-detalhes.tsx).
export function CartaoEscolha({
  nome,
  valor,
  marcado,
  onEscolher,
  titulo,
  ajuda,
  icone,
  desabilitado = false,
  children,
}: {
  /** name do grupo de rádios. */
  nome: string;
  valor: string;
  marcado: boolean;
  onEscolher: () => void;
  titulo: ReactNode;
  ajuda?: ReactNode;
  /** Ícone ao lado do título (sempre com texto ao lado). */
  icone?: ReactNode;
  desabilitado?: boolean;
  /** Conteúdo que aparece dentro do cartão quando marcado (ex.: os chips de cidades). */
  children?: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-card border p-4 transition-colors focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-laranja-escuro ${
        marcado ? "border-laranja-escuro bg-selecao" : "border-borda bg-cartao hover:bg-fundo"
      } ${desabilitado ? "opacity-70" : ""}`}
    >
      <label className={`flex min-h-12 items-start gap-3 ${desabilitado ? "cursor-not-allowed" : "cursor-pointer"}`}>
        <input type="radio" name={nome} value={valor} checked={marcado} disabled={desabilitado} onChange={onEscolher} className="sr-only" />
        <span
          className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 ${marcado ? "border-laranja-escuro bg-laranja-escuro text-white" : "border-borda-campo bg-cartao"}`}
          aria-hidden
        >
          {marcado && <Check className="size-4" />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1 text-beringela">
          <span className="flex items-center gap-2 text-lg font-semibold [&>svg]:size-5 [&>svg]:shrink-0">
            {icone && <span className="inline-flex [&>svg]:size-5" aria-hidden>{icone}</span>}
            {titulo}
          </span>
          {ajuda && <span className="text-lg">{ajuda}</span>}
        </span>
      </label>
      {marcado && children}
    </div>
  );
}
