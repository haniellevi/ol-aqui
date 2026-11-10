import { BadgeCheck, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Selos sempre com texto (nunca só cor ou ícone).
export function SeloLoja() {
  return (
    <Badge variant="success">
      <ShieldCheck className="size-4" aria-hidden /> Loja verificada
    </Badge>
  );
}

export function SeloNegociador() {
  return (
    <Badge variant="success">
      <BadgeCheck className="size-4" aria-hidden /> Negociador certificado
    </Badge>
  );
}
