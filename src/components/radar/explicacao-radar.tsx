import { MessageCircle, Megaphone, PenLine, Radar, Store } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { linkPedirRadar } from "@/lib/rotas";

const PASSOS = [
  { icone: <PenLine />, titulo: "1. Diga o que precisa" },
  { icone: <Store />, titulo: "2. As lojas da região te respondem" },
  { icone: <MessageCircle />, titulo: "3. Você escolhe com quem falar" },
];

// T26 para quem ainda não entrou: o Radar em 3 passos e o botão para pedir. Modo fácil (texto 18px, botão 48px).
export function ExplicacaoRadar({ textoBusca }: { textoBusca?: string | null }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4">
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-facil-titulo font-semibold">
          <Radar className="size-6 text-laranja-escuro" aria-hidden />
          Estou procurando…
        </h1>
        <p className="text-facil text-texto-suave">Diga o que precisa. As lojas da região te respondem.</p>
      </header>
      <ol className="flex flex-col gap-3">
        {PASSOS.map((p) => (
          <li key={p.titulo} className="flex items-center gap-3 rounded-card border border-borda bg-cartao p-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-selecao text-beringela [&>svg]:size-6" aria-hidden>
              {p.icone}
            </span>
            <span className="text-facil font-semibold">{p.titulo}</span>
          </li>
        ))}
      </ol>
      <Botao href={linkPedirRadar(textoBusca)} tamanho="grande" larguraTotal icone={<Megaphone />}>
        Estou procurando…
      </Botao>
      <p className="text-center text-facil text-texto-suave">Entre na sua conta para fazer um pedido grátis.</p>
    </main>
  );
}
