import { BadgeCheck, ShieldCheck } from "lucide-react";

// Selos sempre com texto (nunca só cor ou ícone).
export function SeloLoja() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F6EE] px-2 py-0.5 text-[13px] font-bold text-verde-escuro">
      <ShieldCheck className="size-4" aria-hidden /> Loja verificada
    </span>
  );
}

export function SeloNegociador() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F6EE] px-2 py-0.5 text-[13px] font-bold text-verde-escuro">
      <BadgeCheck className="size-4" aria-hidden /> Negociador certificado
    </span>
  );
}
