"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

// A decisão vai vinculada à ação, sem depender do name/value do botão no FormData.
export function BotaoDecisao({ action, className, children }: { action: (form: FormData) => Promise<void>; className: string; children: React.ReactNode }) {
  const { pending, action: acaoPendente } = useFormStatus();
  const este = pending && acaoPendente === action;
  return (
    <button
      type="submit"
      formAction={action}
      disabled={pending}
      aria-busy={este || undefined}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {este && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {este ? "Salvando..." : children}
    </button>
  );
}
