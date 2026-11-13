import { ArrowRight } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { preco } from "@/lib/formato";
import type { ParecidoIA } from "@/lib/radar-ia/tipos";

// "Achamos isso na região. Quer ver?" (o título fica no formulário). Cartões como os da folha "Eu sei onde tem",
// com a frase da IA. "Ver anúncio" sai do pedido; "Não achei, continuar pedido" segue para "Onde?".
export function ParecidosIA({ parecidos, onContinuar }: { parecidos: ParecidoIA[]; onContinuar: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {parecidos.map((a) => (
          <li key={a.id} className="flex flex-col gap-2 rounded-card border border-borda bg-cartao p-3">
            <div className="flex items-center gap-3">
              {a.capa ? (
                // eslint-disable-next-line @next/next/no-img-element -- capa do anúncio no Storage
                <img src={a.capa} alt="" width={64} height={64} className="size-16 shrink-0 rounded-campo bg-borda object-cover" />
              ) : (
                <span aria-hidden className="size-16 shrink-0 rounded-campo bg-borda" />
              )}
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-facil font-semibold break-words">{a.titulo}</span>
                <span className="text-facil font-bold text-beringela">{preco(a.preco_centavos)}</span>
                {a.vitrine_nome && <span className="text-facil text-texto-suave break-words">{a.vitrine_nome}</span>}
              </div>
            </div>
            <p className="text-facil text-texto">{a.motivo}</p>
            <Botao href={a.link} variante="secundario" tamanho="grande" larguraTotal className="sm:max-w-none">
              Ver anúncio
            </Botao>
          </li>
        ))}
      </ul>
      <Botao tamanho="grande" larguraTotal icone={<ArrowRight />} className="sm:max-w-none" onClick={onContinuar}>
        Não achei, continuar pedido
      </Botao>
    </div>
  );
}
