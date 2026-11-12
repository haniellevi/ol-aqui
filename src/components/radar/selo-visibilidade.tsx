import { Store, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Visibilidade } from "@/lib/tipos-radar";

// Selo do pedido: quem pode ver. Sempre com texto ao lado do ícone.
export function SeloVisibilidade({ visibilidade, className }: { visibilidade?: Visibilidade | null; className?: string }) {
  if (visibilidade !== "todos" && visibilidade !== "lojas") return null;
  const todos = visibilidade === "todos";
  return (
    <Badge variant={todos ? "success" : "secondary"} className={className}>
      {todos ? <Users aria-hidden /> : <Store aria-hidden />}
      {todos ? "Todo mundo" : "Só lojas"}
    </Badge>
  );
}
