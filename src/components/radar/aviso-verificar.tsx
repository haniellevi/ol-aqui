import { ShieldCheck } from "lucide-react";
import { Botao } from "@/components/ui/botao";

// Plano pago com Radar, mas sem o selo: o que falta é verificar a loja (não assinar outro plano).
export function AvisoVerificar({ href, titulo, className = "" }: { href: string; titulo: string; className?: string }) {
  return (
    <section className={`flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1 ${className}`.trim()}>
      <p className="inline-flex items-center gap-2 text-facil font-bold text-beringela">
        <ShieldCheck className="size-5 shrink-0 text-laranja-escuro" aria-hidden />
        {titulo}
      </p>
      <p className="text-facil text-texto-suave">Seu plano já tem Radar. Falta verificar a loja para ver os pedidos e mandar ofertas.</p>
      <Botao href={href} larguraTotal tamanho="grande">
        Verificar minha loja
      </Botao>
    </section>
  );
}
