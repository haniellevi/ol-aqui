import { MessageCircle, Megaphone, PenLine, Radar, Store } from "lucide-react";
import { Voltar } from "@/components/ui/voltar";
import { Botao } from "@/components/ui/botao";
import { linkPedirRadar } from "@/lib/rotas";

const PASSOS = [
  { icone: <PenLine />, titulo: "1. Diga o que precisa" },
  { icone: <Store />, titulo: "2. As lojas da região te respondem" },
  { icone: <MessageCircle />, titulo: "3. Você escolhe com quem falar" },
];

// Explica o Radar a visitantes e a quem abriu a ajuda.
export function ExplicacaoRadar({ textoBusca, visitante = true }: { textoBusca?: string | null; visitante?: boolean }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4">
      <Voltar />
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-titulo font-semibold text-beringela">
          <Radar className="size-6 text-laranja-escuro" aria-hidden />
          Como funciona o Radar
        </h1>
        <p className="text-base text-texto-suave">Diga o que precisa. As lojas da região te respondem.</p>
      </header>
      <ol className="flex flex-col gap-3">
        {PASSOS.map((p) => (
          <li key={p.titulo} className="flex items-center gap-3 rounded-card border border-borda bg-cartao p-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-selecao text-beringela [&>svg]:size-6" aria-hidden>
              {p.icone}
            </span>
            <span className="text-base font-semibold">{p.titulo}</span>
          </li>
        ))}
      </ol>
      <Botao href={linkPedirRadar(textoBusca)} larguraTotal tamanho="toque" icone={<Megaphone />}>
        Pedir no Radar
      </Botao>
      {visitante && <p className="text-base text-texto-suave">Entre na sua conta para fazer um pedido grátis.</p>}
    </main>
  );
}
