import Link from "next/link";
import { Sparkles } from "lucide-react";
import { LINK_PLANOS } from "@/lib/rotas";

// Recurso fora do plano: diz em quais planos tem ("Disponível no Slim e no Full", lido da tabela)
// e leva à página de planos. Nunca esconde o recurso sem explicar.
export function UpsellPlano({ titulo, texto, disponivel }: { titulo: string; texto?: string; disponivel: string | null }) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-borda bg-cartao p-4">
      <p className="flex items-center gap-2 text-base font-semibold">
        <Sparkles className="size-5 shrink-0 text-laranja-escuro" aria-hidden />
        {titulo}
      </p>
      {texto && <p className="text-base text-texto-suave">{texto}</p>}
      <p className="text-base font-semibold">{disponivel ?? "Não faz parte do seu plano agora."}</p>
      <Link
        href={`${LINK_PLANOS}?origem=vitrine`}
        className="inline-flex min-h-10 w-fit items-center font-semibold text-laranja-escuro underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-laranja-escuro"
      >
        Ver os planos
      </Link>
    </div>
  );
}
