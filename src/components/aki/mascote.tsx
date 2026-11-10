// Mascote do Aki: balão de conversa laranja com dois olhinhos (DESIGN-SYSTEM.md, seção 4).
// É só o robô; nunca substitui o logo do Mercado da Região. Fica bom a partir de 24px.
export function MascoteAki({ tamanho = 28, className = "" }: { tamanho?: number; className?: string }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" aria-hidden className={className}>
      <path
        d="M6 3h20a4 4 0 0 1 4 4v13a4 4 0 0 1-4 4H14l-6.5 5.2c-.7.5-1.5 0-1.5-.8V24a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Z"
        className="fill-laranja"
      />
      <ellipse cx="12" cy="13.5" rx="2.2" ry="3" className="fill-beringela" />
      <ellipse cx="20" cy="13.5" rx="2.2" ry="3" className="fill-beringela" />
      <circle cx="12.8" cy="12.4" r="0.8" className="fill-cartao" />
      <circle cx="20.8" cy="12.4" r="0.8" className="fill-cartao" />
    </svg>
  );
}
