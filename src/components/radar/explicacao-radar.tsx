import { HandCoins, MessageCircle, Megaphone, Radar } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { linkPedirRadar } from "@/lib/rotas";

const PASSOS = [
  { icone: <Megaphone />, titulo: "Você pede", texto: "Diga o que procura, quanto quer pagar e a cidade." },
  { icone: <HandCoins />, titulo: "As lojas oferecem", texto: "As lojas da região mandam preço e foto." },
  { icone: <MessageCircle />, titulo: "Você escolhe", texto: "Fale no WhatsApp só com quem você quiser." },
];

// T26 para quem ainda não entrou: o Radar em 3 desenhos e o botão para pedir.
export function ExplicacaoRadar({ textoBusca }: { textoBusca?: string | null }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold leading-8">
          <Radar className="size-7 text-laranja-escuro" aria-hidden />
          Radar de Negócios
        </h1>
        <p className="text-base text-texto-suave">Não achou o que queria? Peça aqui e as lojas da região te procuram.</p>
      </header>
      <ol className="flex flex-col gap-3">
        {PASSOS.map((p, i) => (
          <li key={p.titulo} className="flex items-center gap-3 rounded-card bg-cartao p-4 shadow-1">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-laranja-claro text-beringela [&>svg]:size-7" aria-hidden>
              {p.icone}
            </span>
            <div className="flex flex-col">
              <span className="text-lg font-semibold">
                {i + 1}. {p.titulo}
              </span>
              <span className="text-base text-texto-suave">{p.texto}</span>
            </div>
          </li>
        ))}
      </ol>
      <Botao href={linkPedirRadar(textoBusca)} larguraTotal icone={<Megaphone />}>
        Pedir no Radar
      </Botao>
      <p className="text-center text-sm text-texto-suave">É grátis. Para pedir, você entra com o seu celular.</p>
    </main>
  );
}
