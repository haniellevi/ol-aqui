import { CircleCheckBig, Megaphone, Store } from "lucide-react";

// "Você pede → as lojas oferecem → você escolhe" (TELAS-E-FLUXOS, T26: visitante vê a explicação
// em 3 desenhos). Ícone sempre com palavra; em lista ordenada para o leitor de tela contar os passos.

const PASSOS = [
  { Icone: Megaphone, titulo: "Você pede", texto: "Diga o que procura e até quanto quer pagar." },
  { Icone: Store, titulo: "As lojas oferecem", texto: "Lojas e vendedores da região recebem seu pedido." },
  { Icone: CircleCheckBig, titulo: "Você escolhe", texto: "Fale no WhatsApp só com quem tem o que você quer." },
];

export function ComoFuncionaRadar({ compacto = false, className = "" }: { compacto?: boolean; className?: string }) {
  return (
    <ol className={`grid gap-3 ${compacto ? "grid-cols-3" : "sm:grid-cols-3"} ${className}`}>
      {PASSOS.map(({ Icone, titulo, texto }, i) => (
        <li
          key={titulo}
          className={
            compacto
              ? "flex flex-col items-center gap-1.5 text-center"
              : "flex items-start gap-3 rounded-card bg-cartao p-4 shadow-1 sm:flex-col sm:items-center sm:text-center"
          }
        >
          <span
            aria-hidden
            className={`relative grid shrink-0 place-items-center rounded-full text-beringela ${compacto ? "size-12 bg-cartao" : "size-14 bg-laranja-claro"}`}
          >
            <Icone className={compacto ? "size-6" : "size-7"} />
            <span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-beringela text-[13px] font-bold text-white">
              {i + 1}
            </span>
          </span>
          <span className="flex flex-col gap-0.5">
            <span className={`font-semibold text-beringela ${compacto ? "text-[15px] leading-5" : "text-base"}`}>{titulo}</span>
            {!compacto && <span className="text-[15px] text-texto-suave">{texto}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
