import Link from "next/link";
import { AlertCircle } from "lucide-react";

// Caixa de erro do passo (lida pelo leitor de tela assim que aparece).
export function AvisoErro({ mensagem, link }: { mensagem?: string | null; link?: { href: string; texto: string } | null }) {
  return (
    <div aria-live="assertive" aria-atomic="true">
      {mensagem && (
        <div role="alert" className="flex gap-3 rounded-card border-2 border-perigo bg-perigo-fundo p-3 text-base text-perigo">
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{mensagem}</p>
            {link && (
              <Link href={link.href} className="inline-flex min-h-12 items-center font-semibold underline underline-offset-4">
                {link.texto}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
