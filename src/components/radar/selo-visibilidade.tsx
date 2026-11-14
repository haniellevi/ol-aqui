import { Store, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Visibilidade } from "@/lib/tipos-radar";

// Selo do pedido: quem pode ver. Sempre com texto ao lado do ícone.
// O selo acompanha o tamanho padrão das listas.
export function SeloVisibilidade({ visibilidade, className, tamanho = "normal" }: { visibilidade?: Visibilidade | null; className?: string; tamanho?: "normal" | "grande" }) {
  if (visibilidade !== "todos" && visibilidade !== "lojas") return null;
  const todos = visibilidade === "todos";
  return (
    <Badge variant={todos ? "success" : "secondary"} tamanho={tamanho} className={className}>
      {todos ? <Users aria-hidden /> : <Store aria-hidden />}
      {todos ? "Todo mundo" : "Só lojas"}
    </Badge>
  );
}
