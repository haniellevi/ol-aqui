import { Store, Users } from "lucide-react";
import type { Visibilidade } from "@/lib/tipos-radar";
import { CartaoEscolha } from "./cartao-escolha";
import { TEXTO_VISIBILIDADE } from "./passos-pedido";

// Passo 3: quem pode ver o pedido. "Só lojas" vem marcado (o formulário começa com "lojas").
export function EscolherVisibilidade({ valor, onChange }: { valor: Visibilidade; onChange: (v: Visibilidade) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <CartaoEscolha
        nome="visibilidade"
        valor="lojas"
        marcado={valor === "lojas"}
        onEscolher={() => onChange("lojas")}
        icone={<Store />}
        titulo={TEXTO_VISIBILIDADE.lojas.titulo}
        ajuda={TEXTO_VISIBILIDADE.lojas.ajuda}
      />
      <CartaoEscolha
        nome="visibilidade"
        valor="todos"
        marcado={valor === "todos"}
        onEscolher={() => onChange("todos")}
        icone={<Users />}
        titulo={TEXTO_VISIBILIDADE.todos.titulo}
        ajuda={TEXTO_VISIBILIDADE.todos.ajuda}
      />
    </div>
  );
}
