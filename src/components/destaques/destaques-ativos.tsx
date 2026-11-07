import { BarChart3 } from "lucide-react";
import { fraseResultado } from "@/lib/dados/destaques";
import type { ResultadoDestaque } from "@/lib/tipos-destaques";

// Destaques que estão valendo (ou que acabaram há pouco) com o resultado de cada um.
// Usado na tela "Destacar" e em "Minha loja".

const dataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Fortaleza" });

export function DestaquesAtivos({ lista, titulo = "Seus destaques" }: { lista: ResultadoDestaque[]; titulo?: string }) {
  const mostrar = lista.filter((d) => d.status === "ativo" || d.status === "encerrado").slice(0, 5);
  if (!mostrar.length) return null;
  return (
    <section aria-labelledby="titulo-destaques-ativos" className="flex flex-col gap-2 rounded-card bg-cartao p-4 shadow-1">
      <h2 id="titulo-destaques-ativos" className="flex items-center gap-2 text-lg font-semibold">
        <BarChart3 className="size-5 text-laranja-escuro" aria-hidden />
        {titulo}
      </h2>
      <ul className="flex flex-col gap-2">
        {mostrar.map((d) => {
          const valendo = d.status === "ativo" && !!d.fim && new Date(d.fim).getTime() > Date.now();
          const comecaDepois = valendo && !!d.inicio && new Date(d.inicio).getTime() > Date.now();
          return (
            <li key={d.id} className="rounded-campo bg-fundo p-3">
              <p className="text-base font-semibold">
                {d.tipo_nome}
                {d.tipo !== "subir" && d.fim && (
                  <span className="font-normal text-texto-suave">
                    {comecaDepois
                      ? ` · começa em ${dataCurta.format(new Date(d.inicio!))}`
                      : valendo
                        ? ` · até ${dataCurta.format(new Date(d.fim))}`
                        : ` · acabou em ${dataCurta.format(new Date(d.fim))}`}
                  </span>
                )}
              </p>
              {!comecaDepois && <p className="text-base">Seu destaque teve {fraseResultado(d)}.</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
