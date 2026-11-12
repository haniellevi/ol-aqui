/** Marca tipográfica: permanece legível no cabeçalho e em telas pequenas. */
export function Marca({ className = "" }: { className?: string }) {
  return <span className={`inline-flex items-center gap-2 text-beringela ${className}`} aria-label="Mercado da Região">
    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-laranja text-lg font-bold">M</span>
    <span aria-hidden className="flex flex-col text-left text-[15px] font-bold leading-[1.1] tracking-tight">Mercado<span className="text-[13px] font-semibold">da Região</span></span>
  </span>;
}
