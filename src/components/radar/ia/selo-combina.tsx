import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Anúncio da vitrine que a IA marcou para o pedido: selo com texto e a frase do porquê.
export function SeloCombina({ motivo }: { motivo: string }) {
  return (
    <span className="flex flex-col items-start gap-1">
      <Badge variant="success" tamanho="grande" className="whitespace-normal">
        <Sparkles aria-hidden />
        Combina com o pedido
      </Badge>
      <span className="text-legenda text-texto-suave">{motivo}</span>
    </span>
  );
}
