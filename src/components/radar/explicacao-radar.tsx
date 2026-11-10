import { HandCoins, MessageCircle, Megaphone, Radar } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { linkPedirRadar } from "@/lib/rotas";

const PASSOS = [
  { icone: <Megaphone />, titulo: "Você pede", texto: "Diga o que procura, quanto quer pagar e a cidade." },
  { icone: <HandCoins />, titulo: "As lojas oferecem", texto: "Receba ofertas de lojas da sua região." },
  { icone: <MessageCircle />, titulo: "Você escolhe", texto: "Compare propostas aqui ou receba contatos pelo WhatsApp." },
];

// T26 para quem ainda não entrou: o Radar em 3 desenhos e o botão para pedir.
export function ExplicacaoRadar({ textoBusca }: { textoBusca?: string | null }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-titulo font-semibold">
          <Radar className="size-5 text-laranja-escuro" aria-hidden />
          Radar de Negócios
        </h1>
        <p className="text-base text-texto-suave">Não achou o que queria? Peça aqui e as lojas da região te procuram.</p>
      </header>
      <ol className="flex flex-col gap-3">
        {PASSOS.map((p, i) => (
          <li key={p.titulo} className="flex items-center gap-3 rounded-card border border-borda bg-cartao p-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-selecao text-beringela [&>svg]:size-5" aria-hidden>
              {p.icone}
            </span>
            <div className="flex flex-col">
              <span className="text-base font-semibold">
                {i + 1}. {p.titulo}
              </span>
              <span className="text-sm text-texto-suave">{p.texto}</span>
            </div>
          </li>
        ))}
      </ol>
      <Botao href={linkPedirRadar(textoBusca)} larguraTotal icone={<Megaphone />}>
        Pedir no Radar
      </Botao>
      <p className="text-center text-sm text-texto-suave">Entre na sua conta para fazer um pedido grátis.</p>
    </main>
  );
}
