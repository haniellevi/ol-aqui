import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";

// Caixa de erro do passo (lida pelo leitor de tela assim que aparece).
export function AvisoErro({ mensagem, link }: { mensagem?: string | null; link?: { href: string; texto: string } | null }) {
  return (
    <div aria-live="assertive" aria-atomic="true">
      {mensagem && (
        <Alert variant="destructive" role="alert" tabIndex={-1} className="flex gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{mensagem}</p>
            {link && (
              <Link href={link.href} className="inline-flex min-h-10 items-center font-semibold underline underline-offset-4">
                {link.texto}
              </Link>
            )}
          </div>
        </Alert>
      )}
    </div>
  );
}
