// Barras simples em HTML/CSS (sem biblioteca). O número sempre aparece escrito; a barra é só
// enfeite (aria-hidden), então leitor de tela e quem enxerga pouco recebem a mesma informação.

export type ItemBarra = { rotulo: string; valor: number; texto: string; detalhe?: string };

const COR = {
  laranja: "bg-laranja",
  beringela: "bg-beringela",
  verde: "bg-verde-escuro",
} as const;

export function Barras({ itens, cor = "laranja", rotulo }: { itens: ItemBarra[]; cor?: keyof typeof COR; rotulo: string }) {
  const maior = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <ul className="space-y-3" aria-label={rotulo}>
      {itens.map((i) => (
        <li key={i.rotulo}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 text-base text-beringela">{i.rotulo}</span>
            <span className="shrink-0 text-base font-semibold tabular-nums text-beringela">{i.texto}</span>
          </div>
          <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-fundo" aria-hidden>
            <div className={`h-full rounded-full ${COR[cor]}`} style={{ width: `${i.valor > 0 ? Math.max(2, (i.valor / maior) * 100) : 0}%` }} />
          </div>
          {i.detalhe && <p className="mt-1 text-legenda text-texto-suave">{i.detalhe}</p>}
        </li>
      ))}
    </ul>
  );
}
